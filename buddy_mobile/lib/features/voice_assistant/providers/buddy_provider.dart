import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:convert';
import 'dart:async';
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
  
  // Expose these for potential direct use (but provider methods are preferred)
  FlutterTts get tts => _flutterTts;
  AudioPlayer get audioPlayer => _audioPlayer;

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
  bool _isSpeaking = false;
  bool get needsLogin => _needsLogin;
  bool get isSpeaking => _isSpeaking;

  // TTS Buffering Variables
  String _ttsBuffer = '';
  final List<String> _ttsQueue = [];
  bool _isSpeakingQueue = false;

  String _currentGender = 'female';
  String _currentTone = 'soft';

  void syncVoicePreferences(String gender, String tone) {
    _currentGender = gender;
    _currentTone = tone;
    _configureLocalTts(gender, tone);
  }

  void clearNeedsLogin() {
    _needsLogin = false;
    notifyListeners();
  }

  bool _socketListenersSet = false;

  BuddyProvider() {
    _setupSocketListeners();
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _flutterTts.stop();
    socketService.dispose();
    super.dispose();
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

  Future<void> stopAllAudio() async {
    _ttsQueue.clear();
    _ttsBuffer = '';
    _isSpeakingQueue = false;
    _isSpeaking = false;
    socketService.interrupt(); // TELL BACKEND TO STOP STREAMING
    await _flutterTts.stop();
    await _audioPlayer.stop();
    notifyListeners();
  }

  Future<void> _configureLocalTts(String gender, String tone) async {
    try {
      double speechRate = 0.5;
      double pitch = 1.0;

      // Try setting an actual male/female voice from the system
      final voices = await _flutterTts.getVoices;
      if (voices != null) {
        List<dynamic> voiceList = List<dynamic>.from(voices);
        Map<dynamic, dynamic>? selectedVoice;

        for (var v in voiceList) {
          final name = v['name']?.toString().toLowerCase() ?? '';
          final locale = v['locale']?.toString().toLowerCase() ?? '';
          if (locale.startsWith('en')) {
            if (gender == 'male' && (name.contains('male') || name.contains('iom') || name.contains('tpd') || name.contains('rjs') || name.contains('daniel'))) {
              selectedVoice = v;
              break;
            } else if (gender == 'female' && (name.contains('female') || name.contains('sfg') || name.contains('tpf') || name.contains('samantha'))) {
              selectedVoice = v;
              break;
            }
          }
        }

        if (selectedVoice != null) {
          await _flutterTts.setVoice({
            "name": selectedVoice["name"].toString(),
            "locale": selectedVoice["locale"].toString()
          });
        }
      }

      // Fallback Pitch/Rate if specific voice mapping wasn't enough
      if (gender == 'male') {
        pitch = 0.8;
      } else {
        pitch = 1.1;
      }

      if (tone == 'soft') {
        speechRate = 0.45;
        pitch -= 0.05;
      } else if (tone == 'energetic') {
        speechRate = 0.6;
        pitch += 0.1;
      }

      await _flutterTts.setPitch(pitch);
      await _flutterTts.setSpeechRate(speechRate);
    } catch (e) {
      print("Error configuring local TTS: $e");
    }
  }

  Future<void> _processTtsQueue() async {
    if (_isSpeakingQueue || _ttsQueue.isEmpty) return;
    _isSpeakingQueue = true;

    while (_ttsQueue.isNotEmpty) {
      if (!_isSpeakingQueue) break; // Allow emergency stop
      final sentence = _ttsQueue.removeAt(0);
      if (sentence.trim().isEmpty) continue;
      
      try {
        final token = await _storage.read(key: 'jwt'); 
        final baseUrl = AppConfig.baseUrl;
        
        // Fetch current user prefs for the voice query
        String gender = 'female';
        String tone = 'soft';

        // Note: In a production app, we'd ideally have the UserProvider's current state passed in,
        // but for high-speed local processing, we will hit the preview-voice with the latest available params if we can.
        // For now, hit it with the simple text. The backend will use DB defaults or we can pass gender/tone if we had access here easily.
        
        final url = Uri.parse('$baseUrl/voice/preview-voice?text=${Uri.encodeComponent(sentence)}');
        
        final response = await http.get(url, headers: {
          'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
        });
        
        bool playedCustom = false;
        if (response.statusCode == 200) {
          final body = json.decode(response.body);

          // Config logic - always apply the server's resolved preferences to our local engine
          if (body['resolvedVoiceConfig'] != null) {
            final config = body['resolvedVoiceConfig'];
            await _flutterTts.setPitch((config['pitch'] as num?)?.toDouble() ?? 1.0);
            await _flutterTts.setSpeechRate((config['speechRate'] as num?)?.toDouble() ?? 0.5);
          }

          if (body['success'] == true && body['audio'] != null) {
            final audioBytes = base64Decode(body['audio']);
            
            var completer = Completer<void>();
            StreamSubscription? compSub;
            StreamSubscription? stateSub;
            
            compSub = _audioPlayer.onPlayerComplete.listen((_) {
              if (!completer.isCompleted) completer.complete();
            });
            stateSub = _audioPlayer.onPlayerStateChanged.listen((state) {
               if (state == PlayerState.stopped && !completer.isCompleted) completer.complete();
            });
            
            _isSpeaking = true;
            notifyListeners();
            await _audioPlayer.play(BytesSource(audioBytes));
            await completer.future;
            
            await compSub.cancel();
            await stateSub.cancel();
            _isSpeaking = false;
            notifyListeners();
            playedCustom = true;
          }
        }

        if (!playedCustom) {
           // If we fall back to local TTS, ensure it's configured for the user's current gender/tone
           await _configureLocalTts(_currentGender, _currentTone);
           _isSpeaking = true;
           notifyListeners();
           await _flutterTts.speak(sentence);
           _isSpeaking = false;
           notifyListeners();
        }
      } catch (e) {
        print("TTS Error: $e");
        await _configureLocalTts(_currentGender, _currentTone);
        await _flutterTts.speak(sentence);
      }
    }

    _isSpeakingQueue = false;
  }

  void _setupSocketListeners() {
    if (_socketListenersSet) return;
    _socketListenersSet = true;
    
    // Default settings (will be dynamically updated by server responses)
    _flutterTts.setSpeechRate(0.5); 
    _flutterTts.setPitch(1.0);
    _flutterTts.setVolume(1.0);
    _flutterTts.awaitSpeakCompletion(true); 

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

      // ONLY parse for local TTS if NOT in realtime mode with server audio
      // In the new Python-powered mode, we prefer the server's premium edge-tts voice.
      if (!_isRealtimeEnabled) {
        // Sentence parsing for local TTS fallback
        String sanitizedText = text
            .replaceAll('*', '')
            .replaceAll('`', '')
            .replaceAll('#', '')
            .replaceAll(RegExp(r'json|markdown|\[|\]|\(|\)', caseSensitive: false), '')
            .replaceAll(RegExp(r'[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]', unicode: true), '');

        _ttsBuffer += sanitizedText;
        List<String> sentences = [];
        String tempBuffer = _ttsBuffer;
        
        final sentenceRegEx = RegExp(r'[^.!?]+[.!?]+');
        Iterable<Match> matches = sentenceRegEx.allMatches(tempBuffer);
        
        int lastMatchEnd = 0;
        for (final match in matches) {
            sentences.add(match.group(0)!);
            lastMatchEnd = match.end;
        }
        
        if (sentences.isNotEmpty) {
            _ttsBuffer = tempBuffer.substring(lastMatchEnd);
            _ttsQueue.addAll(sentences);
            _processTtsQueue();
        }
      }

      notifyListeners();
    });

    socketService.socket?.on('turn_started', (_) async {
        _isThinking = true;
        notifyListeners();
    });

    socketService.socket?.on('error', (_) {
        _isThinking = false;
        notifyListeners();
    });

    socketService.socket?.on('connect_error', (_) {
        _isThinking = false;
        notifyListeners();
    });

    // Handle end of stream
    socketService.socket?.on('response_done', (_) {
        if (_messages.isNotEmpty && _messages.last['isPartial'] == true) {
            _messages.last['isPartial'] = false;
        }
        
        // Flush any remaining text in buffer to local TTS ONLY if server audio not used
        if (!_isRealtimeEnabled && _ttsBuffer.trim().isNotEmpty) {
           _ttsQueue.add(_ttsBuffer.trim());
           _ttsBuffer = '';
           _processTtsQueue();
        }

        _isThinking = false; // Ensure cleared
        notifyListeners();
    });

    socketService.audioStream.listen((base64Audio) async {
       // PREMIUM EXPERIENCE: Play high-quality MP3 from the Python Brain
       if (base64Audio.isNotEmpty) {
          try {
            await _flutterTts.stop(); // Stop local fallback immediately
            _ttsQueue.clear();
            _ttsBuffer = '';

            final audioBytes = base64Decode(base64Audio);
            _isSpeaking = true;
            notifyListeners();
            await _audioPlayer.play(BytesSource(audioBytes));
            
            // Since this is a stream of chunks, we might want to track if it's still playing
            // but for now, simple toggle
            _audioPlayer.onPlayerComplete.first.then((_) {
                _isSpeaking = false;
                notifyListeners();
            });
          } catch (e) {
            print("Error playing server audio: $e");
            _isSpeaking = false;
            notifyListeners();
          }
       }
    });


    socketService.statusStream.listen((isConnected) {
      _isRealtimeEnabled = isConnected;
      if (!isConnected) {
        _isThinking = false;
      }
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
          // Pre-configure the local engine to match the voice alert gender
          await _configureLocalTts(gender, tone);
          
          // Speak immediately using local TTS for maximum speed
          await _flutterTts.speak(text);
          
          final token = await _storage.read(key: 'jwt'); 
          final baseUrl = AppConfig.baseUrl;
          final url = Uri.parse('$baseUrl/voice/preview-voice?text=${Uri.encodeComponent(text)}&gender=$gender&tone=$tone');
          
          final response = await http.get(url, headers: {
            'Authorization': 'Bearer $token',
            'x-platform': 'mobile',
          });

          if (response.statusCode == 200) {
            final body = json.decode(response.body);

            // SYNC TONE: Even for alerts, ensure local fallback matches the personality
            if (body['resolvedVoiceConfig'] != null) {
              final config = body['resolvedVoiceConfig'];
              await _flutterTts.setPitch((config['pitch'] as num?)?.toDouble() ?? 1.0);
              await _flutterTts.setSpeechRate((config['speechRate'] as num?)?.toDouble() ?? 0.5);
            }

            if (body['success'] == true && body['audio'] != null) {
              await _flutterTts.stop(); // Clear local TTS
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
      _messages = (conv['messages'] as List).map((m) {
        int timestamp = DateTime.now().millisecondsSinceEpoch;
        if (m['timestamp'] != null) {
          try {
            timestamp = DateTime.parse(m['timestamp']).toLocal().millisecondsSinceEpoch;
          } catch (e) {
            // fallback
          }
        }
        return {
          'id': DateTime.now().millisecondsSinceEpoch.toString() + m['content'].hashCode.toString(),
          'type': m['role'] == 'user' ? 'user' : 'ai',
          'text': m['content'],
          'image': null,
          'shouldType': false, // History should not type
          'timestamp': timestamp,
        };
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

    if (_isRealtimeEnabled && imagePath == null) {
      await stopAllAudio(); // STOP PREVIOUS VOICE IMMEDIATELY
      socketService.sendText(text.isEmpty && isWakeWord ? 'Hey Buddy' : text);
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
      
      // Clear any busy audio before speaking new reply
      await stopAllAudio();

      if (audioBase64 != null && audioBase64.isNotEmpty) {
          final audioBytes = base64Decode(audioBase64);
          await _audioPlayer.play(BytesSource(audioBytes));
      } else {
          // SYNC TONE: Apply server-resolved configuration to local TTS fallback
          if (response['data']['resolvedVoiceConfig'] != null) {
            final config = response['data']['resolvedVoiceConfig'];
            await _flutterTts.setPitch((config['pitch'] as num?)?.toDouble() ?? 1.0);
            await _flutterTts.setSpeechRate((config['speechRate'] as num?)?.toDouble() ?? 0.5);
          }
          await _flutterTts.speak(reply);
      }

      if (response['meta'] != null && response['meta']['conversationId'] != null) {
        _currentConversationId = response['meta']['conversationId'];
      }

      // If backend audio is provided and high quality is preferred, we could play it.
      // Now playing backend audio directly.
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
    // Optimistically clear local state
    _historyList.removeWhere((c) => c['_id'] == id);
    if (_currentConversationId == id) {
      startNewChat();
    }
    notifyListeners();
    
    // Attempt to clear from server if logged in
    await _buddyService.deleteConversation(id);
  }

  Future<void> deleteAllHistory() async {
    // Optimistically clear local state
    _historyList = [];
    startNewChat();
    notifyListeners();
    
    // Attempt to clear from server if logged in
    await _buddyService.deleteAllConversations();
  }
}
