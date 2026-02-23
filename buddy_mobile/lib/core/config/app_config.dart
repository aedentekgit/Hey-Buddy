import 'package:flutter/foundation.dart';
import 'dart:io';

class AppConfig {
  // FINAL PRODUCTION HOST (Matches Website)
  static const String productionHost = '82.29.167.22';

  static String get host {
    // If running on a real device or emulator, we almost always want the production host
    // unless specifically debugging against a local machine.
    if (kDebugMode) {
      if (kIsWeb) return 'localhost';
      // If you are using a local backend with emulator, use 10.0.2.2
      // For now, let's point to the production host to ensure the APK/Run works end-to-end
      return productionHost; 
    }
    return productionHost;
  }

  static String get protocol {
    return kDebugMode ? 'http' : 'http'; // Keeping http for now as per nginx config, but ready for https
  }

  static String get baseUrl {
    // Standardizing to port 80/443 for production host
    return 'http://$host/api/';
  }

  static String get assetBaseUrl {
    if (kDebugMode) {
      return 'http://$host:5001/';
    }
    return 'http://$host/';
  }
  
  // Default branding (to be updated from API)
  static String appName = 'HeyBuddy';
  static String primaryColor = '#6366F1'; 
  static String secondaryColor = '#FFFFFF';
  static String? logoUrl;
  static String? splashUrl;
}
