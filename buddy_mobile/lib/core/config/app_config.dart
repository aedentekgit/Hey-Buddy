import 'package:flutter/foundation.dart';
import 'dart:io';

class AppConfig {
  // FINAL PRODUCTION HOST (Matches Website)
  static const String productionHost = 'ayuskart.com';

  static String get host {
    return productionHost;
  }

  static String get protocol {
    return 'https';
  }

  static String get baseUrl {
    return '$protocol://$host/api/';
  }

  static String get assetBaseUrl {
    return 'https://$host/';
  }
  
  // Default branding (to be updated from API)
  static String appName = 'HeyBuddy';
  static String primaryColor = '#6366F1'; 
  static String secondaryColor = '#FFFFFF';
  static String? logoUrl;
  static String? splashUrl;
}
