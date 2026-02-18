import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;

class TaskService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String get _baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:5001/api';
    return 'http://localhost:5001/api';
  }

  Future<Map<String, dynamic>> fetchReminders({int page = 1, int limit = 10, String search = ''}) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.get(
        Uri.parse('$_baseUrl/voice?page=$page&limit=$limit&search=$search'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'data': []};
    } catch (e) {
      print("Error fetching reminders: $e");
      return {'success': false, 'data': []};
    }
  }

  Future<bool> deleteReminder(String id) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.delete(
        Uri.parse('$_baseUrl/voice/$id'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error deleting reminder: $e");
      return false;
    }
  }

  Future<bool> updateReminder(String id, Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.put(
        Uri.parse('$_baseUrl/voice/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode(data),
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error updating reminder: $e");
      return false;
    }
  }

  Future<bool> createReminder(Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.post(
        Uri.parse('$_baseUrl/voice/save'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'reminderData': {
            ...data,
            'intent': 'manual_creation',
            'repeat': false,
          },
          'saveTo': 'buddy',
        }),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print("Error creating reminder: $e");
      return false;
    }
  }
}
