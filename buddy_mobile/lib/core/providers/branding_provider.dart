import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/services/settings_service.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:shared_preferences/shared_preferences.dart';

class BrandingProvider extends ChangeNotifier {
  final SettingsService _settingsService = SettingsService();
  final SharedPreferences prefs;
  
  bool _isLoading = true;
  bool _hasError = false;
  String? _errorMessage;
  late String _appName;
  late Color _primaryColor;
  String? _logoUrl;
  String? _splashUrl;

  BrandingProvider(this.prefs) {
    _hydrateFromLocal();
  }

  void _hydrateFromLocal() {
    // Load from local storage for immediate render
    _appName = prefs.getString('branding_app_name') ?? AppConfig.appName;
    
    final colorHex = prefs.getString('branding_primary_color') ?? AppConfig.primaryColor;
    _primaryColor = _hexToColor(colorHex);
    
    _logoUrl = prefs.getString('branding_logo_url');
    _splashUrl = prefs.getString('branding_splash_url');
    
    // Sync to AppConfig for static access
    AppConfig.appName = _appName;
    AppConfig.primaryColor = colorHex;
    AppConfig.logoUrl = _logoUrl;
    AppConfig.splashUrl = _splashUrl;
    
    _isLoading = true; // Still loading fresh data from backend
  }

  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  String? get errorMessage => _errorMessage;
  String get appName => _appName;
  Color get primaryColor => _primaryColor;
  String? get logoUrl => _logoUrl;
  String? get splashUrl => _splashUrl;

  Future<void> fetchBranding() async {
    // Don't set _isLoading = true here if we already have local data to show
    // only if we want to show a spinner. But the user wants NO flash.
    try {
      final result = await _settingsService.getPublicSettings().timeout(const Duration(seconds: 10));
      if (result['success'] == true) {
        final data = result['data'];
        if (data != null) {
          final mobileApp = data['mobileApp'];
          final appearance = data['appearance'];
          
          if (mobileApp != null) {
            final newAppName = mobileApp['appName'] ?? AppConfig.appName;
            
            Color newPrimaryColor = _primaryColor;
            if (mobileApp['primaryColor'] != null && mobileApp['primaryColor'].toString().isNotEmpty) {
              newPrimaryColor = _hexToColor(mobileApp['primaryColor']);
            } else if (appearance != null && appearance['accentColor'] != null) {
              newPrimaryColor = _hexToColor(appearance['accentColor']);
            }
            
            String? newLogoUrl;
            if (mobileApp['appLogo'] != null) {
              String logoPath = mobileApp['appLogo'];
              if (logoPath.startsWith('/')) logoPath = logoPath.substring(1);
              newLogoUrl = '${AppConfig.assetBaseUrl}$logoPath';
            }
            
            String? newSplashUrl;
            if (mobileApp['splashIcon'] != null) {
              String splashPath = mobileApp['splashIcon'];
              if (splashPath.startsWith('/')) splashPath = splashPath.substring(1);
              newSplashUrl = '${AppConfig.assetBaseUrl}$splashPath';
            }

            // Update variables
            _appName = newAppName;
            _primaryColor = newPrimaryColor;
            _logoUrl = newLogoUrl;
            _splashUrl = newSplashUrl;

            // Persist for next run
            await prefs.setString('branding_app_name', _appName);
            await prefs.setString('branding_primary_color', '#${_primaryColor.value.toRadixString(16).substring(2)}');
            if (_logoUrl != null) await prefs.setString('branding_logo_url', _logoUrl!);
            if (_splashUrl != null) await prefs.setString('branding_splash_url', _splashUrl!);

            // Update AppConfig
            AppConfig.appName = _appName;
            AppConfig.primaryColor = '#${_primaryColor.value.toRadixString(16).substring(2)}';
            AppConfig.logoUrl = _logoUrl;
            AppConfig.splashUrl = _splashUrl;
          }
        }
      } else {
        _hasError = true;
        _errorMessage = result['message'] ?? 'Failed to fetch branding settings';
      }
    } catch (e) {
      // Don't show error if we have local data as fallback
      if (_appName == AppConfig.appName && _logoUrl == null) {
        _hasError = true;
        _errorMessage = e.toString();
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Color _hexToColor(String hex) {
    try {
      hex = hex.replaceAll('#', '');
      if (hex.length == 6) {
        hex = 'FF$hex';
      }
      return Color(int.parse(hex, radix: 16));
    } catch (e) {
      return const Color(0xFF6366F1);
    }
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
        elevation: 2,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: _primaryColor,
        side: BorderSide(color: _primaryColor, width: 1.2),
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return _primaryColor;
        return const Color(0xFFE2E8F0);
      }),
      thumbColor: WidgetStateProperty.all(Colors.white),
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
