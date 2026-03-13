import 'dart:async';
import 'package:record/record.dart';
import 'package:buddy_mobile/core/services/socket_service.dart';

class AudioStreamService {
  final AudioRecorder _recorder = AudioRecorder();
  final SocketService _socketService;
  StreamSubscription? _audioSubscription;
  bool _isStreaming = false;

  AudioStreamService(this._socketService);

  bool get isStreaming => _isStreaming;

  Future<void> startStreaming() async {
    if (_isStreaming) return;

    try {
      if (await _recorder.hasPermission()) {
        const config = RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: 16000,
          numChannels: 1,
        );

        final stream = await _recorder.startStream(config);

        _audioSubscription = stream.listen((data) {
          _socketService.sendAudioChunk(data);
        });

        _isStreaming = true;
        print('🎙️ Audio streaming started (PCM 16kHz)');
      } else {
        print('❌ Microphone permission denied');
      }
    } catch (e) {
      print('❌ Error starting audio stream: $e');
    }
  }

  Future<void> stopStreaming() async {
    if (!_isStreaming) return;

    await _audioSubscription?.cancel();
    await _recorder.stop();
    _isStreaming = false;
    print('🛑 Audio streaming stopped');
  }

  void dispose() {
    stopStreaming();
    _recorder.dispose();
  }
}
