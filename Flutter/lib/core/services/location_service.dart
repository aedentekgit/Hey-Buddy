import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class LocationService {
  final Dio _dio = Dio();
  final _storage = const FlutterSecureStorage();

  Future<void> updateLocationOnBackend(double lat, double lng, String address) async {
    try {
      final token = await _storage.read(key: 'jwt');
      if (token == null) return;

      await _dio.post(
        '${AppConfig.baseUrl}users/location',
        data: {
          'lat': lat,
          'lng': lng,
          'address': address,
        },
        options: Options(
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      print("Backend location updated: $lat, $lng");
    } catch (e) {
      print("Failed to update backend location: $e");
    }
  }

  /// [onLocationUpdate] is an optional callback invoked on every position
  /// change with the resolved address, latitude, and longitude.  The widget
  /// can use this to refresh its UI and keep UserProvider current without
  /// needing to poll the backend or re-call getCurrentLocation().
  StreamSubscription<Position>? startLiveTracking({
    void Function(String address, double lat, double lng)? onLocationUpdate,
  }) {
    // Standard frequency for background location updates
    const LocationSettings locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 50, // Update every 50 meters
    );

    // Return the subscription so callers can cancel it and avoid memory leaks
    return Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      (Position position) async {
        try {
          // Reverse geocode to get address
          List<Placemark> placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
          final p = placemarks.isNotEmpty ? placemarks[0] : null;
          final locality = p?.locality ?? '';
          final region   = p?.administrativeArea ?? '';
          final String address = (locality.isNotEmpty && region.isNotEmpty)
              ? '$locality, $region'
              : (locality.isNotEmpty ? locality : (region.isNotEmpty ? region : 'Unknown'));

          // Notify caller so UI/state can update immediately
          onLocationUpdate?.call(address, position.latitude, position.longitude);

          await updateLocationOnBackend(position.latitude, position.longitude, address);
        } catch (e) {
          print("Live tracking update failed: $e");
        }
      },
    );
  }

  Future<Map<String, dynamic>?> getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    // Test if location services are enabled.
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return null;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return null;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      return null;
    } 

    try {
      Position position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      
      List<Placemark> placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
      String address = "Unknown Location";
      
      if (placemarks.isNotEmpty) {
        Placemark place = placemarks[0];
        List<String> addressParts = [];
        
        if (place.locality != null && place.locality!.isNotEmpty) {
           addressParts.add(place.locality!);
        }
        
        if (place.administrativeArea != null && place.administrativeArea!.isNotEmpty) {
          addressParts.add(place.administrativeArea!);
        }

        if (addressParts.isEmpty && place.name != null) {
           addressParts.add(place.name!);
        }

        address = addressParts.join(", ");
      }

      return {
        'address': address,
        'lat': position.latitude,
        'lng': position.longitude,
      };
    } catch (e) {
      print("Location service error: $e");
      return null;
    }
  }
}
