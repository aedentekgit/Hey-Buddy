import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:convert';
import 'package:buddy_mobile/features/voice_assistant/services/buddy_service.dart';

class BuddyProvider with ChangeNotifier {
  final BuddyService _buddyService = BuddyService();

  List<Map<String, dynamic>> _messages = [];
  List<dynamic> _historyList = [];
  String? _currentConversationId;
  bool _isLoading = false;
  bool _isThinking = false;

  List<Map<String, dynamic>> get messages => _messages;
  List<dynamic> get historyList => _historyList;
  String? get currentConversationId => _currentConversationId;
  bool get isLoading => _isLoading;
  bool get isThinking => _isThinking;

  void setMessages(List<Map<String, dynamic>> msgs) {
    _messages = msgs;
    notifyListeners();
  }

  void addMessage(String role, String text, {String? image}) {
    _messages.add({
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'type': role, // 'user' or 'ai' to match web components
      'text': text,
      'image': image,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    notifyListeners();
  }

  Future<void> fetchHistory() async {
    _isLoading = true;
    notifyListeners();
    _historyList = await _buddyService.getConversations();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadConversation(String id) async {
    _isLoading = true;
    notifyListeners();
    final conv = await _buddyService.getConversationById(id);
    if (conv.isNotEmpty) {
      _currentConversationId = id;
      _messages = (conv['messages'] as List).map((m) => {
        'id': DateTime.now().millisecondsSinceEpoch.toString() + m['content'].hashCode.toString(),
        'type': m['role'] == 'user' ? 'user' : 'ai',
        'text': m['content'],
        'image': null,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      }).toList();
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> sendMessage(String text, {String? imagePath, String language = 'en-US'}) async {
    _isThinking = true;
    notifyListeners();

    Map<String, dynamic>? imageData;
    if (imagePath != null) {
      final bytes = await File(imagePath).readAsBytes();
      final base64String = base64Encode(bytes);
      final mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
      imageData = {
        'data': base64String,
        'mimeType': mimeType,
      };
    }

    final response = await _buddyService.parseVoice(
      text: text,
      image: imageData,
      language: language,
      conversationId: _currentConversationId,
    );

    if (response['success'] == true) {
      final reply = response['data']['reply'];
      addMessage('ai', reply);
      if (response['meta'] != null && response['meta']['conversationId'] != null) {
        _currentConversationId = response['meta']['conversationId'];
      }
    } else {
      addMessage('ai', "Error: ${response['message']}");
    }

    _isThinking = false;
    notifyListeners();
  }

  Future<void> startNewChat() async {
    _currentConversationId = null;
    _messages = [];
    notifyListeners();
  }

  Future<void> deleteConversation(String id) async {
    final success = await _buddyService.deleteConversation(id);
    if (success) {
      _historyList.removeWhere((c) => c['_id'] == id);
      if (_currentConversationId == id) {
        startNewChat();
      }
      notifyListeners();
    }
  }

  Future<void> deleteAllHistory() async {
    final success = await _buddyService.deleteAllConversations();
    if (success) {
      _historyList = [];
      startNewChat();
      notifyListeners();
    }
  }
}
