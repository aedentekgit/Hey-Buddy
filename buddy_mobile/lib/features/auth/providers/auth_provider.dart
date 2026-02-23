import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../services/auth_service.dart';

class AuthProvider with ChangeNotifier {
  final AuthService _authService = AuthService();
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
    notifyListeners();
  }

  Future<void> tryAutoLogin() async {
    _token = await _storage.read(key: 'jwt');
    notifyListeners();
  }
}
