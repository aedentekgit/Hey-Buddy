import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';

class BiometricService {
  final LocalAuthentication auth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    final bool canAuthenticateWithBiometrics = await auth.canCheckBiometrics;
    final bool isSupported = await auth.isDeviceSupported();
    return canAuthenticateWithBiometrics || isSupported;
  }

  Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await auth.getAvailableBiometrics();
    } on PlatformException catch (e) {
      debugPrint("Error getting available biometrics: $e");
      return <BiometricType>[];
    }
  }

  Future<bool> authenticate({
    String message = 'Authenticate to access your account',
  }) async {
    try {
      final bool didAuthenticate = await auth.authenticate(
        localizedReason: message,
      );
      return didAuthenticate;
    } on PlatformException catch (e) {
      debugPrint("Biometric authentication error: $e");
      return false;
    }
  }
}
