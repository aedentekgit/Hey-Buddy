import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:convert';
import 'package:buddy_mobile/features/voice_assistant/services/buddy_service.dart';
import 'package:buddy_mobile/core/services/socket_service.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:http/http.dart' as http;

class BuddyProvider with ChangeNotifier {
  final BuddyService _buddyService = BuddyService();
  final SocketService socketService = SocketService();
  final AudioPlayer _audioPlayer = AudioPlayer();
  final _storage = const FlutterSecureStorage();

  List<Map<String, dynamic>> _messages = [];
  List<dynamic> _historyList = [];
  String? _currentConversationId;
  bool _isLoading = false;
  bool _isThinking = false;
  bool _isRealtimeEnabled = false;

  BuddyProvider() {
    _setupSocketListeners();
  }

  bool get isRealtimeEnabled => _isRealtimeEnabled;

  void _setupSocketListeners() {
    socketService.captionStream.listen((text) {
      if (_messages.isNotEmpty && _messages.last['type'] == 'ai' && _messages.last['isPartial'] == true) {
        _messages.last['text'] += text;
      } else {
        _messages.add({
          'id': 'socket_${DateTime.now().millisecondsSinceEpoch}',
          'type': 'ai',
          'text': text,
          'isPartial': true,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        });
      }
      notifyListeners();
    });

    socketService.statusStream.listen((isConnected) {
      _isRealtimeEnabled = isConnected;
      notifyListeners();
    });

    // Handle Background Voice Alerts (e.g. Traffic, Proximity)
    socketService.voiceAlertStream.listen((data) async {
      final text = data['text'] as String?;
      if (text == null) return;

      final gender = data['gender'] ?? 'female';
      final tone = data['tone'] ?? 'soft';

      try {
        final token = await _storage.read(key: 'token');
        final baseUrl = AppConfig.baseUrl;
        final url = Uri.parse('$baseUrl/voice/preview-voice?text=${Uri.encodeComponent(text)}&gender=$gender&tone=$tone');
        
        final response = await http.get(url, headers: {
          'Authorization': 'Bearer $token',
        });

        if (response.statusCode == 200) {
          final body = json.decode(response.body);
          if (body['success'] == true && body['audio'] != null) {
            final audioBytes = base64Decode(body['audio']);
            await _audioPlayer.play(BytesSource(audioBytes));
          }
        }
      } catch (e) {
        print('Error playing voice alert: $e');
      }
    });
  }

  void toggleRealtime(bool enable) {
    if (enable) {
      socketService.connect();
    } else {
      socketService.dispose();
      _isRealtimeEnabled = false;
    }
    notifyListeners();
  }

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

  Future<void> sendMessage(String text, {String? imagePath, String language = 'auto'}) async {
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

    if (_isRealtimeEnabled) {
      socketService.sendText(text);
      _isThinking = false;
      notifyListeners();
      return;
    }

    final response = await _buddyService.parseVoice(
      text: text,
      image: imageData,
      language: language,
      conversationId: _currentConversationId,
    );

    if (response['success'] == true) {
      final reply = response['data']['reply'];
      final audioBase64 = response['data']['audio'];
      
      addMessage('ai', reply);
      
      if (response['meta'] != null && response['meta']['conversationId'] != null) {
        _currentConversationId = response['meta']['conversationId'];
      }

      // Play audio response if available (for character consistency)
      if (audioBase64 != null) {
        try {
          final audioBytes = base64Decode(audioBase64);
          await _audioPlayer.play(BytesSource(audioBytes));
        } catch (e) {
          print('Error playing response audio: $e');
        }
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
