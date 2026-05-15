import "package:flutter/foundation.dart";

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:buddy_mobile/core/config/app_config.dart';

class LocationReminderService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String get _baseUrl => AppConfig.baseUrl;

  Future<Map<String, dynamic>> fetchLocationReminders() async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.get(
        Uri.parse('${_baseUrl}location-reminders?_t=${DateTime.now().millisecondsSinceEpoch}'),
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
      debugPrint("Error fetching location reminders: $e");
      return {'success': false, 'data': []};
    }
  }

  Future<bool> createLocationReminder(Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.post(
        Uri.parse('${_baseUrl}location-reminders'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode(data),
      );
      return response.statusCode == 201 || response.statusCode == 200;
    } catch (e) {
      debugPrint("Error creating location reminder: $e");
      return false;
    }
  }

  Future<bool> updateLocationReminder(
    String id,
    Map<String, dynamic> data,
  ) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.put(
        Uri.parse('${_baseUrl}location-reminders/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode(data),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error updating location reminder: $e");
      return false;
    }
  }

  Future<bool> deleteLocationReminder(String id) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.delete(
        Uri.parse('${_baseUrl}location-reminders/$id'),
        headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error deleting location reminder: $e");
      return false;
    }
  }

  Future<bool> setEarlyWarning(String id, Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.post(
        Uri.parse('${_baseUrl}location-reminders/$id/early-warning'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode(data),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error setting early warning: $e");
      return false;
    }
  }

  Future<bool> setFamilyBackup(String id) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final response = await http.post(
        Uri.parse('${_baseUrl}location-reminders/$id/family-backup'),
        headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint("Error setting family backup: $e");
      return false;
    }
  }
}
