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
  Future<bool> updateProfile(String name, String phone, String address, {String? dateFormat, String? timeFormat}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = {
        'name': name,
        'phone': phone,
        'address': address,
      };
      if (dateFormat != null) data['dateFormat'] = dateFormat;
      if (timeFormat != null) data['timeFormat'] = timeFormat;
      
      final success = await _userService.updateProfile(data);

      if (success) {
        _user['name'] = name;
        _user['phone'] = phone;
        _user['address'] = address;
        if (dateFormat != null) _user['dateFormat'] = dateFormat;
        if (timeFormat != null) _user['timeFormat'] = timeFormat;
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

  // Update Notification Preferences
  Future<bool> updateNotificationPreferences(Map<String, dynamic> prefs) async {
    notifyListeners();
    try {
      // Optimistic update
      final currentPrefs = _user['notificationPreferences'] as Map<String, dynamic>? ?? {};
      final newPrefs = {...currentPrefs, ...prefs};
      
      final success = await _userService.updateProfile({
        'notificationPreferences': newPrefs
      });

      if (success) {
        _user['notificationPreferences'] = newPrefs;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString();
      return false;
    }
  }

  // Update Voice Preferences
  Future<bool> updateVoicePreferences(Map<String, dynamic> prefs) async {
    notifyListeners();
    try {
      final currentPrefs = _user['voicePreferences'] as Map<String, dynamic>? ?? {};
      final newPrefs = {...currentPrefs, ...prefs};
      
      final success = await _userService.updateProfile({
        'voicePreferences': newPrefs
      });

      if (success) {
        _user['voicePreferences'] = newPrefs;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString();
      return false;
    }
  }

  // Unlink Google Calendar
  Future<bool> unlinkCalendar() async {
    _isLoading = true;
    notifyListeners();

    try {
      final success = await _userService.unlinkCalendar();
      if (success) {
        _user['googleRefreshToken'] = null;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = 'Failed to unlink calendar';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Get Google Auth URL
  Future<String?> getGoogleAuthUrl() async {
    _isLoading = true;
    notifyListeners();
    try {
      final url = await _userService.getGoogleAuthUrl();
      return url;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Update Location
  Future<bool> updateLocation(double lat, double lng) async {
    try {
      final success = await _userService.updateLocation(lat, lng);
      if (success) {
        _user['currentLocation'] = {
          'lat': lat,
          'lng': lng,
          'timestamp': DateTime.now().toIso8601String(),
        };
        notifyListeners();
      }
      return success;
    } catch (e) {
      print("Error in updateLocation provider: $e");
      return false;
    }
  }

  String? _formatProfilePictureUrl(String path) {
    return AppConfig.formatImageUrl(path);
  }
}



