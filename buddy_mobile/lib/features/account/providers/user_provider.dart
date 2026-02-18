import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:buddy_mobile/features/account/services/user_service.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class UserProvider extends ChangeNotifier {
  final UserService _userService = UserService();
  
  // Use a map or a User model (Map for flexibility for now)
  Map<String, dynamic> _user = {};
  bool _isLoading = false;
  String _error = '';

  Map<String, dynamic> get user => _user;
  bool get isLoading => _isLoading;
  String get error => _error;

  // Initialize
  Future<void> loadProfile() async {
    _isLoading = true;
    _error = '';
    notifyListeners();

    try {
      final fetched = await _userService.getUserProfile();
      if (fetched.isNotEmpty) {
        _user = Map<String, dynamic>.from(fetched);
        if (_user['profilePicture'] != null) {
          _user['profilePicture'] = _formatProfilePictureUrl(_user['profilePicture']);
        }
      }
    } catch (e) {
      _error = 'Failed to load profile';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Update Profile
  Future<bool> updateProfile(String name, String phone, String address) async {
    _isLoading = true;
    notifyListeners();

    try {
      // Optimistically update local state if we want, but wait for backend confirmation
      final success = await _userService.updateProfile({
        'name': name,
        'phone': phone,
        'address': address,
      });

      if (success) {
        _user['name'] = name;
        _user['phone'] = phone;
        _user['address'] = address;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString();
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Upload/Change Avatar
  Future<bool> updateAvatar(File file) async {
    _isLoading = true;
    notifyListeners();

    try {
      final newUrl = await _userService.uploadProfilePicture(file);
      if (newUrl != null) {
        _user['profilePicture'] = _formatProfilePictureUrl(newUrl);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to upload image';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Remove Avatar
  Future<bool> removeAvatar() async {
    _isLoading = true;
    notifyListeners();

    try {
      final success = await _userService.deleteProfilePicture();
      if (success) {
        _user['profilePicture'] = null;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Delete Account
  Future<bool> deleteAccount() async {
    _isLoading = true;
    notifyListeners();

    try {
      final success = await _userService.deleteAccount();
      // If success, AuthProvider should handle logout
      return success;
    } catch (e) {
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  String _formatProfilePictureUrl(String path) {
    if (path.startsWith('http')) return path;
    return '${AppConfig.assetBaseUrl}$path';
  }
}
