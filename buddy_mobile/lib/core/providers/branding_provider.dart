import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/services/settings_service.dart';
import 'package:google_fonts/google_fonts.dart';

class BrandingProvider extends ChangeNotifier {
  final SettingsService _settingsService = SettingsService();
  bool _isLoading = true;
  String _appName = AppConfig.appName;
  Color _primaryColor = const Color(0xFF004D40);
  String? _logoUrl;
  String? _splashUrl;

  bool get isLoading => _isLoading;
  String get appName => _appName;
  Color get primaryColor => _primaryColor;
  String? get logoUrl => _logoUrl;
  String? get splashUrl => _splashUrl;

  Future<void> fetchBranding() async {
    _isLoading = true;
    notifyListeners();

    final result = await _settingsService.getPublicSettings();
    if (result['success'] == true && result['data'] != null) {
      final data = result['data'];
      final mobileApp = data['mobileApp'];

      if (mobileApp != null) {
        _appName = mobileApp['appName'] ?? AppConfig.appName;
        
        if (mobileApp['primaryColor'] != null) {
          _primaryColor = _hexToColor(mobileApp['primaryColor']);
        }
        
        if (mobileApp['appLogo'] != null) {
          _logoUrl = '${AppConfig.assetBaseUrl}${mobileApp['appLogo']}';
        }
        
        if (mobileApp['splashIcon'] != null) {
          _splashUrl = '${AppConfig.assetBaseUrl}${mobileApp['splashIcon']}';
        }

        // Update AppConfig for static access where needed
        AppConfig.appName = _appName;
        AppConfig.logoUrl = _logoUrl;
        AppConfig.splashUrl = _splashUrl;
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) {
      hex = 'FF$hex';
    }
    return Color(int.parse(hex, radix: 16));
  }

  ThemeData get themeData => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primaryColor,
      primary: _primaryColor,
      surface: Colors.white,
    ),
    textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.grey[50],
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[300]!),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: Colors.grey[200]!),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: _primaryColor, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 56),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    ),
  );
}
