import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class FamilyService {
  final _storage = const FlutterSecureStorage();

  Future<Map<String, String>> _getHeaders() async {
    final token = await _storage.read(key: 'jwt');
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<Map<String, dynamic>> sendRequest(String email) async {
    final response = await http.post(
      Uri.parse('${AppConfig.baseUrl}family/request'),
      headers: await _getHeaders(),
      body: jsonEncode({'email': email}),
    );
    return jsonDecode(response.body);
  }

  Future<List<dynamic>> getRequests() async {
    final response = await http.get(
      Uri.parse('${AppConfig.baseUrl}family/requests'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    if (data['success'] == true) {
      return data['data'];
    }
    return [];
  }

  Future<Map<String, dynamic>> respondToRequest(
    String requestId,
    String action,
  ) async {
    final response = await http.post(
      Uri.parse('${AppConfig.baseUrl}family/respond'),
      headers: await _getHeaders(),
      body: jsonEncode({'request_id': requestId, 'action': action}),
    );
    return jsonDecode(response.body);
  }

  Future<List<dynamic>> getMembers() async {
    final response = await http.get(
      Uri.parse('${AppConfig.baseUrl}family/members'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    if (data['success'] == true) {
      return data['data'];
    }
    return [];
  }

  Future<Map<String, dynamic>> removeMember(String memberId) async {
    final response = await http.delete(
      Uri.parse('${AppConfig.baseUrl}family/member/$memberId'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> sendEmergencyAlert(String message) async {
    final response = await http.post(
      Uri.parse('${AppConfig.baseUrl}family/emergency'),
      headers: await _getHeaders(),
      body: jsonEncode({'message': message}),
    );
    return jsonDecode(response.body);
  }

  // Chat APIs
  Future<Map<String, dynamic>> startPrivateChat(String memberId) async {
    final response = await http.get(
      Uri.parse('${AppConfig.baseUrl}chat/private/start?member_id=$memberId'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getGroupChat() async {
    final response = await http.get(
      Uri.parse('${AppConfig.baseUrl}chat/group'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  Future<List<dynamic>> getMessages(String chatId) async {
    final response = await http.get(
      Uri.parse('${AppConfig.baseUrl}chat/messages?chat_id=$chatId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    if (data['success'] == true) {
      return data['data'];
    }
    return [];
  }
}
