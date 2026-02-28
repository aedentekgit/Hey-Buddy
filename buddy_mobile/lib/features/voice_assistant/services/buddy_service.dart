import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http_parser/http_parser.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class BuddyService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String get _baseUrl => AppConfig.baseUrl;

  Future<String?> _getToken() async {
    return await _storage.read(key: 'jwt');
  }

  // Parse Voice / Bot Chat
  Future<Map<String, dynamic>> parseVoice({
    required String text,
    Map<String, dynamic>? image,
    String language = 'en-US',
    List<dynamic> history = const [],
    String? conversationId,
  }) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${_baseUrl}voice/parse'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({
          'text': text,
          'image': image,
          'language': language,
          'history': history,
          'conversationId': conversationId,
          'timeZone': DateTime.now().timeZoneName,
          'clientTimestamp': DateTime.now().millisecondsSinceEpoch,
        }),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Status: ${response.statusCode}'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // Reminders
  Future<Map<String, dynamic>> saveReminder(Map<String, dynamic> reminderData, String saveTo) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${_baseUrl}voice/save'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({
          'reminderData': reminderData,
          'saveTo': saveTo,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // Conversation History
  Future<List<dynamic>> getConversations() async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('${_baseUrl}conversations'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data'] ?? [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> getConversationById(String id) async {
    try {
      final token = await _getToken();
      final response = await http.get(
        Uri.parse('${_baseUrl}conversations/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['data'] ?? {};
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  Future<bool> deleteConversation(String id) async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('${_baseUrl}conversations/$id'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> deleteAllConversations() async {
    try {
      final token = await _getToken();
      final response = await http.delete(
        Uri.parse('${_baseUrl}conversations'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // Prescription / Image Analysis
  Future<Map<String, dynamic>> uploadPrescription(File file, String language) async {
    try {
      final token = await _getToken();
      var request = http.MultipartRequest('POST', Uri.parse('${_baseUrl}voice/upload-prescription'));
      request.headers['Authorization'] = 'Bearer $token';
      
      String extension = file.path.split('.').last.toLowerCase();
      MediaType mediaType = (extension == 'png') ? MediaType('image', 'png') : MediaType('image', 'jpeg');

      request.files.add(await http.MultipartFile.fromPath(
        'document',
        file.path,
        contentType: mediaType,
      ));
      request.fields['language'] = language;

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);

      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> confirmMedicalReminders(String prescriptionId, Map<String, dynamic> confirmationData) async {
    try {
      final token = await _getToken();
      final response = await http.post(
        Uri.parse('${_baseUrl}voice/confirm-medical-reminders'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({
          'prescriptionId': prescriptionId,
          'confirmationData': confirmationData,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> getLocalNews(double? lat, double? lon) async {
    try {
      final token = await _getToken();
      String url = '${_baseUrl}voice/news/local';
      if (lat != null && lon != null) {
        url += '?lat=$lat&lon=$lon';
      }
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Status: ${response.statusCode}'};
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
