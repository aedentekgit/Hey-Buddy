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
  Color _primaryColor = AppConfig.primaryColor.startsWith('#') 
      ? Color(int.parse(AppConfig.primaryColor.replaceAll('#', 'FF'), radix: 16))
      : const Color(0xFF6366F1); // Indigo default from AppConfig
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
          final appearance = data['appearance'];
          
          if (mobileApp != null) {
            _appName = mobileApp['appName'] ?? AppConfig.appName;
            
            // 1. Prioritize Mobile Specific Color
            if (mobileApp['primaryColor'] != null && mobileApp['primaryColor'].toString().isNotEmpty) {
              _primaryColor = _hexToColor(mobileApp['primaryColor']);
            } 
            // 2. Fallback to Global Theme Accent Color
            else if (appearance != null && appearance['accentColor'] != null) {
              _primaryColor = _hexToColor(appearance['accentColor']);
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
            AppConfig.primaryColor = '#${_primaryColor.value.toRadixString(16).substring(2)}';
            AppConfig.logoUrl = _logoUrl;
            AppConfig.splashUrl = _splashUrl;
          } else if (appearance != null && appearance['accentColor'] != null) {
            // Even if mobileApp config is missing, try to follow global theme
            _primaryColor = _hexToColor(appearance['accentColor']);
            AppConfig.primaryColor = '#${_primaryColor.value.toRadixString(16).substring(2)}';
          }
        }
      } else {
        _hasError = true;
        _errorMessage = result['message'] ?? 'Failed to fetch branding settings';
        debugPrint('[Branding] Failed to fetch: $_errorMessage');
      }
    } catch (e) {
      _hasError = true;
      _errorMessage = e.toString();
      debugPrint('[Branding] Error fetching branding: $e');
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
      debugPrint('[Branding] Hex color parsing failed for "$hex": $e');
      return const Color(0xFF6366F1); // Return default indigo on error
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
        backgroundColor: _primaryColor, // Changed from ghostly to solid primary
        foregroundColor: Colors.white,   // Better contrast for theme color
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
