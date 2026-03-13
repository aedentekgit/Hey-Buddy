import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import '../providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/home/widgets/quick_actions_grid.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:buddy_mobile/shared/widgets/mobile_map_picker.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import '../services/task_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter_polyline_points/flutter_polyline_points.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class SmartDetailsPanel extends StatefulWidget {
  final Map<String, dynamic> reminder;
  final bool initialEditMode;

  const SmartDetailsPanel({
    super.key,
    required this.reminder,
    this.initialEditMode = false,
  });

  @override
  State<SmartDetailsPanel> createState() => _SmartDetailsPanelState();
}

class _SmartDetailsPanelState extends State<SmartDetailsPanel> {
  late bool isEditing;
  late TextEditingController titleController;
  late TextEditingController dateController;
  late TextEditingController timeController;
  late TextEditingController locationController;
  Map<String, dynamic>? coordinates;
  Map<String, dynamic>? travelStats;
  late List<dynamic> sharedWith;
  final TaskService _taskService = TaskService();
  Set<Polyline> polylines = {};
  Position? currentPosition;
  GoogleMapController? mapController;
  // Guard: prevents duplicate route-init calls when UserProvider fires multiple times
  bool _routeInitialized = false;

  late double bufferTime;
  late double geofenceRadius;
  late Map<String, bool> alerts;
  late String priority;
  late List<dynamic> backupContacts;
  late int escalationTime;
  late Map<String, bool> smartFeatures;
  late List<dynamic> timeline;
  late String status;
  bool _isGettingLocation = false;
  // Places autocomplete state
  List<Map<String, dynamic>> _locationSuggestions = [];
  bool _showLocationSuggestions = false;
  bool _isSearchingPlaces = false;
  Timer? _debounceTimer;
  // Backend-calculated adjusted notification time
  String? _adjustedNotificationTime;
  bool _isLoadingAdjustedTime = false;
  Timer? _adjDebounce;

  @override
  void initState() {
    super.initState();
    isEditing = widget.initialEditMode;
    final r = widget.reminder;
    titleController = TextEditingController(text: r['title'] ?? '');
    dateController = TextEditingController(text: r['date'] ?? '');
    timeController = TextEditingController(text: r['time'] ?? '');
    locationController = TextEditingController(text: r['location'] ?? '');

    bufferTime = (r['bufferTime'] ?? 15).toDouble().clamp(5.0, 120.0);
    geofenceRadius = (r['geofenceRadius'] ?? 500).toDouble().clamp(
      100.0,
      2000.0,
    );

    final al = r['alerts'] ?? {};
    alerts = {'push': al['push'] ?? true, 'email': al['email'] ?? true};

    priority = r['priority'] ?? 'medium';
    backupContacts = List.from(r['backupContacts'] ?? []);
    escalationTime = r['escalationTime'] ?? 0;

    final sf = r['smartFeatures'] ?? {};
    smartFeatures = {
      'earlyWarning': sf['earlyWarning'] ?? true,
      'trafficAware': sf['trafficAware'] ?? true,
      'itemExitGuards': sf['itemExitGuards'] ?? true,
    };

    timeline = List.from(r['timeline'] ?? []);
    status = r['status'] ?? 'pending';
    coordinates = r['coordinates'] != null
        ? Map<String, dynamic>.from(r['coordinates'])
        : null;

    // No coordinates fallback — if the reminder has no saved lat/lng, keep coordinates null.
    // The map will show the "No location specified" overlay and the user can re-pick in Edit mode.
    // A hardcoded city would produce wrong distance, travel time, and route.

    sharedWith = List.from(r['sharedWith'] ?? []);

    // Wire up autocomplete listener
    locationController.addListener(_onLocationChanged);

    _fetchTravelStats();
    _initRoute();
  }

  /// Called whenever an InheritedWidget (including UserProvider) above this
  /// widget changes.  If the route hasn't been initialised yet and UserProvider
  /// now has a real location, we retry so the map shows the route immediately
  /// without waiting for a new GPS fix (which emulators often can't deliver).
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    // Always check for a fresh location from UserProvider.
    // If we don't have a route yet (polylines empty) or if currentPosition is null,
    // we should try (re)initializing the route.
    final stored = Provider.of<UserProvider>(context).user['currentLocation'];
    if (stored != null && stored['lat'] != null && stored['lng'] != null) {
      if (currentPosition == null || polylines.isEmpty) {
        // Only run if we actually have something to show now that we didn't before.
        // We use a small delay or check to avoid infinite loops if GPS stays failing.
        if (!_routeInitialized || currentPosition == null) {
          _initRoute();
        }
      }
    }
  }

  Future<void> _initRoute() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse) {
        try {
          final pos = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
            timeLimit: const Duration(seconds: 15),
          );
          // GPS looks valid — trust the real device/emulator fix
          currentPosition = pos;
        } catch (e) {
          print("GPS fetch failed in _initRoute, trying stored location: $e");
        }
      }

      // Fallback: use UserProvider's last-known location instead of a hardcoded city
      if (currentPosition == null && mounted) {
        final user = Provider.of<UserProvider>(context, listen: false).user;
        final stored = user['currentLocation'];
        if (stored != null && stored['lat'] != null && stored['lng'] != null) {
          currentPosition = Position(
            latitude: (stored['lat'] as num).toDouble(),
            longitude: (stored['lng'] as num).toDouble(),
            timestamp: DateTime.now(),
            accuracy: 0,
            altitude: 0,
            heading: 0,
            speed: 0,
            speedAccuracy: 0,
            altitudeAccuracy: 0,
            headingAccuracy: 0,
          );
          print(
            "Using UserProvider stored location as fallback: ${currentPosition!.latitude}, ${currentPosition!.longitude}",
          );
        }
      }

      if (currentPosition == null) {
        // Still no position — didChangeDependencies will retry once UserProvider arrives
        return;
      }

      // Mark as initialised so didChangeDependencies won't fire again
      _routeInitialized = true;

      if (mounted) {
        // Refresh the current-position marker on the map immediately
        setState(() {});

        // Animate map camera to user's current location right away
        if (mapController != null && coordinates == null) {
          mapController!.animateCamera(
            CameraUpdate.newLatLngZoom(
              LatLng(currentPosition!.latitude, currentPosition!.longitude),
              14,
            ),
          );
        }

        if (coordinates != null) {
          _fetchRoute();
          _fetchTravelStats(); // Refresh with actual user position
        }
      }
    } catch (e) {
      print("Error initializing route: $e");
    }
  }

  Future<void> _fetchRoute() async {
    if (currentPosition == null || coordinates == null) return;

    double lat = currentPosition!.latitude;
    double lng = currentPosition!.longitude;

    // Note: No distance guard here. Even if the user is 10k km away,
    // Google Directions API will handle it (though it might fail if there's no road).
    // Discarding the route entirely makes the 'Smart Details' screen look broken.

    PolylinePoints polylinePoints = PolylinePoints(
      apiKey: AppConfig.googleMapsApiKey,
    );
    PolylineResult result = await polylinePoints.getRouteBetweenCoordinates(
      request: PolylineRequest(
        origin: PointLatLng(lat, lng),
        destination: PointLatLng(
          (coordinates!['lat'] as num).toDouble(),
          (coordinates!['lng'] as num).toDouble(),
        ),
        mode: TravelMode.driving,
      ),
    );

    if (result.points.isNotEmpty) {
      List<LatLng> polylineCoordinates = [];
      for (var point in result.points) {
        polylineCoordinates.add(LatLng(point.latitude, point.longitude));
      }
      if (mounted) {
        setState(() {
          polylines.add(
            Polyline(
              polylineId: const PolylineId("route"),
              color: Theme.of(context).primaryColor,
              points: polylineCoordinates,
              width: 5,
            ),
          );
        });

        // Fit bounds if map controller is available
        if (mapController != null) {
          LatLngBounds bounds = _getBounds(polylineCoordinates);
          mapController!.animateCamera(
            CameraUpdate.newLatLngBounds(bounds, 50),
          );
        }
      }
    } else {
      print("Route fetch failed: ${result.errorMessage ?? 'No points found'}");
    }
  }

  LatLngBounds _getBounds(List<LatLng> points) {
    double minLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLat = points.first.latitude;
    double maxLng = points.first.longitude;

    for (LatLng point in points) {
      if (point.latitude < minLat) minLat = point.latitude;
      if (point.latitude > maxLat) maxLat = point.latitude;
      if (point.longitude < minLng) minLng = point.longitude;
      if (point.longitude > maxLng) maxLng = point.longitude;
    }

    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  Future<void> _fetchTravelStats() async {
    if (widget.reminder['_id'] != null && coordinates != null) {
      double? lat = currentPosition?.latitude;
      double? lng = currentPosition?.longitude;

      // If GPS hasn't resolved yet, use the UserProvider's last-known location
      if ((lat == null || lng == null) && mounted) {
        final user = Provider.of<UserProvider>(context, listen: false).user;
        final stored = user['currentLocation'];
        if (stored != null) {
          lat = (stored['lat'] as num?)?.toDouble();
          lng = (stored['lng'] as num?)?.toDouble();
        }
      }

      // Pass actual coordinates if available (no artificial distance guard)

      final stats = await _taskService.fetchTravelStats(
        widget.reminder['_id'],
        lat: lat,
        lng: lng,
      );

      if (mounted) {
        setState(() {
          travelStats = stats;

          // AUTO-CALCULATE RADIUS: HALF of Distance (min 200m, max 5km)
          if (stats != null && stats['distance'] != null) {
            double distanceKm = stats['distance'] / 1000.0;
            double autoRadiusKm = (distanceKm / 2.0).clamp(0.2, 5.0);
            geofenceRadius = autoRadiusKm * 1000.0;
            print(
              "[Geofence] Auto-calculated radius: ${autoRadiusKm.toStringAsFixed(2)}km for distance: ${distanceKm.toStringAsFixed(2)}km",
            );
          }
        });
        // Fetch adjusted notification time from backend now that we have travel data
        _fetchAdjustedNotification();
      }
    }
  }

  /// Calls the backend to calculate the adjusted notification time.
  /// Formula: pickup_time - (travel_time + buffer_time)
  Future<void> _fetchAdjustedNotification() async {
    final pickupTime = timeController.text.trim();
    if (pickupTime.isEmpty) return;

    // durationInTraffic is in seconds — convert to minutes
    final travelMin = travelStats?['durationInTraffic'] != null
        ? (((travelStats!['durationInTraffic'] as num) / 60).ceil())
        : 0;
    final bufferMin = bufferTime.toInt();

    if (mounted) setState(() => _isLoadingAdjustedTime = true);

    try {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      final timeFormat = user['timeFormat'] ?? '12';

      final result = await _taskService.fetchAdjustedNotification(
        pickupTime: pickupTime,
        travelMinutes: travelMin,
        bufferMinutes: bufferMin,
        timeFormat: timeFormat.toString(),
      );

      if (mounted) {
        setState(() {
          _adjustedNotificationTime = result?['adjusted_notification_time'];
          _isLoadingAdjustedTime = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoadingAdjustedTime = false);
    }
  }

  /// Debounced trigger for adjusted notification recalculation (used by slider).
  void _scheduleAdjustedNotificationRefresh() {
    _adjDebounce?.cancel();
    _adjDebounce = Timer(const Duration(milliseconds: 600), () {
      _fetchAdjustedNotification();
    });
  }

  Future<void> _unshareUser(String userId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text("Remove Sharing"),
        content: const Text(
          "Are you sure you want to stop sharing this reminder with this user?",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text("Cancel"),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Remove", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final success = await _taskService.unshareReminder(
      widget.reminder['_id'],
      userId,
    );
    if (success) {
      ToastUtils.showSuccessToast("User removed from sharing");
      if (mounted) {
        setState(
          () => sharedWith.removeWhere((s) => s['user']['_id'] == userId),
        );
      }
    } else {
      ToastUtils.showErrorToast("Failed to remove user");
    }
  }

  /// Grabs current GPS position and reverse-geocodes it to a readable address.
  Future<void> _useMyLocation() async {
    setState(() => _isGettingLocation = true);
    try {
      // Check + request permission
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        ToastUtils.showErrorToast(
          "Location permission denied. Enable it in Settings.",
        );
        return;
      }

      // Get position
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 15));

      // Reverse geocode
      String address =
          "${pos.latitude.toStringAsFixed(5)}, ${pos.longitude.toStringAsFixed(5)}";
      try {
        final placemarks = await placemarkFromCoordinates(
          pos.latitude,
          pos.longitude,
        );
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          final parts = <String>[
            if (p.name != null && p.name!.isNotEmpty && p.name != p.street)
              p.name!,
            if (p.street != null && p.street!.isNotEmpty) p.street!,
            if (p.subLocality != null && p.subLocality!.isNotEmpty)
              p.subLocality!,
            if (p.locality != null && p.locality!.isNotEmpty) p.locality!,
          ].where((s) => s.isNotEmpty).toList();
          if (parts.isNotEmpty) address = parts.join(', ');
        }
      } catch (_) {}

      if (mounted) {
        setState(() {
          coordinates = {'lat': pos.latitude, 'lng': pos.longitude};
          locationController.text = address;
        });
        ToastUtils.showSuccessToast("Location captured ✓");
      }
    } catch (e) {
      if (mounted)
        ToastUtils.showErrorToast(
          "Could not get location: ${e.toString().split(':').first}",
        );
    } finally {
      if (mounted) setState(() => _isGettingLocation = false);
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _adjDebounce?.cancel();
    locationController.removeListener(_onLocationChanged);
    titleController.dispose();
    dateController.dispose();
    timeController.dispose();
    locationController.dispose();
    super.dispose();
  }

  // ── Places Autocomplete ─────────────────────────────────────────────────
  void _onLocationChanged() {
    final q = locationController.text.trim();
    if (q.isEmpty) {
      setState(() {
        _locationSuggestions = [];
        _showLocationSuggestions = false;
      });
      return;
    }
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 400), () {
      _searchPlaces(q);
    });
  }

  Future<void> _searchPlaces(String query) async {
    if (query.length < 2) return;
    setState(() => _isSearchingPlaces = true);
    try {
      final url = Uri.parse(
        'https://maps.googleapis.com/maps/api/place/autocomplete/json'
        '?input=${Uri.encodeComponent(query)}'
        '&key=${AppConfig.googleMapsApiKey}',
      );
      final res = await http.get(url).timeout(const Duration(seconds: 8));
      final data = jsonDecode(res.body);
      if (data['status'] == 'OK' && mounted) {
        setState(() {
          _locationSuggestions = List<Map<String, dynamic>>.from(
            (data['predictions'] as List).map(
              (p) => {
                'description': p['description'] as String,
                'place_id': p['place_id'] as String,
                'main':
                    (p['structured_formatting']?['main_text'] ??
                            p['description'])
                        as String,
                'secondary':
                    (p['structured_formatting']?['secondary_text'] ?? '')
                        as String,
              },
            ),
          );
          _showLocationSuggestions = _locationSuggestions.isNotEmpty;
        });
      }
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isSearchingPlaces = false);
    }
  }

  Future<void> _selectPlace(Map<String, dynamic> place) async {
    // Hide keyboard + suggestions immediately
    FocusScope.of(context).unfocus();
    locationController.removeListener(_onLocationChanged);
    locationController.text = place['description'];
    locationController.addListener(_onLocationChanged);
    setState(() {
      _showLocationSuggestions = false;
      _locationSuggestions = [];
    });
    // Fetch coordinates from Place Details
    try {
      final url = Uri.parse(
        'https://maps.googleapis.com/maps/api/place/details/json'
        '?place_id=${place['place_id']}'
        '&fields=geometry'
        '&key=${AppConfig.googleMapsApiKey}',
      );
      final res = await http.get(url).timeout(const Duration(seconds: 8));
      final data = jsonDecode(res.body);
      if (data['status'] == 'OK' && mounted) {
        final loc = data['result']['geometry']['location'];
        setState(() => coordinates = {'lat': loc['lat'], 'lng': loc['lng']});
      }
    } catch (_) {}
  }
  // ────────────────────────────────────────────────────────────────────────

  Future<void> _toggleSetting(String category, String key, bool value) async {
    setState(() {
      if (category == 'smartFeatures') {
        smartFeatures[key] = value;
      } else {
        alerts[key] = value;
      }
    });

    if (!isEditing) {
      // Auto-save when toggled in view mode
      final updatedData = {
        category: category == 'smartFeatures' ? smartFeatures : alerts,
      };

      final success = await Provider.of<TasksProvider>(
        context,
        listen: false,
      ).updateTask(widget.reminder['_id'], updatedData);

      if (success) {
        final statusText = value ? "turned ON" : "turned OFF";
        String label = key == 'earlyWarning'
            ? "Early Warning"
            : key == 'trafficAware'
            ? "Traffic ETA"
            : key == 'itemExitGuards'
            ? "Exit Guards"
            : key == 'push'
            ? "Push Alerts"
            : "Email Alerts";

        final msg = "$label $statusText";
        if (value) {
          ToastUtils.showSuccessToast(msg);
        } else {
          ToastUtils.showErrorToast(msg);
        }
      } else {
        // Revert on failure
        setState(() {
          if (category == 'smartFeatures') {
            smartFeatures[key] = !value;
          } else {
            alerts[key] = !value;
          }
        });
        ToastUtils.showErrorToast("Failed to update setting");
      }
    }
  }

  Future<void> _handleComplete() async {
    final oldStatus = status;
    final targetStatus = oldStatus == 'completed' ? 'on_track' : 'completed';
    setState(() => status = targetStatus);
    
    final success = await Provider.of<TasksProvider>(
      context,
      listen: false,
    ).updateTask(widget.reminder['_id'], {'status': targetStatus});
    
    if (!success && mounted) {
      setState(() => status = oldStatus);
      ToastUtils.showErrorToast("Failed to update status (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'completed' 
          ? "Reminder marked as completed" 
          : "Reminder returned to on track";
      ToastUtils.showSuccessToast(msg);
    }
  }

  Future<void> _handlePending() async {
    final oldStatus = status;
    final targetStatus = oldStatus == 'pending' ? 'on_track' : 'pending';
    setState(() => status = targetStatus);

    final success = await Provider.of<TasksProvider>(
      context,
      listen: false,
    ).updateTask(widget.reminder['_id'], {'status': targetStatus});

    if (!success && mounted) {
      setState(() => status = oldStatus);
      ToastUtils.showErrorToast("Failed to update status (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'pending' 
          ? "Reminder marked as pending" 
          : "Reminder returned to on track";
      ToastUtils.showSuccessToast(msg);
    }
  }

  Future<int?> _showSnoozeSelection() async {
    DateTime tempTime = DateTime.now();
    bool showingCustom = false;

    return await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 10),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const SizedBox(width: 48),
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(LucideIcons.x, size: 20, color: AppColors.textMid),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  showingCustom ? 'Custom Snooze' : 'Snooze Reminder',
                  style: GoogleFonts.nunito(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.text,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 20),
                if (!showingCustom) ...[
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    crossAxisSpacing: 16,
                    mainAxisSpacing: 16,
                    childAspectRatio: 1.8,
                    children: [
                      _buildSnoozeCard(15, '15 Min', LucideIcons.alarmClock, context),
                      _buildSnoozeCard(30, '30 Min', LucideIcons.alarmClock, context),
                      _buildSnoozeCard(60, '1 Hour', LucideIcons.hourglass, context),
                      _buildSnoozeCard(120, '2 Hours', LucideIcons.timer, context),
                    ],
                  ),
                  const SizedBox(height: 16),
                  GestureDetector(
                    onTap: () => setSheetState(() => showingCustom = true),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 24),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [AppColors.accent, const Color(0xFF6366F1)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(LucideIcons.calendarClock, color: Colors.white, size: 20),
                              const SizedBox(width: 12),
                              Text(
                                'Set Custom Time',
                                style: GoogleFonts.nunito(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                          const Icon(LucideIcons.chevronRight, color: Colors.white70, size: 18),
                        ],
                      ),
                    ),
                  ),
                ] else ...[
                  SizedBox(
                    height: 200,
                    child: CupertinoDatePicker(
                      mode: CupertinoDatePickerMode.time,
                      initialDateTime: DateTime.now().add(const Duration(minutes: 5)),
                      onDateTimeChanged: (DateTime dt) => tempTime = dt,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: () => setSheetState(() => showingCustom = false),
                          child: Text('Back', style: GoogleFonts.nunito(fontWeight: FontWeight.bold, color: AppColors.textMid)),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => Navigator.pop(context, -3),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              color: AppColors.accent,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Text(
                              'Confirm',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                if (status == 'snoozed' && !showingCustom) ...[
                  const SizedBox(height: 24),
                  GestureDetector(
                    onTap: () => Navigator.pop(context, -1),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: AppColors.danger.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.danger.withOpacity(0.2)),
                      ),
                      child: Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(LucideIcons.alarmClockOff, color: AppColors.danger, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              'TURN OFF SNOOZE',
                              style: GoogleFonts.nunito(
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                color: AppColors.danger,
                                letterSpacing: 1.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    ).then((val) {
      if (val == -3) {
        _tempSnoozeTime = tempTime;
      }
      return val;
    });
  }

  // Helper variable to bypass picker
  DateTime? _tempSnoozeTime;

  Widget _buildSnoozeCard(int mins, String label, IconData icon, BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pop(context, mins),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.orange, size: 22),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.nunito(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomTimeCard() {
    // This is no longer used directly as a Widget but retained if needed or can be removed
    return const SizedBox.shrink();
  }

  String _formatTimeOfDay(TimeOfDay tod) {
    final hour = tod.hourOfPeriod == 0 ? 12 : tod.hourOfPeriod;
    final min = tod.minute.toString().padLeft(2, '0');
    final period = tod.period == DayPeriod.am ? 'AM' : 'PM';
    return "${hour.toString().padLeft(2, '0')}:$min $period";
  }

  Future<void> _handleSnooze() async {
    final oldStatus = status;
    final int? picked = await _showSnoozeSelection();

    if (picked == null) return;

    String targetStatus = 'snoozed';
    String snoozedTime = "";
    final originalTime = widget.reminder['time'] ?? timeController.text;

    if (picked == -1) {
      targetStatus = 'on_track';
      snoozedTime = originalTime;
    } else if (picked == -3 && _tempSnoozeTime != null) {
      snoozedTime = _formatTimeOfDay(TimeOfDay.fromDateTime(_tempSnoozeTime!));
      _tempSnoozeTime = null; // reset
    } else {
      snoozedTime = _snoozeTime(originalTime, picked);
    }

    final oldTime = timeController.text;

    setState(() {
      timeController.text = snoozedTime;
      status = targetStatus;
    });

    final updateData = {
      'status': targetStatus,
      'time': snoozedTime,
    };

    final success = await Provider.of<TasksProvider>(
      context,
      listen: false,
    ).updateTask(widget.reminder['_id'], updateData);

    if (!success && mounted) {
      setState(() {
        timeController.text = oldTime;
        status = oldStatus;
      });
      ToastUtils.showErrorToast("Failed to update snooze (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'snoozed'
          ? "Snoozed until $snoozedTime"
          : "Snooze removed (Rescheduled for $originalTime)";
      ToastUtils.showSuccessToast(msg);
    }
  }

  String _snoozeTime(String timeStr, int minutes) {
    try {
      final parts = timeStr.split(':');
      int hour = int.parse(parts[0]);
      final rest = parts[1].trim();
      final minuteStr = rest.substring(0, 2);
      int minute = int.parse(minuteStr);
      bool isPM = timeStr.toUpperCase().contains('PM');
      bool isAM = timeStr.toUpperCase().contains('AM');

      if (isPM && hour < 12) hour += 12;
      if (isAM && hour == 12) hour = 0;

      DateTime dt = DateTime(
        2024,
        1,
        1,
        hour,
        minute,
      ).add(Duration(minutes: minutes));

      int newHour = dt.hour;
      int newMinute = dt.minute;
      String suffix = newHour >= 12 ? 'PM' : 'AM';
      int displayHour = newHour > 12
          ? newHour - 12
          : (newHour == 0 ? 12 : newHour);

      return "${displayHour.toString().padLeft(2, '0')}:${newMinute.toString().padLeft(2, '0')} $suffix";
    } catch (_) {
      return timeStr;
    }
  }

  Future<void> _handlePriority() async {
    final current = priority;
    String next = 'low';
    if (current == 'low')
      next = 'medium';
    else if (current == 'medium')
      next = 'high';
    else
      next = 'low';

    final oldPriority = priority;
    setState(() => priority = next);

    final success = await Provider.of<TasksProvider>(
      context,
      listen: false,
    ).updateTask(widget.reminder['_id'], {'priority': next});

    if (!success && mounted) {
      setState(() => priority = oldPriority);
      ToastUtils.showErrorToast("Failed to update priority (Server Busy)");
    } else if (mounted) {
      ToastUtils.showSuccessToast("Priority updated to ${next.toUpperCase()}");
    }
  }

  Future<void> _handleReschedule() async {
    setState(() => isEditing = true);
  }

  Future<void> _handleDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.dangerLight,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  LucideIcons.trash2,
                  size: 22,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "Delete Reminder",
                style: GoogleFonts.nunito(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "Are you sure you want to delete this reminder? This action cannot be undone.",
                style: GoogleFonts.inter(
                  fontSize: 13.5,
                  color: AppColors.textMid,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(ctx, false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          "Cancel",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMid,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(ctx, true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          "Delete",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true) {
      final success = await Provider.of<TasksProvider>(
        context,
        listen: false,
      ).deleteTask(widget.reminder['_id']);
      if (success) {
        if (mounted) {
          ToastUtils.showSuccessToast("Reminder deleted");
          Navigator.pop(context);
        }
      } else {
        if (mounted) ToastUtils.showErrorToast("Failed to delete reminder");
      }
    }
  }

  Future<void> _handleSave() async {
    final updatedData = {
      'title': titleController.text,
      'date': dateController.text,
      'time': timeController.text,
      'location': locationController.text,
      'bufferTime': bufferTime.toInt(),
      'geofenceRadius': geofenceRadius.toInt(),
      'alerts': alerts,
      'priority': priority,
      'backupContacts': backupContacts,
      'escalationTime': escalationTime,
      'smartFeatures': smartFeatures,
      'status': status,
      'coordinates': coordinates,
    };

    final success = await Provider.of<TasksProvider>(
      context,
      listen: false,
    ).updateTask(widget.reminder['_id'], updatedData);

    if (success) {
      if (mounted) {
        setState(() => isEditing = false);
        ToastUtils.showSuccessToast("Settings updated");
      }
    } else {
      if (mounted) {
        ToastUtils.showErrorToast("Failed to update settings");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Status + Edit Settings row ──────────────────────────────────
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(bottom: BorderSide(color: AppColors.border)),
          ),
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _StatusBadge(
                label: status == 'completed'
                    ? "Completed"
                    : (status == 'snoozed'
                        ? "Snoozed"
                        : (status == 'pending'
                            ? "Pending"
                            : (status == 'risk_alert'
                                ? "Risk Alert"
                                : "On Track"))),
              ),
              Row(
                children: [
                  GestureDetector(
                    onTap: _handleDelete,
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.dangerLight,
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(
                          color: AppColors.danger.withOpacity(0.25),
                        ),
                      ),
                      child: const Icon(
                        LucideIcons.trash2,
                        size: 16,
                        color: AppColors.danger,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () => setState(() => isEditing = !isEditing),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: isEditing
                            ? AppColors.dangerLight
                            : AppColors.accentLight,
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(
                          color: isEditing
                              ? AppColors.danger.withOpacity(0.25)
                              : AppColors.accent.withOpacity(0.25),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isEditing ? LucideIcons.x : LucideIcons.pencil,
                            size: 13,
                            color: isEditing
                                ? AppColors.danger
                                : AppColors.accent,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isEditing ? "Cancel" : "Edit",
                            style: GoogleFonts.nunito(
                              color: isEditing
                                  ? AppColors.danger
                                  : AppColors.accent,
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        // ── Scrollable body ─────────────────────────────────────────────
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                if (isEditing)
                  TextField(
                    controller: titleController,
                    style: GoogleFonts.nunito(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppColors.bg,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: AppColors.border),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(
                          color: AppColors.accent.withOpacity(0.5),
                          width: 1.5,
                        ),
                      ),
                      contentPadding: const EdgeInsets.all(16),
                    ),
                  )
                else
                  Text(
                    titleController.text,
                    style: GoogleFonts.nunito(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                      height: 1.2,
                    ),
                  ),
                const SizedBox(height: 24),

                // Meta Info Rows
                if (widget.reminder['intent'] == 'pickup' ||
                    (locationController.text.isNotEmpty &&
                        locationController.text != 'No Location') ||
                    (coordinates != null && coordinates!['lat'] != null) ||
                    isEditing)
                  _InfoRow(
                    icon: LucideIcons.mapPin,
                    label: "Location",
                    child: isEditing
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: locationController,
                                      decoration: InputDecoration(
                                        hintText: "Type address...",
                                        hintStyle: GoogleFonts.outfit(
                                          fontSize: 13,
                                          color: Colors.grey[400],
                                        ),
                                        border: InputBorder.none,
                                        contentPadding: EdgeInsets.zero,
                                      ),
                                      style: GoogleFonts.outfit(fontSize: 14),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  // GPS button
                                  GestureDetector(
                                    onTap: _isGettingLocation
                                        ? null
                                        : _useMyLocation,
                                    child: AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 200,
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _isGettingLocation
                                            ? Colors.grey[200]
                                            : const Color(
                                                0xFF7C3AED,
                                              ).withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(20),
                                        border: Border.all(
                                          color: _isGettingLocation
                                              ? Colors.grey[300]!
                                              : const Color(
                                                  0xFF7C3AED,
                                                ).withOpacity(0.3),
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          _isGettingLocation
                                              ? SizedBox(
                                                  width: 12,
                                                  height: 12,
                                                  child:
                                                      CircularProgressIndicator(
                                                        strokeWidth: 1.5,
                                                        color: const Color(
                                                          0xFF7C3AED,
                                                        ),
                                                      ),
                                                )
                                              : Icon(
                                                  LucideIcons.navigation,
                                                  size: 12,
                                                  color: const Color(
                                                    0xFF7C3AED,
                                                  ),
                                                ),
                                          const SizedBox(width: 4),
                                          Text(
                                            _isGettingLocation
                                                ? "Getting..."
                                                : "Use GPS",
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: _isGettingLocation
                                                  ? Colors.grey[600]
                                                  : const Color(0xFF7C3AED),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              // ── Autocomplete dropdown ──────────────────────────
                              if (_showLocationSuggestions) ...[
                                const SizedBox(height: 4),
                                Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(14),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withOpacity(0.10),
                                        blurRadius: 16,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                    border: Border.all(
                                      color: const Color(
                                        0xFF7C3AED,
                                      ).withOpacity(0.15),
                                    ),
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(14),
                                    child: Column(
                                      children: _locationSuggestions.asMap().entries.map((
                                        entry,
                                      ) {
                                        final i = entry.key;
                                        final s = entry.value;
                                        final isLast =
                                            i ==
                                            _locationSuggestions.length - 1;
                                        return InkWell(
                                          onTap: () => _selectPlace(s),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 14,
                                              vertical: 10,
                                            ),
                                            decoration: BoxDecoration(
                                              border: isLast
                                                  ? null
                                                  : Border(
                                                      bottom: BorderSide(
                                                        color: Colors.grey
                                                            .withOpacity(0.12),
                                                      ),
                                                    ),
                                            ),
                                            child: Row(
                                              children: [
                                                Container(
                                                  width: 28,
                                                  height: 28,
                                                  decoration: BoxDecoration(
                                                    color: const Color(
                                                      0xFF7C3AED,
                                                    ).withOpacity(0.08),
                                                    shape: BoxShape.circle,
                                                  ),
                                                  child: const Icon(
                                                    LucideIcons.mapPin,
                                                    size: 13,
                                                    color: Color(0xFF7C3AED),
                                                  ),
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        s['main'],
                                                        style:
                                                            GoogleFonts.outfit(
                                                              fontSize: 13,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600,
                                                              color:
                                                                  const Color(
                                                                    0xFF1E1B4B,
                                                                  ),
                                                            ),
                                                        maxLines: 1,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                      ),
                                                      if ((s['secondary']
                                                              as String)
                                                          .isNotEmpty)
                                                        Text(
                                                          s['secondary'],
                                                          style:
                                                              GoogleFonts.outfit(
                                                                fontSize: 11,
                                                                color: Colors
                                                                    .grey[500],
                                                              ),
                                                          maxLines: 1,
                                                          overflow: TextOverflow
                                                              .ellipsis,
                                                        ),
                                                    ],
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ),
                                ),
                              ],
                              // ─────────────────────────────────────────────────
                              // Coordinates badge
                              if (coordinates != null &&
                                  coordinates!['lat'] != null &&
                                  coordinates!['lng'] != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 6),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF10B981,
                                      ).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: const Color(
                                          0xFF10B981,
                                        ).withOpacity(0.3),
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(
                                          LucideIcons.mapPin,
                                          size: 10,
                                          color: Color(0xFF10B981),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          "${(coordinates!['lat'] as num).toStringAsFixed(4)}, ${(coordinates!['lng'] as num).toStringAsFixed(4)}",
                                          style: GoogleFonts.outfit(
                                            fontSize: 10,
                                            color: const Color(0xFF10B981),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                            ],
                          )
                        : Row(
                            children: [
                              Expanded(
                                child: Text(
                                  locationController.text.isEmpty
                                      ? "No location set"
                                      : locationController.text,
                                  style: GoogleFonts.outfit(fontSize: 14),
                                ),
                              ),
                              if (coordinates != null &&
                                  coordinates!['lat'] != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(
                                      0xFF10B981,
                                    ).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        LucideIcons.satellite,
                                        size: 10,
                                        color: Color(0xFF10B981),
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        "GPS",
                                        style: GoogleFonts.outfit(
                                          fontSize: 9,
                                          color: const Color(0xFF10B981),
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                  ),

                if (widget.reminder['intent'] == 'pickup' ||
                    (locationController.text.isNotEmpty &&
                        locationController.text != 'No Location') ||
                    (coordinates != null && coordinates!['lat'] != null) ||
                    isEditing)
                  const SizedBox(height: 12),
                _InfoRow(
                  icon: LucideIcons.clock,
                  label: "Schedule",
                  child: isEditing
                      ? Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: dateController,
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                ),
                                style: GoogleFonts.outfit(fontSize: 14),
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: timeController,
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                ),
                                style: GoogleFonts.outfit(fontSize: 14),
                              ),
                            ),
                          ],
                        )
                      : Text(
                          "Time: ${timeController.text} • ${dateController.text}",
                        ),
                ),
                const SizedBox(height: 32),

                // Time Settings
                _DetailCard(
                  title: "TIME & BUFFER CONFIG",
                  icon: LucideIcons.clock,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            "Safety Buffer Time",
                            style: GoogleFonts.nunito(
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                              color: AppColors.text,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accentLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            "${bufferTime.toInt()} min",
                            style: GoogleFonts.nunito(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 6,
                        activeTrackColor: AppColors.accent,
                        inactiveTrackColor: AppColors.border,
                        thumbColor: AppColors.surface,
                        overlayColor: AppColors.accent.withOpacity(0.12),
                        thumbShape: const RoundSliderThumbShape(
                          enabledThumbRadius: 10,
                          elevation: 3,
                        ),
                      ),
                      child: Slider(
                        value: bufferTime,
                        min: 5,
                        max: 120,
                        divisions: 23,
                        onChanged: isEditing
                            ? (v) {
                                setState(() => bufferTime = v);
                                _scheduleAdjustedNotificationRefresh();
                              }
                            : null,
                      ),
                    ),
                    Text(
                      "Add extra time before your reminder to ensure you're never late.",
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textMid,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.accent.withOpacity(0.08),
                            AppColors.purple.withOpacity(0.12),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.accent.withOpacity(0.15),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: AppColors.accent.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: AppColors.accent.withOpacity(0.2),
                              ),
                            ),
                            child: Icon(
                              LucideIcons.bell,
                              color: AppColors.accent,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "ADJUSTED NOTIFICATION",
                                  style: GoogleFonts.nunito(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.accent,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                _isLoadingAdjustedTime
                                    ? SizedBox(
                                        height: 28,
                                        width: 28,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: AppColors.accent,
                                        ),
                                      )
                                    : Text(
                                        _adjustedNotificationTime ??
                                            _getAdjustedTime(),
                                        style: GoogleFonts.nunito(
                                          fontSize: 24,
                                          fontWeight: FontWeight.w900,
                                          color: AppColors.text,
                                        ),
                                      ),
                                const SizedBox(height: 2),
                                Text(
                                  "Calculated: Time − (Traffic + Buffer)",
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: AppColors.textMid,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                // Location Settings
                if (widget.reminder['intent'] == 'pickup' ||
                    (locationController.text.isNotEmpty &&
                        locationController.text != 'No Location') ||
                    (coordinates != null && coordinates!['lat'] != null) ||
                    isEditing)
                  _DetailCard(
                    title: "LOCATION SETTINGS",
                    icon: LucideIcons.navigation,
                    children: [
                      Container(
                        height: 200,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.hardEdge,
                        child: isEditing
                            ? MobileMapPicker(
                                initialCoordinates: coordinates,
                                onLocationSelected: (coords, address) {
                                  setState(() {
                                    coordinates = coords;
                                    // Only update text if it's currently empty or was just generic
                                    if (locationController.text.isEmpty ||
                                        locationController.text.contains(
                                          "Custom Location",
                                        )) {
                                      locationController.text = address;
                                    }
                                  });
                                  _fetchTravelStats();
                                },
                              )
                            : Stack(
                                children: [
                                  GoogleMap(
                                    initialCameraPosition: CameraPosition(
                                      target:
                                          (coordinates != null &&
                                              coordinates!['lat'] != null)
                                          ? LatLng(
                                              coordinates!['lat'],
                                              coordinates!['lng'],
                                            )
                                          : (currentPosition != null
                                                ? LatLng(
                                                    currentPosition!.latitude,
                                                    currentPosition!.longitude,
                                                  )
                                                : () {
                                                    final stored =
                                                        Provider.of<UserProvider>(
                                                          context,
                                                          listen: false,
                                                        ).user['currentLocation'];
                                                    return (stored != null &&
                                                            stored['lat'] !=
                                                                null)
                                                        ? LatLng(
                                                            (stored['lat']
                                                                    as num)
                                                                .toDouble(),
                                                            (stored['lng']
                                                                    as num)
                                                                .toDouble(),
                                                          )
                                                        : const LatLng(
                                                            0.0,
                                                            0.0,
                                                          ); // No location at all — map shows world view
                                                  }()),
                                      zoom:
                                          (coordinates != null &&
                                              coordinates!['lat'] != null)
                                          ? 15
                                          : 12,
                                    ),
                                    onMapCreated: (controller) {
                                      mapController = controller;
                                      if (polylines.isNotEmpty) {
                                        // Route already fetched — fit both endpoints in view
                                        List<LatLng> polylineCoordinates =
                                            polylines.first.points;
                                        LatLngBounds bounds = _getBounds(
                                          polylineCoordinates,
                                        );
                                        mapController!.animateCamera(
                                          CameraUpdate.newLatLngBounds(
                                            bounds,
                                            50,
                                          ),
                                        );
                                      } else if (currentPosition != null &&
                                          coordinates != null) {
                                        // Have both points but route not drawn yet — show both on screen
                                        final bounds = LatLngBounds(
                                          southwest: LatLng(
                                            currentPosition!.latitude <
                                                    (coordinates!['lat'] as num)
                                                        .toDouble()
                                                ? currentPosition!.latitude
                                                : (coordinates!['lat'] as num)
                                                      .toDouble(),
                                            currentPosition!.longitude <
                                                    (coordinates!['lng'] as num)
                                                        .toDouble()
                                                ? currentPosition!.longitude
                                                : (coordinates!['lng'] as num)
                                                      .toDouble(),
                                          ),
                                          northeast: LatLng(
                                            currentPosition!.latitude >
                                                    (coordinates!['lat'] as num)
                                                        .toDouble()
                                                ? currentPosition!.latitude
                                                : (coordinates!['lat'] as num)
                                                      .toDouble(),
                                            currentPosition!.longitude >
                                                    (coordinates!['lng'] as num)
                                                        .toDouble()
                                                ? currentPosition!.longitude
                                                : (coordinates!['lng'] as num)
                                                      .toDouble(),
                                          ),
                                        );
                                        mapController!.animateCamera(
                                          CameraUpdate.newLatLngBounds(
                                            bounds,
                                            60,
                                          ),
                                        );
                                      } else if (currentPosition != null) {
                                        // Only user location — centre map on them
                                        mapController!.animateCamera(
                                          CameraUpdate.newLatLngZoom(
                                            LatLng(
                                              currentPosition!.latitude,
                                              currentPosition!.longitude,
                                            ),
                                            14,
                                          ),
                                        );
                                      }
                                    },
                                    markers: {
                                      if (coordinates != null &&
                                          coordinates!['lat'] != null)
                                        Marker(
                                          markerId: const MarkerId('selected'),
                                          position: LatLng(
                                            coordinates!['lat'],
                                            coordinates!['lng'],
                                          ),
                                          icon:
                                              BitmapDescriptor.defaultMarkerWithHue(
                                                BitmapDescriptor.hueViolet,
                                              ),
                                        ),
                                      if (currentPosition != null)
                                        Marker(
                                          markerId: const MarkerId('current'),
                                          position: LatLng(
                                            currentPosition!.latitude,
                                            currentPosition!.longitude,
                                          ),
                                          icon:
                                              BitmapDescriptor.defaultMarkerWithHue(
                                                BitmapDescriptor.hueAzure,
                                              ),
                                        ),
                                    },
                                    circles: {
                                      if (coordinates != null &&
                                          coordinates!['lat'] != null)
                                        Circle(
                                          circleId: const CircleId('geofence'),
                                          center: LatLng(
                                            coordinates!['lat'],
                                            coordinates!['lng'],
                                          ),
                                          radius: geofenceRadius,
                                          fillColor: Theme.of(
                                            context,
                                          ).primaryColor.withOpacity(0.12),
                                          strokeColor: Theme.of(
                                            context,
                                          ).primaryColor,
                                          strokeWidth: 2,
                                        ),
                                    },
                                    polylines: polylines,
                                    zoomControlsEnabled: true,
                                    myLocationEnabled: true,
                                    myLocationButtonEnabled: true,
                                    mapToolbarEnabled: true,
                                  ),
                                  if (coordinates == null ||
                                      coordinates!['lat'] == null)
                                    Center(
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 20,
                                          vertical: 14,
                                        ),
                                        decoration: BoxDecoration(
                                          color: AppColors.surface.withOpacity(
                                            0.95,
                                          ),
                                          borderRadius: BorderRadius.circular(
                                            16,
                                          ),
                                          boxShadow: [
                                            BoxShadow(
                                              color: Colors.black.withOpacity(
                                                0.1,
                                              ),
                                              blurRadius: 10,
                                              offset: const Offset(0, 4),
                                            ),
                                          ],
                                        ),
                                        child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              LucideIcons.mapPinOff,
                                              size: 28,
                                              color: Theme.of(
                                                context,
                                              ).primaryColor.withOpacity(0.8),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              "No location specified",
                                              style: GoogleFonts.outfit(
                                                fontSize: 14,
                                                color: Colors.grey[800],
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              "Tap 'Edit Settings' to route",
                                              style: GoogleFonts.outfit(
                                                fontSize: 11,
                                                color: Colors.grey[600],
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            "Geofence Radius",
                            style: GoogleFonts.outfit(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                          Row(
                            children: [
                              // AUTO badge — shown when radius is auto-calculated from travelStats
                              if (travelStats != null && !isEditing)
                                Container(
                                  margin: const EdgeInsets.only(right: 8),
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFF6366F1),
                                        Color(0xFF8B5CF6),
                                      ],
                                    ),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    "AUTO",
                                    style: GoogleFonts.outfit(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.8,
                                    ),
                                  ),
                                ),
                              Text(
                                geofenceRadius >= 1000
                                    ? "${(geofenceRadius / 1000).toStringAsFixed(1)} km"
                                    : "${geofenceRadius.toInt()} m",
                                style: GoogleFonts.outfit(
                                  color: Theme.of(context).primaryColor,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 4,
                          activeTrackColor: isEditing
                              ? AppColors.accent
                              : AppColors.border,
                          inactiveTrackColor: AppColors.border.withOpacity(0.5),
                          thumbColor: isEditing
                              ? AppColors.accent
                              : AppColors.border,
                          overlayColor: Colors.transparent,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 8,
                            elevation: 0,
                          ),
                        ),
                        child: Slider(
                          value: geofenceRadius.clamp(200, 5000),
                          min: 200,
                          max: 5000,
                          divisions: 48,
                          onChanged: isEditing
                              ? (v) => setState(() => geofenceRadius = v)
                              : null,
                        ),
                      ),
                      if (!isEditing)
                        Padding(
                          padding: const EdgeInsets.only(top: 4, bottom: 8),
                          child: Text(
                            "Auto-set to half the travel distance. Edit to override.",
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              color: Colors.grey[500],
                            ),
                          ),
                        ),
                      if (travelStats != null) ...[
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: AppColors.bg,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.activity,
                                    size: 18,
                                    color: Colors.grey[600],
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    "Current Distance",
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    "${(travelStats!['distance'] / 1000).toStringAsFixed(2)} km",
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.car,
                                    size: 18,
                                    color: Colors.grey[600],
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    "Est. Travel Time",
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    "${(travelStats!['durationInTraffic'] / 60).round()} mins",
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: Theme.of(context).primaryColor,
                                    ),
                                  ),
                                ],
                              ),
                              // Auto-radius formula row
                              const SizedBox(height: 16),
                              const Divider(height: 1),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  const Icon(
                                    LucideIcons.target,
                                    size: 18,
                                    color: Color(0xFF6366F1),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    "Geofence Radius",
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: Colors.grey[600],
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    geofenceRadius >= 1000
                                        ? "${(geofenceRadius / 1000).toStringAsFixed(1)} km"
                                        : "${geofenceRadius.toInt()} m",
                                    style: GoogleFonts.outfit(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                      color: const Color(0xFF6366F1),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),

                if (!isEditing) ...[
                  const SizedBox(height: 24),
                  QuickActionsGrid(
                    actions: [
                      QuickActionItem(
                        label: 'Complete',
                        icon: LucideIcons.checkCircle2,
                        color: AppColors.green,
                        isSelected: status == 'completed',
                        onTap: _handleComplete,
                      ),
                      QuickActionItem(
                        label: status == 'snoozed' ? 'Snoozed until\n${timeController.text}' : 'Snooze',
                        icon: status == 'snoozed' ? LucideIcons.alarmClock : LucideIcons.alarmClock,
                        color: AppColors.orange,
                        isSelected: status == 'snoozed',
                        onTap: _handleSnooze,
                      ),

                      if (widget.reminder['isOverdue'] == true)
                        QuickActionItem(
                          label: 'Pending',
                          icon: LucideIcons.clock,
                          color: AppColors.danger,
                          isSelected: status == 'pending',
                          onTap: _handlePending,
                        )
                      else
                        QuickActionItem(
                          label: 'Reschedule',
                          icon: LucideIcons.clock,
                          color: AppColors.accent,
                          onTap: _handleReschedule,
                        ),
                      QuickActionItem(
                        label: 'Priority',
                        icon: LucideIcons.flag,
                        color: priority == 'high'
                            ? AppColors.danger
                            : (priority == 'medium'
                                ? AppColors.orange
                                : AppColors.textMid),
                        isSelected: priority != 'low',
                        onTap: _handlePriority,
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                ],

                // Collaboration Section
                _DetailCard(
                  title: "COLLABORATION",
                  icon: LucideIcons.share2,
                  children: [
                    if (sharedWith.isEmpty)
                      Text(
                        "Not shared with anyone",
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          color: Colors.grey[500],
                        ),
                      )
                    else
                      ...sharedWith.map(
                        (s) => Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.bg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Theme.of(
                                    context,
                                  ).primaryColor.withOpacity(0.1),
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 1.5,
                                  ),
                                ),
                                child: ClipOval(
                                  child: s['user']?['profilePicture'] != null
                                      ? CachedNetworkImage(
                                          imageUrl: AppConfig.formatImageUrl(
                                            s['user']?['profilePicture'],
                                          )!,
                                          fit: BoxFit.cover,
                                          errorWidget: (context, url, error) =>
                                              Center(
                                                child: Text(
                                                  s['user']?['name']?[0]
                                                          ?.toUpperCase() ??
                                                      'U',
                                                  style: TextStyle(
                                                    color: Theme.of(
                                                      context,
                                                    ).primaryColor,
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ),
                                        )
                                      : Center(
                                          child: Text(
                                            s['user']?['name']?[0]
                                                    ?.toUpperCase() ??
                                                'U',
                                            style: TextStyle(
                                              color: Theme.of(
                                                context,
                                              ).primaryColor,
                                              fontSize: 12,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                ),
                              ),

                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      s['user']?['name'] ?? 'Unknown',
                                      style: GoogleFonts.outfit(
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      s['user']?['email'] ?? '',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: Colors.grey[500],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (isEditing)
                                IconButton(
                                  icon: const Icon(
                                    LucideIcons.trash2,
                                    size: 16,
                                    color: Colors.red,
                                  ),
                                  onPressed: () =>
                                      _unshareUser(s['user']['_id']),
                                ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),

                // Family Backup

                // Smart Features
                _DetailCard(
                  title: "SMART FEATURES",
                  icon: LucideIcons.zap,
                  children: [
                    _SmartFeatureTile(
                      icon: LucideIcons.shieldAlert,
                      label: "Early Warning System",
                      sub:
                          "Get proactive alerts when you're at risk of being late based on your current location and traffic conditions",
                      value: smartFeatures['earlyWarning']!,
                      onChanged: (v) =>
                          _toggleSetting('smartFeatures', 'earlyWarning', v),
                      tag: "AI",
                      tagColor: Theme.of(context).primaryColor,
                    ),
                    _SmartFeatureTile(
                      icon: LucideIcons.car,
                      label: "Traffic-Aware ETA",
                      sub:
                          "Automatically adjust reminder times based on real-time traffic data and route conditions",
                      value: smartFeatures['trafficAware']!,
                      onChanged: (v) =>
                          _toggleSetting('smartFeatures', 'trafficAware', v),
                      tag: "LIVE",
                      tagColor: const Color(0xFF10B981),
                    ),
                    _SmartFeatureTile(
                      icon: LucideIcons.smartphone,
                      label: "Item Exit Guards",
                      sub:
                          "Get reminded about items you need to bring when leaving a location (e.g., wallet, keys, documents)",
                      value: smartFeatures['itemExitGuards']!,
                      onChanged: (v) =>
                          _toggleSetting('smartFeatures', 'itemExitGuards', v),
                      tag: "NEW",
                      tagColor: const Color(0xFF8B5CF6),
                    ),
                  ],
                ),

                // Alert Preferences
                _DetailCard(
                  title: "ALERT PREFERENCES",
                  icon: LucideIcons.bellRing,
                  children: [
                    _AlertTile(
                      icon: LucideIcons.bell,
                      label: "Push Notifications",
                      sub: "Receive alerts on your device",
                      value: alerts['push']!,
                      onChanged: (v) => _toggleSetting('alerts', 'push', v),
                    ),
                    _AlertTile(
                      icon: LucideIcons.mail,
                      label: "Email Alerts",
                      sub: "Detailed reports via email",
                      value: alerts['email']!,
                      onChanged: (v) => _toggleSetting('alerts', 'email', v),
                    ),
                  ],
                ),

                // Timeline
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 16),
                  child: Text(
                    "TIMELINE",
                    style: GoogleFonts.nunito(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.textDim,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Column(
                    children: [
                      if (timeline.isEmpty)
                        _TimelineItem(
                          title: "Reminder Created",
                          time: widget.reminder['createdAt'] != null
                              ? _formatFullDateTime(widget.reminder['createdAt'])
                              : "Just now",
                          icon: LucideIcons.plusCircle,
                          color: AppColors.accent,
                          isLast: true,
                        )
                      else
                        ...timeline.asMap().entries.map((e) {
                          final action = e.value['action'] ?? '';
                          return _TimelineItem(
                            title: action,
                            time: e.value['timestamp'] != null
                                ? _formatFullDateTime(e.value['timestamp'])
                                : "",
                            icon: _getTimelineIcon(action),
                            color: _getTimelineColor(action),
                            isLast: e.key == timeline.length - 1,
                          );
                        }),
                    ],
                  ),
                ),

                // Save Button
                if (isEditing)
                  GestureDetector(
                    onTap: _handleSave,
                    child: Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(top: 24),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(
                        "Save Settings",
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),

                const SizedBox(height: 100), // Padding for bottom
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _formatFullDateTime(String dateStr) {
    try {
      final date = DateTime.parse(dateStr);
      final user = Provider.of<UserProvider>(context, listen: false).user;
      final dFormat = user['dateFormat'] ?? 'DD/MM/YYYY';
      final tFormat = user['timeFormat'] ?? '12';
      return "${DateFormatter.formatDate(date, format: dFormat)} • ${DateFormatter.formatTime(date, format: tFormat)}";
    } catch (e) {
      return dateStr;
    }
  }

  String _getAdjustedTime() {
    if (timeController.text.isEmpty || !timeController.text.contains(':'))
      return "--:--";
    try {
      final parts = timeController.text.split(':');
      final now = DateTime.now();
      // Parsing logic assumes HH:mm input from timeController (standard TimeOfDay format usually)
      // But if timeController contains AM/PM, int.parse might fail.
      // Let's assume standard HH:mm for simplicity or try to parse flexibly.
      int hour = int.parse(parts[0].trim());
      int minute = int.parse(
        parts[1].split(' ')[0].trim(),
      ); // handle potential " PM"

      if (timeController.text.toLowerCase().contains('pm') && hour < 12)
        hour += 12;

      final target = DateTime(now.year, now.month, now.day, hour, minute);
      final adjusted = target.subtract(Duration(minutes: bufferTime.toInt()));

      final user = Provider.of<UserProvider>(context, listen: false).user;
      return DateFormatter.formatTime(
        adjusted,
        format: user['timeFormat'] ?? '12',
      );
    } catch (e) {
      return "--:--";
    }
  }

  IconData _getTimelineIcon(String action) {
    final a = action.toLowerCase();
    if (a.contains('created')) return LucideIcons.plusCircle;
    if (a.contains('completed')) return LucideIcons.checkCircle2;
    if (a.contains('snoozed')) return LucideIcons.alarmClock;
    if (a.contains('alert') || a.contains('guard')) return LucideIcons.shieldAlert;
    if (a.contains('updated') || a.contains('reschedule'))
      return LucideIcons.refreshCw;
    if (a.contains('risk')) return LucideIcons.alertTriangle;
    return LucideIcons.circle;
  }

  Color _getTimelineColor(String action) {
    final a = action.toLowerCase();
    if (a.contains('created')) return AppColors.accent;
    if (a.contains('completed')) return AppColors.green;
    if (a.contains('snoozed')) return AppColors.orange;
    if (a.contains('alert') || a.contains('risk') || a.contains('guard'))
      return AppColors.danger;
    return AppColors.textMid;
  }

  void _addContact() {
    showDialog(
      context: context,
      builder: (ctx) {
        final nameC = TextEditingController();
        final phoneC = TextEditingController();
        return AlertDialog(
          title: const Text("New Contact"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameC,
                decoration: const InputDecoration(labelText: "Name"),
              ),
              TextField(
                controller: phoneC,
                decoration: const InputDecoration(labelText: "Phone"),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("Cancel"),
            ),
            TextButton(
              onPressed: () {
                if (nameC.text.isNotEmpty && phoneC.text.isNotEmpty) {
                  setState(
                    () => backupContacts.add({
                      'name': nameC.text,
                      'phone': phoneC.text,
                    }),
                  );
                  Navigator.pop(ctx);
                }
              },
              child: const Text("Add"),
            ),
          ],
        );
      },
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  const _StatusBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    Color color = AppColors.orange;
    if (label == "On Track" || label == "Completed") {
      color = AppColors.green;
    } else if (label == "Pending" || label == "Risk Alert" || label == "Overdue") {
      color = AppColors.danger;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: color.withOpacity(0.3),
        ),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.nunito(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget child;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.bg,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: AppColors.accent),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: GoogleFonts.nunito(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMid,
                ),
              ),
              DefaultTextStyle(
                style: GoogleFonts.inter(fontSize: 14, color: AppColors.text),
                child: child,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _DetailCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppColors.cardShadow,
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.bg,
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 16, color: AppColors.text),
                  const SizedBox(width: 10),
                  Text(
                    title,
                    style: GoogleFonts.nunito(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: AppColors.text,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmartFeatureTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Function(bool) onChanged;
  final String tag;
  final Color tagColor;

  const _SmartFeatureTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.value,
    required this.onChanged,
    required this.tag,
    required this.tagColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: tagColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 20, color: tagColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(
                              label,
                              style: GoogleFonts.outfit(
                                fontWeight: FontWeight.w600,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: tagColor,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              tag,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Transform.scale(
                      scale: 0.8,
                      child: Switch.adaptive(
                        value: value,
                        onChanged: onChanged,
                      ),
                    ),
                  ],
                ),
                Text(
                  sub,
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    color: Colors.grey[600],
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Function(bool) onChanged;

  const _AlertTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.accent.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.accent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                Text(
                  sub,
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    color: Colors.grey[500],
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Transform.scale(
            scale: 0.8,
            child: Switch.adaptive(value: value, onChanged: onChanged),
          ),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final String title;
  final String time;
  final IconData icon;
  final Color color;
  final bool isLast;

  const _TimelineItem({
    required this.title,
    required this.time,
    required this.icon,
    required this.color,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Vertical Line & Dot
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withOpacity(0.3), width: 1.5),
                ),
                child: Icon(icon, size: 12, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.border.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(1),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          // Content
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Text(
                    title,
                    style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppColors.text,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(
                        LucideIcons.clock,
                        size: 10,
                        color: AppColors.textDim.withOpacity(0.6),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        time,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.textDim,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
