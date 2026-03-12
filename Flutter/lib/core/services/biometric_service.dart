import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart';
import 'package:local_auth_darwin/local_auth_darwin.dart';
import 'package:flutter/services.dart';

class BiometricService {
  final LocalAuthentication auth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    final bool canAuthenticateWithBiometrics = await auth.canCheckBiometrics;
    final bool canAuthenticate = canAuthenticateWithBiometrics || await auth.isDeviceSupported();
    return canAuthenticate;
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await auth.getAvailableBiometrics();
    } on PlatformException catch (e) {
      print("Error getting available biometrics: $e");
      return <BiometricType>[];
    }
  }

  Future<bool> authenticate({String message = 'Authenticate to access your account'}) async {
    try {
      final bool didAuthenticate = await auth.authenticate(
        localizedReason: message,
      );
      return didAuthenticate;
    } on PlatformException catch (e) {
      print("Biometric authentication error: $e");
      // Handle too many attempts or other specific errors if needed
      return false;
    }
  }
}
