import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/services/settings_service.dart';
import 'package:google_fonts/google_fonts.dart';

class BrandingProvider extends ChangeNotifier {
  final SettingsService _settingsService = SettingsService();
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  String _appName = AppConfig.appName;
  Color _primaryColor = const Color(0xFF004D40);
  String? _logoUrl;
  String? _splashUrl;

  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  String? get errorMessage => _errorMessage;
  String get appName => _appName;
  Color get primaryColor => _primaryColor;
  String? get logoUrl => _logoUrl;
  String? get splashUrl => _splashUrl;

  Future<void> fetchBranding() async {
    _isLoading = true;
    _hasError = false;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _settingsService.getPublicSettings().timeout(const Duration(seconds: 10));
      if (result['success'] == true) {
        final data = result['data'];
        if (data != null) {
          final mobileApp = data['mobileApp'];
          if (mobileApp != null) {

            _appName = mobileApp['appName'] ?? AppConfig.appName;
            
            if (mobileApp['primaryColor'] != null) {
              _primaryColor = _hexToColor(mobileApp['primaryColor']);
            }
            
            if (mobileApp['appLogo'] != null) {
              String logoPath = mobileApp['appLogo'];
              if (logoPath.startsWith('/')) logoPath = logoPath.substring(1);
              _logoUrl = '${AppConfig.assetBaseUrl}$logoPath';
            }
            
            if (mobileApp['splashIcon'] != null) {
              String splashPath = mobileApp['splashIcon'];
              if (splashPath.startsWith('/')) splashPath = splashPath.substring(1);
              _splashUrl = '${AppConfig.assetBaseUrl}$splashPath';
            }

            // Update AppConfig for static access where needed
            AppConfig.appName = _appName;
            AppConfig.logoUrl = _logoUrl;
            AppConfig.splashUrl = _splashUrl;
          }
        }
        // If data is null, we just keep the default values without setting _hasError
      } else {
        // Log error but don't stop the app from opening unless it's critical
        debugPrint('[Branding] Failed to fetch: ${result['message']}');
      }
    } catch (e) {
      debugPrint('[Branding] Unreachable: $e');
      // We don't set _hasError = true here anymore to allow the app to at least open the login screen
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
        backgroundColor: _primaryColor.withOpacity(0.05),
        foregroundColor: _primaryColor,
        elevation: 0,
        side: BorderSide(color: _primaryColor.withOpacity(0.2), width: 1.2),
        minimumSize: const Size(double.infinity, 46),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: GoogleFonts.outfit(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        backgroundColor: const Color(0xFFF1F5F9),
        foregroundColor: const Color(0xFF64748B),
        elevation: 0,
        side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
        minimumSize: const Size(double.infinity, 46),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: GoogleFonts.outfit(
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return Colors.white;
        return Colors.white;
      }),
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return _primaryColor;
        return const Color(0xFF94A3B8); // Distinct ash gray
      }),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    dropdownMenuTheme: DropdownMenuThemeData(
      textStyle: GoogleFonts.outfit(fontSize: 14),
      menuStyle: MenuStyle(
        backgroundColor: WidgetStateProperty.all(Colors.white),
        elevation: WidgetStateProperty.all(8),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStateProperty.all(Colors.white),
        elevation: WidgetStateProperty.all(8),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    ),
  );
}
