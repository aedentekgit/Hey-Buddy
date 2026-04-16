import "package:flutter/foundation.dart";

import 'dart:async';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:record/record.dart';
import 'package:buddy_mobile/core/services/socket_service.dart';

class AudioStreamService {
  static const MethodChannel _foregroundServiceChannel = MethodChannel(
    'buddy/foreground_service',
  );

  final AudioRecorder _recorder = AudioRecorder();
  final SocketService _socketService;
  StreamSubscription? _audioSubscription;
  bool _isStreaming = false;
  bool _isForegroundServiceActive = false;

  AudioStreamService(this._socketService);

  bool get isStreaming => _isStreaming;

  Future<void> _startAndroidForegroundService() async {
    if (!Platform.isAndroid || _isForegroundServiceActive) return;
    try {
      await _foregroundServiceChannel.invokeMethod('start_wake_word_service');
      _isForegroundServiceActive = true;
      debugPrint('✅ Android wake-word foreground service started');
    } catch (e) {
      debugPrint('❌ Failed to start Android wake-word service: $e');
    }
  }

  Future<void> _stopAndroidForegroundService() async {
    if (!Platform.isAndroid || !_isForegroundServiceActive) return;
    try {
      await _foregroundServiceChannel.invokeMethod('stop_wake_word_service');
      debugPrint('🛑 Android wake-word foreground service stopped');
    } catch (e) {
      debugPrint('❌ Failed to stop Android wake-word service: $e');
    } finally {
      _isForegroundServiceActive = false;
    }
  }

  Future<void> startStreaming() async {
    if (_isStreaming) return;

    try {
      // On iOS Simulator, microphone doesn't work properly
      // We'll still try to initialize but won't fail if permission check fails
      bool hasPermission = await _recorder.hasPermission();

      if (!hasPermission) {
        if (Platform.isIOS && kDebugMode) {
          debugPrint(
            '⚠️ Microphone permission not available (this is expected on iOS Simulator)',
          );
          debugPrint('💡 Voice recording requires a real iOS device');
          return;
        }
        debugPrint('❌ Microphone permission denied');
        return;
      }

      const config = RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 16000,
        numChannels: 1,
      );

      await _startAndroidForegroundService();
      final stream = await _recorder.startStream(config);

      _audioSubscription = stream.listen((data) {
        // debugPrint('🎵 Audio chunk sent: ${data.length} bytes');
        _socketService.sendAudioChunk(data);
      });

      _isStreaming = true;
      debugPrint('🎙️ Audio streaming started (PCM 16kHz)');
    } catch (e) {
      if (Platform.isIOS && kDebugMode) {
        debugPrint('⚠️ Audio streaming not available on iOS Simulator: $e');
        debugPrint('💡 Use a real iOS device for voice recording features');
      } else {
        debugPrint('❌ Error starting audio stream: $e');
      }
      await _stopAndroidForegroundService();
    }
  }

  Future<void> stopStreaming() async {
    if (_isStreaming) {
      await _audioSubscription?.cancel();
      _audioSubscription = null;
      await _recorder.stop();
      _isStreaming = false;
      debugPrint('🛑 Audio streaming stopped');
    }
    await _stopAndroidForegroundService();
  }

  void dispose() {
    stopStreaming();
    _recorder.dispose();
  }
}
