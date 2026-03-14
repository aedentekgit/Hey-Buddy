import 'package:flutter/foundation.dart';

class AppConfig {
  // FINAL PRODUCTION HOST
  static const String productionHost = 'ayuskart.com';
  // STAGING HOST (For Testing)
  static const String stagingHost = 'staging.ayuskart.com';
  // LOCAL HOST (For Device Debugging - using discovered local IP)
  static const String localhostHost = '10.0.2.2:5001'; 
  static const String webLocalhostHost = 'localhost:5001';

  static String get host {
    // Priority 1: Manual override via --dart-define=API_URL=...
    const String envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;

    // Priority 2: Use Localhost in Debug mode
    if (kDebugMode) {
      if (kIsWeb) return webLocalhostHost;
      return localhostHost;
    }
    
    // Priority 3: Default to Staging
    return stagingHost;
  }

  static String get protocol {
    // We use HTTP for Localhost, HTTPS for Staging/Production
    return (host == localhostHost || host == webLocalhostHost) ? 'http' : 'https';
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
  static String? googleClientId =
      "653874362760-32gca8aold1hap5s8271ad4803s959h5.apps.googleusercontent.com";
  static String googleMapsApiKey = "AIzaSyAdNgoVCokinFU6OD0pRxOg47RCmJ3kaA0";

  static String? formatImageUrl(String? path) {
    if (path == null || path.isEmpty || path == "null" || path == "undefined")
      return null;

    String finalPath = path;

    // 1. If it's already a full URL
    if (finalPath.startsWith('http')) {
      // Fix potential localhost/127.0.0.1 leakage from local DBs
      if (finalPath.contains('localhost:5001') ||
          finalPath.contains('127.0.0.1:5001') ||
          finalPath.contains('localhost:5002') ||
          finalPath.contains('127.0.0.1:5002')) {
        finalPath = finalPath
            .replaceAll('localhost:5001', host)
            .replaceAll('127.0.0.1:5001', host)
            .replaceAll('localhost:5002', host)
            .replaceAll('127.0.0.1:5002', host);

        // Crucial: After replacement, ensure protocol matches our current protocol
        // (Force HTTPS if we are on staging/production to avoid Cleartext blocks)
        if (host != localhostHost && finalPath.startsWith('http://')) {
          finalPath = finalPath.replaceFirst('http://', 'https://');
        }
      }
      return finalPath;
    }

    // 2. If it's a relative path, ensure it starts with 'uploads/' if it doesn't already
    // but first clean leading slashes
    if (finalPath.startsWith('/')) finalPath = finalPath.substring(1);

    // If the path doesn't already contain 'uploads/', the backend usually expects it
    if (!finalPath.startsWith('uploads/')) {
      finalPath = 'uploads/$finalPath';
    }

    // Force secure protocol for anything not on the local loopback
    String effectiveProtocol = host == localhostHost ? 'http' : 'https';
    return '$effectiveProtocol://$host/$finalPath';
  }
}
