// ignore_for_file: library_prefixes
import "package:flutter/foundation.dart";

import 'dart:async';
import 'dart:io';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class SocketService {
  IO.Socket? socket;
  final _storage = const FlutterSecureStorage();

  // Streams for the UI to listen to
  final _audioStreamController = StreamController<String>.broadcast();
  final _captionStreamController = StreamController<String>.broadcast();
  final _statusStreamController = StreamController<bool>.broadcast();
  final _voiceAlertStreamController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _wakeWordStreamController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _chatStreamController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _messageUpdatedStreamController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _messagesReadStreamController =
      StreamController<Map<String, dynamic>>.broadcast();
  final _bargeInController = StreamController<dynamic>.broadcast();
  final _stopCmdController = StreamController<dynamic>.broadcast();
  final _connectErrorStreamController = StreamController<dynamic>.broadcast();
  final _errorStreamController = StreamController<dynamic>.broadcast();
  final _turnStartedStreamController = StreamController<dynamic>.broadcast();
  final _responseDoneStreamController = StreamController<dynamic>.broadcast();
  final _dataSyncStreamController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<String> get audioStream => _audioStreamController.stream;
  Stream<String> get captionStream => _captionStreamController.stream;
  Stream<bool> get statusStream => _statusStreamController.stream;
  Stream<Map<String, dynamic>> get voiceAlertStream =>
      _voiceAlertStreamController.stream;
  Stream<Map<String, dynamic>> get wakeWordStream =>
      _wakeWordStreamController.stream;
  Stream<Map<String, dynamic>> get chatStream => _chatStreamController.stream;
  Stream<Map<String, dynamic>> get messageUpdatedStream =>
      _messageUpdatedStreamController.stream;
  Stream<Map<String, dynamic>> get messagesReadStream =>
      _messagesReadStreamController.stream;
  Stream<dynamic> get bargeInStream => _bargeInController.stream;
  Stream<dynamic> get stopCommandStream => _stopCmdController.stream;
  Stream<dynamic> get connectErrorStream => _connectErrorStreamController.stream;
  Stream<dynamic> get errorStream => _errorStreamController.stream;
  Stream<dynamic> get turnStartedStream => _turnStartedStreamController.stream;
  Stream<dynamic> get responseDoneStream => _responseDoneStreamController.stream;
  Stream<Map<String, dynamic>> get dataSyncStream => _dataSyncStreamController.stream;

  String? _lastToken;
  bool _isConnecting = false;
  bool _isDisposed = false;

  void _safeAdd<T>(StreamController<T> controller, T event) {
    if (!controller.isClosed && !_isDisposed) {
      controller.add(event);
    }
  }

  /// Health check - pings the backend to see if it's reachable
  /// Returns true if backend is responding, false otherwise
  Future<bool> checkServerHealth() async {
    try {
      final baseUrl = AppConfig.baseUrl.replaceAll('/api/', '');
      final healthUrl = '${baseUrl}health';
      debugPrint('🔍 Checking server health at: $healthUrl');

      final response = await http.get(Uri.parse(healthUrl)).timeout(
        const Duration(seconds: 5),
      );

      if (response.statusCode == 200) {
        debugPrint('✅ Server health check passed');
        return true;
      } else {
        debugPrint('⚠️ Server health check failed with status: ${response.statusCode}');
        return false;
      }
    } on SocketException catch (e) {
      debugPrint('❌ Server health check failed - Socket exception: ${e.message}');
      return false;
    } catch (e) {
      debugPrint('❌ Server health check failed: $e');
      return false;
    }
  }

  void connect() async {
    if (_isConnecting) return;
    _isConnecting = true;

    try {
      final token = await _storage.read(key: 'jwt');

      if (socket?.connected == true && _lastToken == token) {
        debugPrint(
          'Socket already connected with same token, skipping initialization',
        );
        _isConnecting = false;
        return;
      }

      if (socket != null) {
        debugPrint(
          'Refreshing socket connection due to token change or reconnection request',
        );
        socket?.disconnect();
        socket?.dispose();
        socket = null;
      }

      _lastToken = token;
      debugPrint(
        'Attempting to connect to socket: ${AppConfig.socketUrl} (Token Present: ${token != null})',
      );

      socket = IO.io(
        AppConfig.socketUrl,
        IO.OptionBuilder()
            .setTransports(['websocket', 'polling'])
            .setAuth({'token': token})
            .setReconnectionAttempts(20)
            .setReconnectionDelay(3000)
            .disableAutoConnect()
            .setQuery({'platform': 'mobile'})
            .build(),
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
      socket?.off('turn_started');
      socket?.off('response_done');
      socket?.off('data_sync');

      socket?.onConnect((_) {
        debugPrint('Socket Connected successfully to ${AppConfig.socketUrl}');
        _safeAdd(_statusStreamController, true);
        // Initialize agent in standby mode so it listens for wake word
        socket?.emit('setup_agent', {'language': 'en-US', 'standby': true});
      });

      socket?.onDisconnect((_) {
        debugPrint('Socket Disconnected');
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
        debugPrint('Socket Connection Error: $data');
        _safeAdd(_statusStreamController, false);
        _safeAdd(_connectErrorStreamController, data);
        _isConnecting = false;
      });

      socket?.on('error', (err) {
        debugPrint('Socket Error: $err');
        _safeAdd(_statusStreamController, false);
        _safeAdd(_errorStreamController, err);
        _isConnecting = false;
      });

      socket?.on('turn_started', (data) {
        _safeAdd(_turnStartedStreamController, data);
      });

      socket?.on('response_done', (data) {
        _safeAdd(_responseDoneStreamController, data);
      });

      socket?.on('voice_alert', (data) {
        debugPrint('Background Voice Alert: $data');
        if (data is String) {
          _safeAdd(_voiceAlertStreamController, {'text': data});
        } else if (data is Map) {
          _safeAdd(
            _voiceAlertStreamController,
            Map<String, dynamic>.from(data),
          );
        }
      });

      socket?.on('wake_word_detected', (data) {
        debugPrint('Wake Word Detected in Backend: $data');
        if (data is Map) {
          _safeAdd(_wakeWordStreamController, Map<String, dynamic>.from(data));
        } else {
          _safeAdd(_wakeWordStreamController, {'transcript': 'hey buddy'});
        }
      });

      socket?.on('barge_in_detected', (data) {
        debugPrint('Barge-In Detected in Backend: $data');
        _safeAdd(_bargeInController, data);
      });

      socket?.on('stop_command', (data) {
        debugPrint('Stop Command Detected in Backend: $data');
        _safeAdd(_stopCmdController, data);
      });

      socket?.on('new_message', (data) {
        debugPrint('New Chat Message Received: $data');
        if (data is Map) {
          _safeAdd(_chatStreamController, Map<String, dynamic>.from(data));
        }
      });

      socket?.on('message_updated', (data) {
        debugPrint('Message Updated: $data');
        if (data is Map) {
          _safeAdd(_messageUpdatedStreamController, Map<String, dynamic>.from(data));
        }
      });

      socket?.on('messages_read', (data) {
        debugPrint('Messages Read: $data');
        if (data is Map) {
          _safeAdd(_messagesReadStreamController, Map<String, dynamic>.from(data));
        }
      });
      socket?.on('data_sync', (data) {
        debugPrint('📡 Data Sync Requested: $data');
        if (data is Map) {
          _safeAdd(_dataSyncStreamController, Map<String, dynamic>.from(data));
        }
      });

      // Successfully started connection flow
      _isConnecting = false;
    } catch (e) {
      debugPrint('Unhandled exception in socket connect: $e');
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

  void sendChatMessage(
    String roomId,
    String senderId,
    String content, {
    String? replyTo,
    String? fileUrl,
    String? fileName,
    String? fileType,
  }) {
    socket?.emit('send_message', {
      'roomId': roomId,
      'senderId': senderId,
      'content': content,
      'replyTo': replyTo,
      'fileUrl': fileUrl,
      'fileName': fileName,
      'fileType': fileType,
    });
  }

  void reactToMessage(String roomId, String senderId, String messageId, String emoji) {
    socket?.emit('react_message', {
      'roomId': roomId,
      'senderId': senderId,
      'messageId': messageId,
      'emoji': emoji,
    });
  }

  void starMessage(String roomId, String userId, String messageId, bool isStarred) {
    socket?.emit('star_message', {
      'roomId': roomId,
      'userId': userId,
      'messageId': messageId,
      'isStarred': isStarred,
    });
  }

  void pinMessage(String roomId, String messageId, bool isPinned) {
    socket?.emit('pin_message', {
      'roomId': roomId,
      'messageId': messageId,
      'isPinned': isPinned,
    });
  }

  void forwardMessage(String targetRoomId, String senderId, String originalMessageId) {
    socket?.emit('forward_message', {
      'targetRoomId': targetRoomId,
      'senderId': senderId,
      'originalMessageId': originalMessageId,
    });
  }

  void markMessagesRead(String roomId, String userId) {
    socket?.emit('mark_read', {
      'roomId': roomId,
      'userId': userId,
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
    _messageUpdatedStreamController.close();
    _messagesReadStreamController.close();
    _bargeInController.close();
    _stopCmdController.close();
    _connectErrorStreamController.close();
    _errorStreamController.close();
    _turnStartedStreamController.close();
    _responseDoneStreamController.close();
    _dataSyncStreamController.close();
  }
}
