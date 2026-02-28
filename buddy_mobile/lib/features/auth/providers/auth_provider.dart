import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/services/notification_service.dart';
import 'package:google_sign_in/google_sign_in.dart';
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
      // Step 1: Trigger Google Sign In
      final GoogleSignInAccount? account = await _googleSignIn.signIn();
      if (account == null) {
        _isLoading = false;
        notifyListeners();
        return false; // User cancelled
      }

      // Step 2: Get Authentication details
      final GoogleSignInAuthentication auth = await account.authentication;
      final String? idToken = auth.idToken;

      if (idToken == null) {
        debugPrint('Google Login Error: ID Token is null');
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // Step 3: Call backend
      final result = await _authService.googleLogin(idToken);
      
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
      }
    } catch (e) {
      debugPrint('Google Login Error: $e');
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> register(String name, String email, String password) async {
    _isLoading = true;
    notifyListeners();
    
    final result = await _authService.register(name, email, password);
    
    if (result['success'] == true) {
      _isLoading = false;
      notifyListeners();
      return true;
    }
    
    _isLoading = false;
    notifyListeners();
    return false;
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
}

