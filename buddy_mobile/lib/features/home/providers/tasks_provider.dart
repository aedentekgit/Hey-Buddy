import 'package:flutter/foundation.dart';
import '../services/task_service.dart';

class TasksProvider with ChangeNotifier {
  final TaskService _taskService = TaskService();
  List<dynamic> _tasks = [];
  List<Map<String, dynamic>> _processedTasks = []; // Pre-computed for UI performance
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
        // PROCESS in background to avoid UI jitter
        _processedTasks = await _processTasksInBackground(_tasks);
      }
    } catch (e) {
      print("Error loading tasks: $e");
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Heavy lifting moved to background to prevent "Sync Jitter"
  Future<List<Map<String, dynamic>>> _processTasksInBackground(List<dynamic> rawTasks) async {
    // For large lists, compute() spawns a real worker isolate
    return await compute(_heavyTaskProcessor, {
      'tasks': rawTasks,
      'now': DateTime.now().toIso8601String(),
    });
  }

  // Static worker function for Isolate
  static List<Map<String, dynamic>> _heavyTaskProcessor(Map<String, dynamic> data) {
    final List<dynamic> rawTasks = data['tasks'];
    final DateTime now = DateTime.parse(data['now']);
    
    return rawTasks.map((task) {
      final Map<String, dynamic> taskMap = Map<String, dynamic>.from(task);
      final dateStr = taskMap['date'];
      bool isOverdue = false;
      
      if (dateStr != null && taskMap['status'] != 'completed') {
        try {
          final reminderDate = DateTime.parse(dateStr).toLocal();
          // Simple time parsing without TaskUtils since it might not be available in separate isolate
          // if it depends on Flutter plugins (Intl is fine)
          int hour = 23, minute = 59;
          final timeStr = taskMap['time']?.toString().toUpperCase();
          if (timeStr != null && timeStr.isNotEmpty) {
             if (timeStr.contains('AM') || timeStr.contains('PM')) {
                final isPM = timeStr.contains('PM');
                final cleanTime = timeStr.replaceAll('AM', '').replaceAll('PM', '').trim();
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
          final finalDate = DateTime(reminderDate.year, reminderDate.month, reminderDate.day, hour, minute);
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
        await loadTasks();
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
