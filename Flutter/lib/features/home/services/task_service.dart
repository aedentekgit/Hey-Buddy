import "package:flutter/foundation.dart";

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

import 'package:buddy_mobile/core/config/app_config.dart';

class TaskService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String get _baseUrl => AppConfig.baseUrl;

  Future<Map<String, dynamic>> fetchReminders({
    int page = 1,
    int limit = 100, // Increased default for mobile calendar views
    String search = '',
    String? start,
    String? end,
  }) async {
    try {
      final token = await _storage.read(key: 'jwt');

      String url = '${_baseUrl}voice?page=$page&limit=$limit&search=$search';
      if (start != null && end != null) {
        url += '&start=$start&end=$end';
      }
      url += '&_t=${DateTime.now().millisecondsSinceEpoch}';

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'data': []};
    } catch (e) {
      debugPrint("Error fetching reminders: $e");
      return {'success': false, 'data': []};
    }
  }

  Future<bool> deleteReminder(String id) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.delete(
        Uri.parse('${_baseUrl}voice/$id'),
        headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
      );

      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error deleting reminder: $e");
      return false;
    }
  }

  Future<bool> updateReminder(String id, Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.put(
        Uri.parse('${_baseUrl}voice/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode(data),
      );

      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error updating reminder: $e");
      return false;
    }
  }

  Future<bool> createReminder(Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.post(
        Uri.parse('${_baseUrl}voice/save'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({
          'reminderData': {
            ...data,
            'intent': 'manual_creation',
            'repeat': false,
          },
          'saveTo': 'both',
        }),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      debugPrint("Error creating reminder: $e");
      return false;
    }
  }

  Future<Map<String, dynamic>?> fetchTravelStats(
    String id, {
    double? lat,
    double? lng,
  }) async {
    try {
      final token = await _storage.read(key: 'jwt');
      String url = '${_baseUrl}reminders/$id/travel-stats';
      if (lat != null && lng != null) {
        url += '?lat=$lat&lng=$lng';
      }

      final response = await http.get(
        Uri.parse(url),
        headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
      );

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          return body['data'];
        }
      }
      return null;
    } catch (e) {
      debugPrint("Error fetching travel stats: $e");
      return null;
    }
  }

  Future<bool> unshareReminder(String reminderId, String userId) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.delete(
        Uri.parse('${_baseUrl}reminders/$reminderId/unshare/$userId'),
        headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error unsharing reminder: $e");
      return false;
    }
  }

  /// Calls POST /reminders/adjusted-notification and returns the adjusted time string.
  /// Returns null on failure.
  Future<Map<String, dynamic>?> fetchAdjustedNotification({
    required String pickupTime,
    required int travelMinutes,
    required int bufferMinutes,
    String timeFormat = '12',
  }) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.post(
        Uri.parse('${_baseUrl}reminders/adjusted-notification'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({
          'pickup_time': pickupTime,
          'estimated_travel_time_minutes': travelMinutes,
          'safety_buffer_minutes': bufferMinutes,
          'time_format': timeFormat,
        }),
      );
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) return body;
      }
      return null;
    } catch (e) {
      debugPrint("Error fetching adjusted notification: $e");
      return null;
    }
  }

  Future<Map<String, dynamic>> fetchCalendarStats({String? start, String? end}) async {
    try {
      final token = await _storage.read(key: 'jwt');
      String url = '${_baseUrl}reminders/calendar-stats';
      if (start != null && end != null) {
        url += '?start=$start&end=$end';
      }

      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'data': {}};
    } catch (e) {
      debugPrint("Error fetching calendar stats: $e");
      return {'success': false, 'data': {}};
    }
  }
}
