// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/services/settings_service.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

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

  String? _latestAppVersion;
  bool _mandatoryUpdate = false;
  String? _updateUrl;
  
  bool _isDarkMode = false;
  bool get isDarkMode => _isDarkMode;

  List<dynamic> _availableVoices = [];
  List<dynamic> get availableVoices => _availableVoices;

  BrandingProvider(this.prefs) {
    _hydrateFromLocal();
  }

  void _hydrateFromLocal() {
    // Load from local storage for immediate render
    _appName = prefs.getString('branding_app_name') ?? AppConfig.appName;

    final colorHex =
        prefs.getString('branding_primary_color') ?? AppConfig.primaryColor;
    _primaryColor = _hexToColor(colorHex);

    _logoUrl = prefs.getString('branding_logo_url');
    _splashUrl = prefs.getString('branding_splash_url');
    final savedClientId = prefs.getString('branding_google_client_id');
    final savedMapsKey = prefs.getString('branding_google_maps_api_key');

    // Sync to AppConfig for static access
    AppConfig.appName = _appName;
    AppConfig.primaryColor = colorHex;
    AppConfig.logoUrl = _logoUrl;
    AppConfig.splashUrl = _splashUrl;
    AppConfig.googleClientId = savedClientId;
    if (savedMapsKey != null) AppConfig.googleMapsApiKey = savedMapsKey;
    
    _isDarkMode = prefs.getBool('branding_is_dark_mode') ?? false;
    AppColors.setDarkMode(_isDarkMode);

    _isLoading = true; // Still loading fresh data from backend
  }
  
  Future<void> toggleDarkMode(bool isDark) async {
    _isDarkMode = isDark;
    await prefs.setBool('branding_is_dark_mode', isDark);
    AppColors.setDarkMode(isDark);
    notifyListeners();
  }

  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  String? get errorMessage => _errorMessage;
  String get appName => _appName;
  Color get primaryColor => _primaryColor;
  String? get logoUrl => _logoUrl;
  String? get splashUrl => _splashUrl;

  String? get latestAppVersion => _latestAppVersion;
  bool get mandatoryUpdate => _mandatoryUpdate;
  String? get updateUrl => _updateUrl;

  Future<void> fetchBranding() async {
    try {
      debugPrint(
        '[BRANDING] Fetching public settings from: ${AppConfig.baseUrl}',
      );
      final result = await _settingsService.getPublicSettings().timeout(
        const Duration(seconds: 30),
      );
      if (result['success'] == true) {
        final data = result['data'];
        if (data != null) {
          final mobileApp = data['mobileApp'];
          final appearance = data['appearance'];
          final ai = data['ai'];

          if (ai != null && ai['availableVoices'] != null) {
            _availableVoices = List<dynamic>.from(ai['availableVoices']);
          }

          if (mobileApp != null) {
            final newAppName = mobileApp['appName'] ?? AppConfig.appName;

            Color newPrimaryColor = _primaryColor;
            if (mobileApp['primaryColor'] != null &&
                mobileApp['primaryColor'].toString().isNotEmpty) {
              newPrimaryColor = _hexToColor(mobileApp['primaryColor']);
            } else if (appearance != null &&
                appearance['accentColor'] != null) {
              newPrimaryColor = _hexToColor(appearance['accentColor']);
            }

            String? newLogoUrl = AppConfig.formatImageUrl(mobileApp['appLogo']);
            String? newSplashUrl = AppConfig.formatImageUrl(
              mobileApp['splashIcon'],
            );

            // Capture Google Client ID
            String? newGoogleClientId;
            if (data['googleAuth'] != null) {
              newGoogleClientId = data['googleAuth']['webClientId'];
            }

            // Capture Google Maps Key
            String? newGoogleMapsApiKey;
            if (data['googleMaps'] != null &&
                data['googleMaps']['enabled'] == true) {
              newGoogleMapsApiKey = data['googleMaps']['apiKey'];
            }

            // Update variables
            _appName = newAppName;
            _primaryColor = newPrimaryColor;
            _logoUrl = newLogoUrl;
            _splashUrl = newSplashUrl;

            _latestAppVersion = mobileApp['latestAppVersion'];
            _mandatoryUpdate = mobileApp['mandatoryUpdate'] ?? false;
            _updateUrl = mobileApp['updateUrl'];

            // Persist for next run
            await prefs.setString('branding_app_name', _appName);
            await prefs.setString(
              'branding_primary_color',
              '#${_primaryColor.value.toRadixString(16).substring(2)}',
            );
            if (_logoUrl != null) {
              await prefs.setString('branding_logo_url', _logoUrl!);
            }
            if (_splashUrl != null) {
              await prefs.setString('branding_splash_url', _splashUrl!);
            }
            if (newGoogleClientId != null) {
              await prefs.setString(
                'branding_google_client_id',
                newGoogleClientId,
              );
            }
            if (newGoogleMapsApiKey != null) {
              await prefs.setString(
                'branding_google_maps_api_key',
                newGoogleMapsApiKey,
              );
            }

            // Update AppConfig
            AppConfig.appName = _appName;
            AppConfig.primaryColor =
                '#${_primaryColor.value.toRadixString(16).substring(2)}';
            AppConfig.logoUrl = _logoUrl;
            AppConfig.splashUrl = _splashUrl;
            if (newGoogleClientId != null) {
              AppConfig.googleClientId = newGoogleClientId;
            }
            if (newGoogleMapsApiKey != null) {
              AppConfig.googleMapsApiKey = newGoogleMapsApiKey;
            }
          }
        }
      } else {
        _hasError = true;
        _errorMessage =
            result['message'] ?? 'Failed to fetch branding settings';
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
    primaryColor: _primaryColor,
    brightness: _isDarkMode ? Brightness.dark : Brightness.light,
    colorScheme: ColorScheme.fromSeed(
      seedColor: _primaryColor,
      primary: _primaryColor,
      brightness: _isDarkMode ? Brightness.dark : Brightness.light,
      surface: AppColors.surface,
    ),
    // Enable swipe-to-go-back on ALL platforms (Android + iOS)
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: CupertinoPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.fuchsia: CupertinoPageTransitionsBuilder(),
      },
    ),
    textTheme: GoogleFonts.plusJakartaSansTextTheme(
      _isDarkMode ? ThemeData.dark().textTheme : ThemeData.light().textTheme,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: _isDarkMode ? AppColors.surface : Colors.grey[50],
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: _primaryColor, width: 2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: _primaryColor,
        foregroundColor: Colors.white,
        elevation: 2,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: GoogleFonts.outfit(
          fontSize: 16,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    switchTheme: SwitchThemeData(
      trackColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) return _primaryColor;
        return _isDarkMode ? const Color(0xFF4B5563) : const Color(0xFFE2E8F0);
      }),
      thumbColor: WidgetStateProperty.all(Colors.white),
      trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
    ),
    dropdownMenuTheme: DropdownMenuThemeData(
      textStyle: GoogleFonts.outfit(fontSize: 14),
      menuStyle: MenuStyle(
        backgroundColor: WidgetStateProperty.all(AppColors.surface),
        elevation: WidgetStateProperty.all(8),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStateProperty.all(AppColors.surface),
        elevation: WidgetStateProperty.all(8),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
    ),
  );
}
