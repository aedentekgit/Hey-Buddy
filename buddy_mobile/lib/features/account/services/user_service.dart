import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http_parser/http_parser.dart';

class UserService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Helper to get base URL (matches other services)
  String get _baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:5001/api';
    return 'http://localhost:5001/api';
  }

  Future<String?> _getToken() async {
    return await _storage.read(key: 'jwt');
  }

  // Get User Profile
  Future<Map<String, dynamic>> getUserProfile() async {
    try {
      final token = await _getToken();
      final url = '$_baseUrl/auth/me';

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
      );


      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          return data['data'];
        }
      }
      print("[UserService] Failed to parse success");
      return {};
    } catch (e) {
      print("[UserService] Error fetching profile: $e");
      return {};
    }
  }

  // Update Profile
  Future<bool> updateProfile(Map<String, dynamic> data) async {
    try {
      final token = await _getToken();
      final response = await http.put(
        Uri.parse('$_baseUrl/users/profile'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode(data),

      );

      return response.statusCode == 200;
    } catch (e) {
      print("[UserService] Error updating profile: $e");
      return false;
    }
  }

  // Upload Profile Picture
  Future<String?> uploadProfilePicture(File file) async {
    try {
      final token = await _getToken();
      var request = http.MultipartRequest('POST', Uri.parse('$_baseUrl/users/profile/avatar'));
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['x-platform'] = 'mobile';

      // Check file extension for mime type
      String extension = file.path.split('.').last.toLowerCase();
      MediaType mediaType;
      if (extension == 'png') {
        mediaType = MediaType('image', 'png');
      } else if (extension == 'jpg' || extension == 'jpeg') {
        mediaType = MediaType('image', 'jpeg');
      } else {
        mediaType = MediaType('image', 'jpeg'); // Default
      }

      request.files.add(await http.MultipartFile.fromPath(
        'profilePicture',
        file.path,
        contentType: mediaType,
      ));

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          return data['data']['profilePicture'];
        }
      }
      print("[UserService] Upload failed: ${response.statusCode} - ${response.body}");
      return null;
    } catch (e) {
      print("[UserService] Error uploading avatar: $e");
      return null;
    }
  }

  // Delete Profile Picture
  Future<bool> deleteProfilePicture() async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('$_baseUrl/users/profile/avatar'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print("[UserService] Error deleting avatar: $e");
      return false;
    }
  }

  // Delete Account
  Future<bool> deleteAccount() async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('$_baseUrl/users/profile'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print("[UserService] Error deleting account: $e");
      return false;
    }
  }
}
