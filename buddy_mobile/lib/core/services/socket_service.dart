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

  Stream<String> get audioStream => _audioStreamController.stream;
  Stream<String> get captionStream => _captionStreamController.stream;
  Stream<bool> get statusStream => _statusStreamController.stream;
  Stream<Map<String, dynamic>> get voiceAlertStream => _voiceAlertStreamController.stream;
  Stream<Map<String, dynamic>> get wakeWordStream => _wakeWordStreamController.stream;

  void connect() async {
    if (socket?.connected == true) {
      print('Socket already connected, skipping initialization');
      return;
    }

    final token = await _storage.read(key: 'jwt');
    
    print('Attempting to connect to socket: ${AppConfig.socketUrl}');
    socket = IO.io(AppConfig.socketUrl, 
      IO.OptionBuilder()
        .setTransports(['websocket', 'polling']) // Allow fallback for unstable networks
        .setAuth({'token': token})
        .setReconnectionAttempts(20) // Increased for robustness
        .setReconnectionDelay(3000)
        .setExtraHeaders({
          'origin': 'capacitor://localhost',
          'access-control-allow-origin': '*',
        })
        .disableAutoConnect() // Keep discovery manual
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

    socket?.onConnect((_) {
      print('Socket Connected successfully to ${AppConfig.socketUrl}');
      _statusStreamController.add(true);
      // Initialize agent in standby mode so it listens for wake word
      socket?.emit('setup_agent', {
        'language': 'en-US',
        'standby': true
      });
    });

    socket?.onDisconnect((_) {
      print('Socket Disconnected');
      _statusStreamController.add(false);
    });

    socket?.on('audio_out', (data) {
      // Data is base64 audio chunk
      _audioStreamController.add(data);
    });

    socket?.on('caption', (text) {
      _captionStreamController.add(text);
    });

    socket?.on('connect_error', (data) {
      print('Socket Connection Error: $data');
    });

    socket?.on('error', (err) {
      print('Socket Error: $err');
    });
    
    socket?.on('voice_alert', (data) {
      print('Background Voice Alert: $data');
      if (data is String) {
        _voiceAlertStreamController.add({'text': data});
      } else if (data is Map) {
        _voiceAlertStreamController.add(Map<String, dynamic>.from(data));
      }
    });

    socket?.on('wake_word_detected', (data) {
      print('Wake Word Detected in Backend: $data');
      if (data is Map) {
        _wakeWordStreamController.add(Map<String, dynamic>.from(data));
      } else {
        _wakeWordStreamController.add({'transcript': 'hey buddy'});
      }
    });
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

  void dispose() {
    socket?.disconnect();
    _audioStreamController.close();
    _captionStreamController.close();
    _statusStreamController.close();
    _voiceAlertStreamController.close();
    _wakeWordStreamController.close();
  }
}
