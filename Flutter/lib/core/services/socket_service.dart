import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SocketService {
  IO.Socket? socket;
  final _storage = const FlutterSecureStorage();
  
  // Streams for the UI to listen to
  final _audioStreamController = StreamController<String>.broadcast();
  final _captionStreamController = StreamController<String>.broadcast();
  final _statusStreamController = StreamController<bool>.broadcast();
  final _voiceAlertStreamController = StreamController<Map<String, dynamic>>.broadcast();
  final _wakeWordStreamController = StreamController<Map<String, dynamic>>.broadcast();
  final _chatStreamController = StreamController<Map<String, dynamic>>.broadcast();
  final _bargeInController = StreamController<dynamic>.broadcast();
  final _stopCmdController = StreamController<dynamic>.broadcast();

  Stream<String> get audioStream => _audioStreamController.stream;
  Stream<String> get captionStream => _captionStreamController.stream;
  Stream<bool> get statusStream => _statusStreamController.stream;
  Stream<Map<String, dynamic>> get voiceAlertStream => _voiceAlertStreamController.stream;
  Stream<Map<String, dynamic>> get wakeWordStream => _wakeWordStreamController.stream;
  Stream<Map<String, dynamic>> get chatStream => _chatStreamController.stream;
  Stream<dynamic> get bargeInStream => _bargeInController.stream;
  Stream<dynamic> get stopCommandStream => _stopCmdController.stream;

  String? _lastToken;
  bool _isConnecting = false;
  bool _isDisposed = false;

  void _safeAdd<T>(StreamController<T> controller, T event) {
    if (!controller.isClosed && !_isDisposed) {
      controller.add(event);
    }
  }

  void connect() async {
    if (_isConnecting) return;
    _isConnecting = true;

    try {
      final token = await _storage.read(key: 'jwt');
      
      if (socket?.connected == true && _lastToken == token) {
        print('Socket already connected with same token, skipping initialization');
        _isConnecting = false;
        return;
      }

      if (socket != null) {
        print('Refreshing socket connection due to token change or reconnection request');
        socket?.disconnect();
        socket?.dispose();
        socket = null;
      }

      _lastToken = token;
      print('Attempting to connect to socket: ${AppConfig.socketUrl} (Token Present: ${token != null})');
      
      socket = IO.io(AppConfig.socketUrl, 
        IO.OptionBuilder()
          .setTransports(['websocket', 'polling']) 
          .setAuth({'token': token})
          .setReconnectionAttempts(20) 
          .setReconnectionDelay(3000)
          .disableAutoConnect() 
          .setQuery({'platform': 'mobile'})
          .build()
      );

    socket?.connect();

    // CLEAR PREVIOUS LISTENERS to prevent duplicates if connect() is called multiple times
    socket?.off('connect');
    socket?.off('disconnect');
    socket?.off('audio_out');
    socket?.off('caption');
    socket?.off('error');
    socket?.off('connect_error');
    socket?.off('voice_alert');
    socket?.off('wake_word_detected');
    socket?.off('barge_in_detected');
    socket?.off('stop_command');

    socket?.onConnect((_) {
      print('Socket Connected successfully to ${AppConfig.socketUrl}');
      _safeAdd(_statusStreamController, true);
      // Initialize agent in standby mode so it listens for wake word
      socket?.emit('setup_agent', {
        'language': 'en-US',
        'standby': true
      });
    });

    socket?.onDisconnect((_) {
      print('Socket Disconnected');
      _safeAdd(_statusStreamController, false);
    });

    socket?.on('audio_out', (data) {
      // Data is base64 audio chunk
      _safeAdd(_audioStreamController, data);
    });

    socket?.on('caption', (text) {
      _safeAdd(_captionStreamController, text);
    });

    socket?.on('connect_error', (data) {
      print('Socket Connection Error: $data');
      _isConnecting = false;
    });

    socket?.on('error', (err) {
      print('Socket Error: $err');
      _isConnecting = false;
    });
    
    socket?.on('voice_alert', (data) {
      print('Background Voice Alert: $data');
      if (data is String) {
        _safeAdd(_voiceAlertStreamController, {'text': data});
      } else if (data is Map) {
        _safeAdd(_voiceAlertStreamController, Map<String, dynamic>.from(data));
      }
    });

    socket?.on('wake_word_detected', (data) {
      print('Wake Word Detected in Backend: $data');
      if (data is Map) {
        _safeAdd(_wakeWordStreamController, Map<String, dynamic>.from(data));
      } else {
        _safeAdd(_wakeWordStreamController, {'transcript': 'hey buddy'});
      }
    });

    socket?.on('barge_in_detected', (data) {
      print('Barge-In Detected in Backend: $data');
      _safeAdd(_bargeInController, data);
    });

    socket?.on('stop_command', (data) {
      print('Stop Command Detected in Backend: $data');
      _safeAdd(_stopCmdController, data);
    });

    socket?.on('new_message', (data) {
      print('New Chat Message Received: $data');
      if (data is Map) {
        _safeAdd(_chatStreamController, Map<String, dynamic>.from(data));
      }
    });
    
    // Successfully started connection flow
    _isConnecting = false;
    } catch (e) {
      print('Unhandled exception in socket connect: $e');
      _isConnecting = false;
    }
  }

  void sendText(String text) {
    socket?.emit('text_message', text);
  }

  void sendAudioChunk(List<int> chunk) {
    socket?.emit('audio_chunk', chunk);
  }

  void interrupt() {
    socket?.emit('user_interruption');
  }

  void joinChatRoom(String roomId) {
    socket?.emit('join_room', roomId);
  }

  void sendChatMessage(String roomId, String senderId, String content) {
    socket?.emit('send_message', {
      'roomId': roomId,
      'senderId': senderId,
      'content': content
    });
  }

  void disconnect() {
    socket?.disconnect();
  }

  void dispose() {
    _isDisposed = true;
    socket?.disconnect();
    socket?.dispose();
    _audioStreamController.close();
    _captionStreamController.close();
    _statusStreamController.close();
    _voiceAlertStreamController.close();
    _wakeWordStreamController.close();
    _chatStreamController.close();
    _bargeInController.close();
    _stopCmdController.close();
  }
}
