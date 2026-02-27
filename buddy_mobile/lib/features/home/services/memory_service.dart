import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:http_parser/http_parser.dart';
import 'dart:io' show Platform, File;

import 'package:buddy_mobile/core/config/app_config.dart';

class MemoryService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Helper to get base URL
  String get _baseUrl => AppConfig.baseUrl;

  // Fetch Memories from Backend
  Future<List<dynamic>> fetchMemories() async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.get(
        Uri.parse('${_baseUrl}voice/memories/mix'), // Updated to correct endpoint
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          return data['data']; // Assuming 'data' contains the list of memories
        }
      }
      return [];
    } catch (e) {
      print("Error fetching memories: $e");
      return [];
    }
  }

  // Delete Memory
  Future<bool> deleteMemory(String memoryId) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.delete(
        Uri.parse('${_baseUrl}voice/memories/$memoryId'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error deleting memory: $e");
      return false;
    }
  }

  // Update Memory
  Future<bool> updateMemory(String memoryId, String content, {File? file}) async {
    try {
      final token = await _storage.read(key: 'jwt');
      final uri = Uri.parse('${_baseUrl}voice/memories/$memoryId');

      if (file != null) {
        var request = http.MultipartRequest('PUT', uri);
        request.headers['Authorization'] = 'Bearer $token';
        request.headers['x-platform'] = 'mobile';

        String extension = file.path.split('.').last.toLowerCase();
        MediaType mediaType = (extension == 'png') ? MediaType('image', 'png') : MediaType('image', 'jpeg');
        if (extension == 'pdf') mediaType = MediaType('application', 'pdf');

        request.files.add(await http.MultipartFile.fromPath(
          'file',
          file.path,
          contentType: mediaType,
        ));
        request.fields['content'] = content;

        var streamedResponse = await request.send();
        return streamedResponse.statusCode == 200;
      } else {
        final response = await http.put(
          uri,
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
            'x-platform': 'mobile',
          },
          body: jsonEncode({'content': content}),
        );
        return response.statusCode == 200;
      }
    } catch (e) {
      print("Error updating memory: $e");
      return false;
    }
  }

  // Delete Prescription/Record
  Future<bool> deletePrescription(String recordId) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.delete(
        Uri.parse('${_baseUrl}voice/prescriptions/$recordId'),
        headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        },
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error deleting prescription: $e");
      return false;
    }
  }

  // Update Prescription/Record
  Future<bool> updatePrescription(String recordId, Map<String, dynamic> data) async {
    try {
      final token = await _storage.read(key: 'jwt');

      final response = await http.put(
        Uri.parse('${_baseUrl}voice/prescriptions/$recordId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
          'x-platform': 'mobile',
        },
        body: jsonEncode({'extractedData': data}),
      );

      return response.statusCode == 200;
    } catch (e) {
      print("Error updating prescription: $e");
      return false;
    }
  }
}
