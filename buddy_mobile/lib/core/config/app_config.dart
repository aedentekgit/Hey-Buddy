import 'package:flutter/foundation.dart';
import 'dart:io';

class AppConfig {
  // FINAL PRODUCTION HOST
  static const String productionHost = 'ayuskart.com';
  // STAGING HOST (For Testing)
  static const String stagingHost = 'staging.ayuskart.com';
  // LOCAL HOST (For Device Debugging - using discovered local IP)
  static const String localhostHost = '10.0.2.2:5001'; // 10.0.2.2 is local loopback for Android Emulator

  static String get host {
    // Toggling: Set this flag to true for Localhost, false for Staging.
    const bool useLocal = true; 

    if (kDebugMode) {
      return useLocal ? localhostHost : stagingHost;
    }
    return productionHost;
  }

  static String get protocol {
    // Both environments use HTTPS (Staging on Port 5002 via Nginx)
    // Localhost uses HTTP
    return kDebugMode && host == localhostHost ? 'http' : 'https';
  }

  static String get baseUrl {
    return '$protocol://$host/api/';
  }

  static String get socketUrl {
    return '$protocol://$host';
  }

  static String get assetBaseUrl {
    return '$protocol://$host/';
  }
  
  // Default branding (to be updated from API)
  static String appName = 'HeyBuddy';
  static String primaryColor = '#6366F1'; 
  static String secondaryColor = '#FFFFFF';
  static String? logoUrl;
  static String? splashUrl;

  static const String googleMapsApiKey = "AIzaSyDys6Q4lVtZkq6hqR5kl8ZAfCDzpWXJ1zA";

  static String? formatImageUrl(String? path) {
    if (path == null || path.isEmpty || path == "null") return null;
    
    String finalUrl = path;
    if (!finalUrl.startsWith('http')) {
      final cleanPath = finalUrl.startsWith('/') ? finalUrl.substring(1) : finalUrl;
      finalUrl = '$assetBaseUrl$cleanPath';
    }
    
    // Fix localhost issue for Android Emulator
    if (finalUrl.contains('localhost')) {
      finalUrl = finalUrl.replaceAll('localhost:5001', host);
      finalUrl = finalUrl.replaceAll('localhost', '10.0.2.2');
    }
    
    return finalUrl;
  }
}

