import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';

class SocketService {
  IO.Socket? socket;
  final _storage = const FlutterSecureStorage();
  
  // Streams for the UI to listen to
  final _audioStreamController = StreamController<String>.broadcast();
  final _captionStreamController = StreamController<String>.broadcast();
  final _statusStreamController = StreamController<bool>.broadcast();

  Stream<String> get audioStream => _audioStreamController.stream;
  Stream<String> get captionStream => _captionStreamController.stream;
  Stream<bool> get statusStream => _statusStreamController.stream;

  void connect() async {
    final token = await _storage.read(key: 'token');
    
    socket = IO.io(AppConfig.socketUrl, 
      IO.OptionBuilder()
        .setTransports(['websocket'])
        .setAuth({'token': token})
        .disableAutoConnect()
        .build()
    );

    socket?.connect();

    socket?.onConnect((_) {
      print('Socket Connected');
      _statusStreamController.add(true);
      // Initialize agent
      socket?.emit('setup_agent', {'language': 'en-US'});
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

    socket?.on('error', (err) {
      print('Socket Error: $err');
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
  }
}
