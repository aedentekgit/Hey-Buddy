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
      final token = await _storage.read(key: 'token');
      if (token == null) return;

      await _dio.post(
        '${AppConfig.baseUrl}user/location',
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

  void startLiveTracking() {
    // Standard frequency for background location updates
    const LocationSettings locationSettings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 50, // Update every 50 meters
    );

    Geolocator.getPositionStream(locationSettings: locationSettings).listen(
      (Position position) async {
        try {
          // Reverse geocode to get address if needed
          List<Placemark> placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
          String address = placemarks.isNotEmpty ? "${placemarks[0].locality}, ${placemarks[0].administrativeArea}" : "Unknown";
          
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
        timeLimit: const Duration(seconds: 5),
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
