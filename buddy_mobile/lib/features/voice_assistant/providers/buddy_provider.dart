import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:convert';
import 'package:flutter_tts/flutter_tts.dart';
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
  final FlutterTts _flutterTts = FlutterTts();

  List<Map<String, dynamic>> _messages = [];
  List<dynamic> _historyList = [];
  String? _currentConversationId;
  bool _isLoading = false;
  bool _isThinking = false;
  bool _isRealtimeEnabled = false;
  bool _isFetchingNews = false;
  List<String> _localNews = [];
  String? _localCity;
  bool _needsLogin = false;
  bool get needsLogin => _needsLogin;

  void clearNeedsLogin() {
    _needsLogin = false;
    notifyListeners();
  }

  BuddyProvider() {
    _setupSocketListeners();
  }

  bool get isRealtimeEnabled => _isRealtimeEnabled;
  bool get isFetchingNews => _isFetchingNews;
  List<String> get localNews => _localNews;
  String? get localCity => _localCity;

  Future<void> fetchLocalNews(double? lat, double? lon) async {
    if (_isFetchingNews) return;
    _isFetchingNews = true;
    notifyListeners();

    try {
      final response = await _buddyService.getLocalNews(lat, lon);
      if (response['success'] == true) {
        _localNews = List<String>.from(response['news']);
        _localCity = response['city'];
      } else if (response['statusCode'] == 401) {
        _needsLogin = true;
      }
    } catch (e) {
      // Handle error gracefully if needed
      print('Error fetching news: $e');
    } finally {
      _isFetchingNews = false;
      notifyListeners();
    }
  }

  void _setupSocketListeners() {
    _flutterTts.setSpeechRate(0.6);
    _flutterTts.setPitch(1.0);
    _flutterTts.setVolume(1.0);

    socketService.captionStream.listen((text) {
      if (_messages.isNotEmpty && _messages.last['type'] == 'ai' && _messages.last['isPartial'] == true) {
        _messages.last['text'] += text;
      } else {
        // CRITICAL: Force clear ANY previous specific indicators/states
        for (var m in _messages) {
           m['isPartial'] = false;
           m['shouldType'] = false;
        }

        _messages.add({
          'id': 'socket_${DateTime.now().millisecondsSinceEpoch}',
          'type': 'ai',
          'text': text,
          'isPartial': true,
          'shouldType': false, 
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        });
      }
      
      if (_isThinking) {
        _isThinking = false;
      }
      notifyListeners();
    });

    socketService.socket?.on('turn_started', (_) {
        _isThinking = true;
        notifyListeners();
    });

    // Handle end of stream
    socketService.socket?.on('response_done', (_) {
        if (_messages.isNotEmpty && _messages.last['isPartial'] == true) {
            _messages.last['isPartial'] = false;
        }
        _isThinking = false; // Ensure cleared
        notifyListeners();
    });

    socketService.audioStream.listen((base64Audio) async {
       try {
           if (base64Audio.isNotEmpty) {
               // We decode and attempt to play, but we don't block
               final audioBytes = base64Decode(base64Audio);
               // Note: This needs a raw PCM player. For now we use it as is
               // but we ensure the app stays responsive.
               _audioPlayer.play(BytesSource(audioBytes));
           }
       } catch (e) {
           print('Error playing audio chunk: $e');
       }
    });


    socketService.statusStream.listen((isConnected) {
      _isRealtimeEnabled = isConnected;
      notifyListeners();
    });

    // Handle Wake Word Detection
    socketService.wakeWordStream.listen((data) {
      print('Wake word detected: ${data['transcript']}');
      sendMessage('', isWakeWord: true);
    });

    // Handle Background Voice Alerts (e.g. Traffic, Proximity)
    socketService.voiceAlertStream.listen((data) async {
      final text = data['text'] as String?;
      if (text == null) return;

      final gender = data['gender'] ?? 'female';
      final tone = data['tone'] ?? 'soft';

      try {
          // Speak immediately using local TTS for maximum speed
          await _flutterTts.speak(text);
          
          final token = await _storage.read(key: 'jwt'); 
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
          print('Error in voice alert: $e');
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

  void addMessage(String role, String text, {String? image, bool shouldType = true}) {
    // Prevent multiple typing states: disable typing animation for all previous messages
    for (var m in _messages) {
      m['shouldType'] = false;
      m['isPartial'] = false;
    }

    _messages.add({
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'type': role, 
      'text': text,
      'image': image,
      'shouldType': shouldType,
      'isPartial': false,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    });
    notifyListeners();
  }


  Future<void> fetchHistory() async {
    _isLoading = true;
    notifyListeners();
    _historyList = await _buddyService.getConversations();
    if (_historyList.isNotEmpty) {
        // Automatically load the latest (and now only) conversation
        await loadConversation(_historyList.first['_id']);
    }
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
        'shouldType': false, // History should not type
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      }).toList();

    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> sendMessage(String text, {String? imagePath, String language = 'auto', bool isWakeWord = false}) async {
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
      socketService.sendText(text.isEmpty && isWakeWord ? 'Hey Buddy' : text);
      // Keep _isThinking = true; will be set to false when stream starts or finishes
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
      
      // SPEED FIX: Speak immediately via local TTS
      _flutterTts.speak(reply);

      if (response['meta'] != null && response['meta']['conversationId'] != null) {
        _currentConversationId = response['meta']['conversationId'];
      }

      // If backend audio is provided and high quality is preferred, we could play it.
      // But for "Very Very Fast", local TTS already started.
    } else {
      if (response['statusCode'] == 401) {
        _needsLogin = true;
      }
      final errorMsg = "Error: ${response['message']}";
      addMessage('ai', errorMsg);
      _flutterTts.speak("I'm sorry, I encountered an error.");
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
