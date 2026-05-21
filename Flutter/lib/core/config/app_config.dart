import 'dart:io';
import 'package:flutter/foundation.dart';

class AppConfig {
  // FINAL PRODUCTION HOST
  static const String productionHost = 'ayuskart.com';
  // STAGING HOST (For Testing)
  static const String stagingHost = 'staging.ayuskart.com';
  // LOCAL HOST (For Device Debugging)
  static const String androidLocalhostHost = '10.0.2.2:5001';
  static const String iosLocalhostHost = 'localhost:5001';
  static const String webLocalhostHost = 'localhost:5001';

  static String get localhostHost {
    // Use platform-specific localhost address
    if (kIsWeb) return webLocalhostHost;
    if (Platform.isAndroid) return androidLocalhostHost;
    if (Platform.isIOS) return iosLocalhostHost;
    return 'localhost:5001'; // Default for other platforms
  }

  // Developer override
  static String? customHostOverride;

  static String get host {
    // Priority 0: Custom Host Override configured in Developer Settings
    if (customHostOverride != null && customHostOverride!.isNotEmpty) {
      return customHostOverride!;
    }

    // Priority 1: Manual override via --dart-define=API_URL=...
    const String envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;
    
    // Priority 2: In debug mode, auto-detect local development address
    if (kDebugMode) {
      return localhostHost;
    }

    // Priority 3: Default to Production (Live) for release builds
    return productionHost;
  }


  static String get protocol {
    final String currentHost = host.toLowerCase();
    
    // Check if host matches common local IP patterns or localhost
    final bool isLocal = currentHost.contains('localhost') ||
        currentHost.contains('127.0.0.1') ||
        currentHost.contains('10.0.2.2') ||
        RegExp(r'^192\.168\.').hasMatch(currentHost) ||
        RegExp(r'^172\.(1[6-9]|2[0-9]|3[0-1])\.').hasMatch(currentHost) ||
        RegExp(r'^10\.').hasMatch(currentHost);
        
    return isLocal ? 'http' : 'https';
  }

  static String get baseUrl {
    return '$protocol://$host/api/';
  }

  static String get socketUrl {
    return '$protocol://$host';
  }

  static String get voiceWsUrl {
    final String baseHost = host.contains(':') ? host.split(':')[0] : host;
    final String scheme = protocol == 'https' ? 'wss' : 'ws';
    
    // Use path-based routing for production to avoid firewall/port issues
    if (baseHost == productionHost) {
      return '$scheme://$baseHost/voice-ws';
    }
    
    // Dynamic port based on environment for staging/local
    int port = 5002; // Default for local / default
    if (baseHost == stagingHost) {
      port = 5008;
    }
    return '$scheme://$baseHost:$port';
  }

  static String get controlHttpUrl {
    final String baseHost = host.contains(':') ? host.split(':')[0] : host;
    
    // Use path-based routing for production to avoid firewall/port issues
    if (baseHost == productionHost) {
      return '$protocol://$baseHost/control';
    }
    
    // Dynamic port based on environment for staging/local
    int port = 5003; // Default for local / default
    if (baseHost == stagingHost) {
      port = 5007;
    }
    return '$protocol://$baseHost:$port';
  }

  static String get assetBaseUrl {
    return '$protocol://$host/';
  }

  // Default branding (to be updated from API)
  static String appName = 'HeyBuddy';
  static String primaryColor = '#6C3AFF'; // Professional Vivid Purple
  static String secondaryColor = '#FFFFFF';
  static String? logoUrl;
  static String? splashUrl;
  static String? googleClientId;
  static String googleMapsApiKey = "";

  static String? formatImageUrl(String? path) {
    if (path == null || path.isEmpty || path == "null" || path == "undefined") {
      return null;
    }

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
        if (!host.contains('localhost') && !host.contains('10.0.2.2') && finalPath.startsWith('http://')) {
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
    String effectiveProtocol = (host.contains('localhost') || host.contains('10.0.2.2')) ? 'http' : 'https';
    return '$effectiveProtocol://$host/$finalPath';
  }
}
