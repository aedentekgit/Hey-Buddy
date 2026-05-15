import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/biometric_service.dart';

class SecurityProvider with ChangeNotifier {
  final BiometricService _biometricService = BiometricService();
  bool _isBiometricEnabled = false;
  bool _isHardwareAvailable = false;

  bool get isBiometricEnabled => _isBiometricEnabled;
  bool get isHardwareAvailable => _isHardwareAvailable;

  SecurityProvider() {
    _loadPreferences();
    _checkHardware();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    _isBiometricEnabled = prefs.getBool('biometric_enabled') ?? false;
    notifyListeners();
  }

  Future<void> _checkHardware() async {
    _isHardwareAvailable = await _biometricService.isBiometricAvailable();
    notifyListeners();
  }

  Future<bool> toggleBiometric(bool enabled) async {
    if (enabled) {
      // Must authenticate to enable
      final success = await _biometricService.authenticate(
        message: 'Authenticate to enable biometric login',
      );
      if (success) {
        _isBiometricEnabled = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('biometric_enabled', true);
        notifyListeners();
        return true;
      }
      return false;
    } else {
      _isBiometricEnabled = false;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('biometric_enabled', false);
      notifyListeners();
      return true;
    }
  }

  Future<bool> authenticate() async {
    if (!_isBiometricEnabled) return true;
    return await _biometricService.authenticate();
  }

  Future<bool> hasBeenPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('biometric_prompted') ?? false;
  }

  Future<void> setPrompted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_prompted', true);
  }
}
