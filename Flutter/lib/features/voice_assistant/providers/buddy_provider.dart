// ignore_for_file: override_on_non_overriding_member, unused_field, unused_local_variable
import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:buddy_mobile/features/voice_assistant/services/buddy_service.dart';
import 'package:buddy_mobile/core/services/socket_service.dart';
import 'package:buddy_mobile/features/voice_assistant/services/audio_stream_service.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_tts/flutter_tts.dart';

class BuddyProvider with ChangeNotifier {
  final BuddyService _buddyService = BuddyService();
  final SocketService socketService = SocketService();
  late final AudioStreamService _audioStreamService;
  final AudioPlayer _audioPlayer = AudioPlayer();
  final _storage = const FlutterSecureStorage();
  final FlutterTts _flutterTts = FlutterTts();
  
  // Expose these for potential direct use (but provider methods are preferred)  AudioPlayer get audioPlayer => _audioPlayer;
  FlutterTts get tts => _flutterTts;

  List<Map<String, dynamic>> _messages = [];
  List<dynamic> _historyList = [];
  String? _currentConversationId;
  bool _isLoading = false;
  bool _isThinking = false;
  bool _isRealtimeEnabled = false;
  bool _isFetchingNews = false;
  List<String> _localNews = [];
  String? _localCity;
  bool _isSpeaking = false;
  bool _isListening = false;
  bool _needsLogin = false;
  bool get needsLogin => _needsLogin;
  bool _isConnected = true;
  bool _hasAttemptedConnection = false;
  bool get isConnected => _isConnected;
  bool get isSpeaking => _isSpeaking;
  bool get isListening => _isListening;
  bool get isStreaming => _audioStreamService.isStreaming;

  // Server health status for better error messages
  bool _isServerReachable = true;
  bool get isServerReachable => _isServerReachable;
  String _connectionError = '';
  String get connectionError => _connectionError;

  // TTS Buffering Variables
  final List<String> _ttsQueue = [];
  String _ttsBuffer = '';
  bool _isSpeakingQueue = false;

  // Cloud Audio Queue
  final List<String> _audioChunkQueue = [];
  bool _isPlayingAudioChunkQueue = false;

  String _currentGender = 'male';
  String _currentTone = 'normal';

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
    _audioStreamService = AudioStreamService(socketService);
    _setupSocketListeners();
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _audioStreamService.dispose();
    
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
      double? useLat = lat;
      double? useLon = lon;

      // EMULATOR FALLBACK: Simulate Madurai GPS for fetching local news
      if (useLat != null &&
          useLat > 37.0 &&
          useLat < 38.0 &&
          useLon != null &&
          useLon > -123.0 &&
          useLon < -121.0) {
        useLat = 9.9252;
        useLon = 78.1198;
      }

      final response = await _buddyService.getLocalNews(useLat, useLon);
      if (response['success'] == true) {
        _localNews = List<String>.from(response['news']);
        _localCity = response['city'];
      } else if (response['statusCode'] == 401) {
        _needsLogin = true;
      }
    } catch (e) {
      // Handle error gracefully if needed
      debugPrint('Error fetching news: $e');
    } finally {
      _isFetchingNews = false;
      notifyListeners();
    }
  }

  Future<void> stopAllAudio() async {
    _ttsQueue.clear();
    _ttsBuffer = '';
    _isSpeakingQueue = false;

    _audioChunkQueue.clear();
    _isPlayingAudioChunkQueue = false;

    _isSpeaking = false;
    socketService.interrupt(); // TELL BACKEND TO STOP STREAMING
    await _flutterTts.stop();
    await _audioPlayer.stop();
    notifyListeners();
  }

  Future<void> _processAudioChunkQueue() async {
    if (_isPlayingAudioChunkQueue || _audioChunkQueue.isEmpty) return;
    _isPlayingAudioChunkQueue = true;
    _isSpeaking = true;
    notifyListeners();

    while (_audioChunkQueue.isNotEmpty) {
      if (!_isPlayingAudioChunkQueue) break;
      final audioB64 = _audioChunkQueue.removeAt(0);

      try {
        final audioBytes = base64Decode(audioB64);
        var completer = Completer<void>();
        StreamSubscription? compSub;
        StreamSubscription? stateSub;

        compSub = _audioPlayer.onPlayerComplete.listen((_) {
          if (!completer.isCompleted) completer.complete();
        });
        stateSub = _audioPlayer.onPlayerStateChanged.listen((state) {
          if (state == PlayerState.stopped && !completer.isCompleted) completer.complete();
        });

        await _audioPlayer.play(BytesSource(audioBytes));
        await completer.future;

        await compSub.cancel();
        await stateSub.cancel();
      } catch (e) {
        debugPrint("Error playing audio chunk: $e");
      }
    }

    _isPlayingAudioChunkQueue = false;
    _isSpeaking = false;
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
            // Prioritize British voices (en-gb) to match RyanNeural
            bool isBritish = locale.contains('gb');
            if (gender == 'male' &&
                (name.contains('male') ||
                    name.contains('iom') ||
                    name.contains('tpd') ||
                    name.contains('rjs') ||
                    name.contains('daniel') ||
                    name.contains('ryan'))) {
              selectedVoice = v;
              if (isBritish) break; // Perfect match
            } else if (gender == 'female' &&
                (name.contains('female') ||
                    name.contains('sfg') ||
                    name.contains('tpf') ||
                    name.contains('samantha'))) {
              selectedVoice = v;
              if (isBritish) break;
            }
          }
        }

        if (selectedVoice != null) {
          await _flutterTts.setVoice({
            "name": selectedVoice["name"].toString(),
            "locale": selectedVoice["locale"].toString(),
          });
        }
      }

      // Fallback Pitch/Rate if specific voice mapping wasn't enough
      if (gender == 'male') {
        pitch = 0.8;
      } else {
        pitch = 1.0;
      }

      if (tone == 'soft') {
        speechRate = 0.45;
        pitch -= 0.05;
      } else if (tone == 'energetic') {
        speechRate = 0.6;
        pitch += 0.1;
      }

      
      
    } catch (e) {
      debugPrint("Error configuring local TTS: $e");
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
        String gender = 'male';
        String tone = 'normal';

        // Note: In a production app, we'd ideally have the UserProvider's current state passed in,
        // but for high-speed local processing, we will hit the preview-voice with the latest available params if we can.
        // For now, hit it with the simple text. The backend will use DB defaults or we can pass gender/tone if we had access here easily.

        final url = Uri.parse(
          '$baseUrl/voice/preview-voice?text=${Uri.encodeComponent(sentence)}&gender=$gender&tone=$tone',
        );

        final response = await http.get(
          url,
          headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
        );

        bool playedCustom = false;
        if (response.statusCode == 200) {
          final body = json.decode(response.body);

          // Config logic - always apply the server's resolved preferences to our local engine
          if (body['resolvedVoiceConfig'] != null) {
            final config = body['resolvedVoiceConfig'];
            await _flutterTts.setPitch(
              (config['pitch'] as num?)?.toDouble() ?? 1.0,
            );
            await _flutterTts.setSpeechRate(
              (config['speechRate'] as num?)?.toDouble() ?? 0.5,
            );
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
              if (state == PlayerState.stopped && !completer.isCompleted) {
                completer.complete();
              }
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
        debugPrint("TTS Error: $e");
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
      if (_messages.isNotEmpty &&
          _messages.last['type'] == 'ai' &&
          _messages.last['isPartial'] == true) {
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
            .replaceAll(
              RegExp(r'json|markdown|\[|\]|\(|\)', caseSensitive: false),
              '',
            )
            .replaceAll(
              RegExp(
                r'[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]',
                unicode: true,
              ),
              '',
            );

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

    socketService.turnStartedStream.listen((_) async {
      _isThinking = true;
      _isListening = false; // Reset listening UI as processing started
      notifyListeners();
    });

    socketService.connectErrorStream.listen((data) {
      debugPrint('Socket Connect Error: $data');
      _isThinking = false;
      if (data.toString().contains('Authentication failed') ||
          data.toString().contains('session may have expired')) {
        _needsLogin = true;
        _isRealtimeEnabled = false;
      }
      notifyListeners();
    });

    socketService.errorStream.listen((err) {
      debugPrint('Socket Error event: $err');
      _isThinking = false;
      if (err.toString().contains('Authentication failed') ||
          err.toString().contains('session may have expired')) {
        _needsLogin = true;
        _isRealtimeEnabled = false;
      }
      notifyListeners();
    });

    // Handle end of stream
    socketService.responseDoneStream.listen((_) {
      if (_messages.isNotEmpty && _messages.last['isPartial'] == true) {
        _messages.last['isPartial'] = false;
      }

      // Flush any remaining text in buffer to local TTS ONLY if server audio not used
      if (!_isRealtimeEnabled && _ttsBuffer.trim().isNotEmpty) {
        _ttsQueue.add(_ttsBuffer.trim());
        _ttsBuffer = '';
        _processTtsQueue();
      }

      // Always clear the thinking state when the response is definitively done,
      // preventing infinite loading if the stream was totally empty due to an AI crash.
      _isThinking = false;
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
          debugPrint("Error playing server audio: $e");
          _isSpeaking = false;
          notifyListeners();
        }
      }
    });

    socketService.statusStream.listen((isConnected) {
      debugPrint('📡 Socket status changed: $isConnected');
      _hasAttemptedConnection = true;
      _isRealtimeEnabled = isConnected;
      _isConnected = isConnected;
      _isServerReachable = true; // Socket connected means server is reachable
      _connectionError = ''; // Clear any connection errors
      if (!isConnected) {
        _isThinking = false;
        _audioStreamService.stopStreaming();
        debugPrint('🛑 Audio streaming stopped (socket disconnected)');
      } else {
        // Automatically start streaming when socket connects for wake-word detection
        // DISABLED per user request: _audioStreamService.startStreaming();
        debugPrint('🎙️ Audio streaming auto-start DISABLED (socket connected)');
      }
      notifyListeners();
    });

    // Handle Wake Word Detection
    socketService.wakeWordStream.listen((data) {
      debugPrint('🔥🔥🔥 WAKE WORD DETECTED! Data: $data');
      _isListening = true;
      notifyListeners();

      // We don't need to sendMessage('') because the backend is already hearing the trail!
      // But we can send a "Hey Buddy" text just for the UI history if we want.
      addMessage('user', 'Hey Buddy', shouldType: false);
    });

    // Handle Barge-In (interruption while Buddy is speaking)
    socketService.bargeInStream.listen((_) {
      if (_isSpeaking || _isSpeakingQueue) {
        debugPrint('Barge-in detected: Silencing Buddy');
        _audioPlayer.stop();
        
        _isSpeaking = false;
        _isSpeakingQueue = false;
        _ttsQueue.clear();
        _ttsBuffer = '';
        notifyListeners();
      }
    });

    // Handle Stop Command (explicit stop by user)
    socketService.stopCommandStream.listen((_) {
      debugPrint('Stop command detected: Returning to Standby');
      stopAllAudio();
      notifyListeners();
    });

    // Handle Background Voice Alerts (e.g. Traffic, Proximity)
    socketService.voiceAlertStream.listen((data) async {
      final text = data['text'] as String?;
      if (text == null) return;

      final gender = data['gender'] ?? 'male';
      final tone = data['tone'] ?? 'soft';

      try {
        // Pre-configure the local engine to match the voice alert gender
        await _configureLocalTts(gender, tone);

        // Speak immediately using local TTS for maximum speed
        await _flutterTts.speak(text);

        final token = await _storage.read(key: 'jwt');
        final baseUrl = AppConfig.baseUrl;
        final url = Uri.parse(
          '$baseUrl/voice/preview-voice?text=${Uri.encodeComponent(text)}&gender=$gender&tone=$tone',
        );

        final response = await http.get(
          url,
          headers: {'Authorization': 'Bearer $token', 'x-platform': 'mobile'},
        );

        if (response.statusCode == 200) {
          final body = json.decode(response.body);

          // SYNC TONE: Even for alerts, ensure local fallback matches the personality
          if (body['resolvedVoiceConfig'] != null) {
            final config = body['resolvedVoiceConfig'];
            await _flutterTts.setPitch(
              (config['pitch'] as num?)?.toDouble() ?? 1.0,
            );
            await _flutterTts.setSpeechRate(
              (config['speechRate'] as num?)?.toDouble() ?? 0.5,
            );
          }

          if (body['success'] == true && body['audio'] != null) {
            await _flutterTts.stop(); // Clear local TTS
            final audioBytes = base64Decode(body['audio']);
            await _audioPlayer.play(BytesSource(audioBytes));
          }
        }
      } catch (e) {
        debugPrint('Error in voice alert: $e');
      }
    });
  }

  Future<void> startWakeWordDetection() async {
    await _audioStreamService.startStreaming();
    notifyListeners();
  }

  Future<void> stopWakeWordDetection() async {
    await _audioStreamService.stopStreaming();
    notifyListeners();
  }

  @override
  void toggleRealtime(bool enable) {
    if (enable) {
      // Try to connect - socket has built-in reconnection (20 attempts, 3s delay)
      _connectionError = '';
      _isConnected = true; // Start as connected, socket will update status
      socketService.connect();
    } else {
      stopWakeWordDetection();
      socketService.disconnect();
      _isRealtimeEnabled = false;
    }
    notifyListeners();
  }

  /// Manual retry - user can tap to retry connection
  Future<void> retryConnection() async {
    _connectionError = '';
    _isConnected = true;
    notifyListeners();

    // Disconnect first to force a fresh connection attempt
    socketService.disconnect();
    await Future.delayed(const Duration(milliseconds: 500));
    socketService.connect();
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

  void addMessage(
    String role,
    String text, {
    String? image,
    bool shouldType = true,
  }) {
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
            timestamp = DateTime.parse(
              m['timestamp'],
            ).toLocal().millisecondsSinceEpoch;
          } catch (e) {
            // fallback
          }
        }
        
        String contentStr = m['content']?.toString() ?? '';
        String? parsedImageUrl;
        
        final RegExp regExp = RegExp(r"\[Attached Image: (.*?)\]");
        final match = regExp.firstMatch(contentStr);
        if (match != null) {
           parsedImageUrl = AppConfig.formatImageUrl(match.group(1));
           contentStr = contentStr.replaceAll(regExp, "").trim();
        }

        return {
          'id':
              DateTime.now().millisecondsSinceEpoch.toString() +
              m['content'].hashCode.toString(),
          'type': m['role'] == 'user' ? 'user' : 'ai',
          'text': contentStr,
          'image': parsedImageUrl,
          'shouldType': false, // History should not type
          'timestamp': timestamp,
        };
      }).toList();
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> sendMessage(
    String text, {
    String? imagePath,
    String language = 'auto',
    bool isWakeWord = false,
  }) async {
    _isThinking = true;
    notifyListeners();

    String finalText = text.isEmpty && isWakeWord ? 'Hey Buddy' : text;

    if (imagePath != null) {
      try {
        final uploadRes = await _buddyService.uploadChatFile(File(imagePath));
        if (uploadRes['success'] == true && uploadRes['data'] != null) {
          final imageUrl = uploadRes['data']['fileUrl'] ?? uploadRes['data'].toString();
          if (imageUrl is String && imageUrl.isNotEmpty) {
             if (finalText.trim().isEmpty) {
                finalText = "I have uploaded an image: $imageUrl\nPlease analyze its contents. If it contains text or important information, save it as a Document (using save_document tool).";
             } else {
                finalText = "$finalText\n\n[Attached Image: $imageUrl]".trim();
             }
          }
        }
      } catch (e) {
        debugPrint("Image Upload Error: $e");
      }
    }

    await stopAllAudio(); // STOP PREVIOUS VOICE IMMEDIATELY

    try {
      final token = await _storage.read(key: 'jwt');
      // Bugfix: Web app defaults to General ('stream') for human-like conversational capability.
      // App mistakenly tied Socket state to Realtime Web Search mode, making it robotic.
      String endpoint = 'stream'; 
      final url = Uri.parse('${AppConfig.baseUrl}ai/chat/$endpoint');

      final request = http.Request('POST', url)
        ..headers['Content-Type'] = 'application/json'
        ..headers['x-platform'] = 'mobile';

      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      request.body = jsonEncode({
        'message': finalText,
        'session_id': _currentConversationId,
        'tts': true, // Enforce cloud TTS to match web dashboard audio tone exactly
      });

      final client = http.Client();
      final response = await client.send(request).timeout(const Duration(seconds: 15));

      if (response.statusCode == 401) {
        _needsLogin = true;
        _isThinking = false;
        notifyListeners();
        return;
      }

      _isThinking = false;
      
      // Clear previous partial indicator
      for (var m in _messages) {
        m['isPartial'] = false;
        m['shouldType'] = false;
      }

      // Pre-add the empty Assistant message
      _messages.add({
         'id': 'api_${DateTime.now().millisecondsSinceEpoch}',
         'type': 'ai',
         'text': '',
         'isPartial': true,
         'shouldType': false,
         'timestamp': DateTime.now().millisecondsSinceEpoch,
      });
      notifyListeners();

      // Buffer for incomplete SSE network packets
      String streamBuffer = '';

      // Start reading the HTTP Stream chunk by chunk!
      response.stream.transform(utf8.decoder).listen(
        (chunkData) {
          streamBuffer += chunkData;

          // SSE chunks are separated by double newlines (\n\n)
          while (streamBuffer.contains('\n\n')) {
            int index = streamBuffer.indexOf('\n\n');
            String eventChunk = streamBuffer.substring(0, index).trim();
            streamBuffer = streamBuffer.substring(index + 2);

            if (eventChunk.startsWith('data: ')) {
              String jsonStr = eventChunk.substring(6);
              try {
                final parsed = jsonDecode(jsonStr);
                
                // If there's an error from Python, display it securely.
                if (parsed['error'] != null) {
                   if (_messages.isNotEmpty && _messages.last['type'] == 'ai') {
                      _messages.last['text'] += "\n\nError: ${parsed['error']}";
                   }
                   continue;
                }

                if (parsed['audio'] != null) {
                  _audioChunkQueue.add(parsed['audio']);
                  _processAudioChunkQueue();
                }

                if (parsed['chunk'] != null && _messages.isNotEmpty && _messages.last['type'] == 'ai' && _messages.last['isPartial'] == true) {
                  String actualText = parsed['chunk'];
                  _messages.last['text'] += actualText;
                }
              } catch (e) {
                // Ignore incomplete json fragments or malformed lines
              }
            }
          }
          notifyListeners();
        },
        onDone: () {
          if (_messages.isNotEmpty && _messages.last['isPartial'] == true) {
            _messages.last['isPartial'] = false;
          }
          // Flush TTS
          if (_ttsBuffer.trim().isNotEmpty) {
            _ttsQueue.add(_ttsBuffer.trim());
            _ttsBuffer = '';
            _processTtsQueue();
          }
          _isThinking = false;
          notifyListeners();
          client.close();
        },
        onError: (err) {
          debugPrint('API Stream Error: $err');
          _isThinking = false;
          
          notifyListeners();
          client.close();
        },
      );

    } catch (e) {
      debugPrint("HTTP Stream Request Error: $e");
      addMessage('ai', "Error connecting to AI: $e");
      _isThinking = false;
      
      notifyListeners();
    }
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
