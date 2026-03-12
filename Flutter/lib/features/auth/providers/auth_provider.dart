import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/services/notification_service.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
  final NotificationService _notificationService = NotificationService();
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );
  
  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    webOptions: WebOptions(
      dbName: 'BuddyStore',
      publicKey: 'BuddyKey',
    ),
  );
  
  bool _isLoading = false;
  bool get isLoading => _isLoading;
  
  String? _token;
  String? get token => _token;

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final result = await _authService.login(email, password);
      
      if (result['success'] == true && result['data'] != null) {
        final data = result['data'];
        _token = data['token']; 
        
        if (_token != null) {
          await _storage.write(key: 'jwt', value: _token);
          
          // Trigger FCM Token update now that we have the auth token
          _notificationService.updateToken();

          _isLoading = false;
          notifyListeners();
          return true;
        }
      }
    } catch (e) {
      debugPrint('Login Error: $e');
    }
    
    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> googleLogin() async {
    _isLoading = true;
    notifyListeners();

    try {
      debugPrint('[AUTH] Starting Google Sign-In with Server Client ID: ${AppConfig.googleClientId}');
      
      // Step 1: Trigger Google Sign In 
      // Passing the serverClientId is VITAL for Android to receive an idToken
      final googleSignInInstance = GoogleSignIn(
        serverClientId: AppConfig.googleClientId,
        scopes: ['email', 'profile', 'https://www.googleapis.com/auth/calendar'],
        forceCodeForRefreshToken: true,
      );

      final GoogleSignInAccount? account = await googleSignInInstance.signIn();
      
      if (account == null) {
        _isLoading = false;
        notifyListeners();
        return false; // User cancelled
      }

      // Step 2: Get Authentication details
      final GoogleSignInAuthentication auth = await account.authentication;
      final String? idToken = auth.idToken;

      if (idToken == null) {
        final errorMsg = 'Google Login Error: ID Token is null. Check if Web Client ID is correct in Admin Settings.';
        debugPrint(errorMsg);
        ToastUtils.showErrorToast('Google Login Failed: Missing ID Token');
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Step 3: Call backend
      final String? serverAuthCode = account.serverAuthCode;
      debugPrint('[AUTH] Received Server Auth Code: ${serverAuthCode != null ? "YES" : "NO"}');
      
      final result = await _authService.googleLogin(idToken, serverAuthCode: serverAuthCode);
      
      if (result['success'] == true && result['data'] != null) {
        final data = result['data'];
        _token = data['token'];
        
        if (_token != null) {
          await _storage.write(key: 'jwt', value: _token);
          _notificationService.updateToken();
          
          _isLoading = false;
          notifyListeners();
          return true;
        }
      } else {
         final backendMsg = result['message'] ?? 'Backend verification failed';
         debugPrint('[AUTH] Backend Error: $backendMsg');
         ToastUtils.showErrorToast(backendMsg);
      }
    } catch (e) {
      debugPrint('Google Login Exception: $e');
      ToastUtils.showErrorToast('Google Error: ${e.toString()}');
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    try {
      final result = await _authService.register(name, email, password);
      return result;
    } catch (e) {
      debugPrint('Registration Exception: $e');
      return {'success': false, 'message': e.toString()};
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _token = null;
    await _storage.delete(key: 'jwt');
    try {
      await _googleSignIn.signOut();
    } catch (e) {
      debugPrint('Error signing out from Google: $e');
    }
    notifyListeners();
  }

  Future<void> tryAutoLogin() async {
    _token = await _storage.read(key: 'jwt');
    if (_token != null) {
      _notificationService.updateToken();
    }
    notifyListeners();
  }
  Future<bool> forgotPassword(String email) async {
    _isLoading = true;
    notifyListeners();
    
    final result = await _authService.forgotPassword(email);
    
    _isLoading = false;
    notifyListeners();
    
    if (result['success'] == true) {
      ToastUtils.showSuccessToast(result['message'] ?? 'OTP sent to your email');
      return true;
    } else {
      ToastUtils.showErrorToast(result['message'] ?? 'Failed to send OTP');
      return false;
    }
  }

  Future<bool> verifyResetOtp(String email, String otp) async {
    _isLoading = true;
    notifyListeners();
    
    final result = await _authService.verifyResetOtp(email, otp);
    
    _isLoading = false;
    notifyListeners();
    
    if (result['success'] == true) {
      return true;
    } else {
       ToastUtils.showErrorToast(result['message'] ?? 'Invalid OTP');
      return false;
    }
  }

  Future<bool> resetPassword(String email, String otp, String newPassword) async {
    _isLoading = true;
    notifyListeners();
    
    final result = await _authService.resetPassword(email, otp, newPassword);
    
    _isLoading = false;
    notifyListeners();
    
    if (result['success'] == true) {
      ToastUtils.showSuccessToast('Password reset successfully');
      return true;
    } else {
      ToastUtils.showErrorToast(result['message'] ?? 'Password reset failed');
      return false;
    }
  }

  Future<bool> changePassword(String currentPassword, String newPassword) async {
    if (_token == null) return false;
    _isLoading = true;
    notifyListeners();

    try {
      final result = await _authService.changePassword(currentPassword, newPassword, _token!);
      if (result['success'] == true) {
        ToastUtils.showSuccessToast('Password updated successfully');
        return true;
      } else {
        ToastUtils.showErrorToast(result['message'] ?? 'Failed to update password');
        return false;
      }
    } catch (e) {
      ToastUtils.showErrorToast('Something went wrong');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

