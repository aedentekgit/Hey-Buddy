import 'package:flutter/foundation.dart';
import '../services/task_service.dart';
import 'package:geolocator/geolocator.dart';

class TasksProvider with ChangeNotifier {
  final TaskService _taskService = TaskService();
  List<dynamic> _tasks = [];
  List<Map<String, dynamic>> _processedTasks = [];
  bool _isLoading = false;

  List<dynamic> get tasks => _tasks;
  List<Map<String, dynamic>> get processedTasks => _processedTasks;
  bool get isLoading => _isLoading;

  Future<void> loadTasks({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      notifyListeners();
    }

    try {
      final res = await _taskService.fetchReminders();
      if (res['success'] == true) {
        _tasks = res['data'];
        // Basic processing first so UI can appear immediately
        _processedTasks = await _processTasksInBackground(_tasks);
        notifyListeners();

        // Then enrich with live travel stats in background
        _enrichWithTravelStats();
      }
    } catch (e) {
      print("Error loading tasks: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Fetches real GPS position once, then calls travel-stats API *per task*
  /// and updates processedTasks with real distance/ETA labels.
  Future<void> _enrichWithTravelStats() async {
    try {
      // Get current GPS position (with permission handling)
      Position? position;
      try {
        LocationPermission perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) {
          perm = await Geolocator.requestPermission();
        }
        if (perm == LocationPermission.always ||
            perm == LocationPermission.whileInUse) {
          position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.medium,
          ).timeout(const Duration(seconds: 8));
        }
      } catch (e) {
        print("[TasksProvider] Could not get GPS: $e");
      }

      // For each task that has a location + ID, fetch live stats
      bool anyUpdated = false;
      for (int i = 0; i < _processedTasks.length; i++) {
        final task = _processedTasks[i];
        final id = task['_id'];
        final loc = task['location'];
        final hasLocation =
            id != null &&
            loc != null &&
            loc.toString().isNotEmpty &&
            loc != 'No Location';

        if (!hasLocation) continue;

        try {
          // If task has coordinates, verify the GPS position is not absurdly far
          // (e.g. Android emulator default = San Francisco, ~14000km from India).
          // If >1000km away, fall back to Madurai coords (same as smart_details_panel).
          double? useLat = position?.latitude;
          double? useLng = position?.longitude;

          final coords = task['coordinates'];
          if (useLat != null &&
              useLng != null &&
              coords != null &&
              coords['lat'] != null &&
              coords['lng'] != null) {
            final destLat = (coords['lat'] as num).toDouble();
            final destLng = (coords['lng'] as num).toDouble();
            final distKm = _haversineKm(useLat, useLng, destLat, destLng);
            if (distKm > 1000) {
              print(
                "[TasksProvider] GPS is ${distKm.toStringAsFixed(0)}km from destination — using Madurai fallback.",
              );
              // Use Madurai as fallback (same as SmartDetailsPanel._initRoute)
              useLat = 9.9252;
              useLng = 78.1198;
            }
          } else if (useLat == null || useLng == null) {
            // No GPS at all — use Madurai fallback so backend always has an origin
            useLat = 9.9252;
            useLng = 78.1198;
          }

          final stats = await _taskService.fetchTravelStats(
            id,
            lat: useLat,
            lng: useLng,
          );

          if (stats != null) {
            final distanceM = (stats['distance'] as num?)?.toDouble() ?? 0;
            final durationSec =
                (stats['durationInTraffic'] as num?)?.toDouble() ?? 0;

            // Format distance
            String distLabel;
            if (distanceM >= 1000) {
              distLabel = '${(distanceM / 1000).toStringAsFixed(1)} km';
            } else {
              distLabel = '${distanceM.toInt()} m';
            }

            // Format ETA
            final mins = (durationSec / 60).round();
            final etaLabel = mins >= 60
                ? '${(mins / 60).floor()}h ${mins % 60}m'
                : '$mins mins';

            _processedTasks[i] = {
              ..._processedTasks[i],
              '_distanceLabel': distLabel,
              '_etaLabel': etaLabel,
            };
            anyUpdated = true;
          }
        } catch (e) {
          print("[TasksProvider] Travel stats failed for $id: $e");
        }
      }

      if (anyUpdated) notifyListeners();
    } catch (e) {
      print("[TasksProvider] _enrichWithTravelStats error: $e");
    }
  }

  /// Haversine formula — straight-line distance in km between two coordinates.
  double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
    const R = 6371.0;
    const toRad = 3.141592653589793 / 180;
    final dLat = (lat2 - lat1) * toRad;
    final dLng = (lng2 - lng1) * toRad;
    final a =
        _sinSq(dLat / 2) + _cosDeg(lat1) * _cosDeg(lat2) * _sinSq(dLng / 2);
    final c = 2 * _asin(_sqrtClamp(a));
    return R * c;
  }

  // dart:math-free helpers (no import needed)
  double _sinSq(double x) {
    final s = x - x * x * x / 6 + x * x * x * x * x / 120;
    return s * s;
  }

  double _cosDeg(double deg) {
    final x = deg * 3.141592653589793 / 180;
    return 1 - x * x / 2 + x * x * x * x / 24;
  }

  double _sqrtClamp(double x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    double r = x;
    for (int i = 0; i < 10; i++) r = (r + x / r) / 2;
    return r;
  }

  double _asin(double x) {
    return x + x * x * x / 6 + 3 * x * x * x * x * x / 40;
  }

  Future<List<Map<String, dynamic>>> _processTasksInBackground(
    List<dynamic> rawTasks,
  ) async {
    return await compute(_heavyTaskProcessor, {
      'tasks': rawTasks,
      'now': DateTime.now().toIso8601String(),
    });
  }

  // Static worker function for Isolate
  static List<Map<String, dynamic>> _heavyTaskProcessor(
    Map<String, dynamic> data,
  ) {
    final List<dynamic> rawTasks = data['tasks'];
    final DateTime now = DateTime.parse(data['now']);

    return rawTasks.map((task) {
      final Map<String, dynamic> taskMap = Map<String, dynamic>.from(task);
      final dateStr = taskMap['date'];
      bool isOverdue = false;

      if (dateStr != null && taskMap['status'] != 'completed') {
        try {
          final reminderDate = DateTime.parse(dateStr).toLocal();
          int hour = 23, minute = 59;
          final timeStr = taskMap['time']?.toString().toUpperCase();
          if (timeStr != null && timeStr.isNotEmpty) {
            if (timeStr.contains('AM') || timeStr.contains('PM')) {
              final isPM = timeStr.contains('PM');
              final cleanTime = timeStr
                  .replaceAll('AM', '')
                  .replaceAll('PM', '')
                  .trim();
              final parts = cleanTime.split(':');
              hour = int.parse(parts[0]);
              if (parts.length > 1) minute = int.parse(parts[1]);
              if (isPM && hour < 12) hour += 12;
              if (!isPM && hour == 12) hour = 0;
            } else if (timeStr.contains(':')) {
              final parts = timeStr.split(':');
              hour = int.parse(parts[0]);
              minute = int.parse(parts[1]);
            }
          }
          final finalDate = DateTime(
            reminderDate.year,
            reminderDate.month,
            reminderDate.day,
            hour,
            minute,
          );
          isOverdue = now.isAfter(finalDate);
        } catch (_) {}
      }

      taskMap['_isOverdue'] = isOverdue;
      return taskMap;
    }).toList();
  }

  Future<bool> deleteTask(String id) async {
    final original = List.from(_tasks);
    _tasks.removeWhere((t) => t['_id'] == id);
    notifyListeners();

    try {
      final success = await _taskService.deleteReminder(id);
      if (!success) {
        _tasks = original;
        notifyListeners();
      }
      return success;
    } catch (e) {
      _tasks = original;
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateTask(String id, Map<String, dynamic> data) async {
    try {
      final success = await _taskService.updateReminder(id, data);
      if (success) {
        // Optimistically update the in-memory tasks to avoid full reload lag
        final index = _tasks.indexWhere((t) => t['_id'] == id);
        if (index != -1) {
          _tasks[index] = {..._tasks[index], ...data};
          _processedTasks = await _processTasksInBackground(_tasks);
          notifyListeners();
        }
        // Then trigger a silent reload in the background to ensure consistency
        loadTasks(silent: true);
      }
      return success;
    } catch (e) {
      return false;
    }
  }

  Future<bool> createTask(Map<String, dynamic> data) async {
    try {
      final success = await _taskService.createReminder(data);
      if (success) {
        await loadTasks();
      }
      return success;
    } catch (e) {
      return false;
    }
  }
}
