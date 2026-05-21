import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:async';
import 'dart:typed_data';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/animated_ai_input_field.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_tts/flutter_tts.dart';

class BuddyAssistantPage extends StatefulWidget {
  final bool isIntegrated;
  final VoidCallback? onClose;
  final VoidCallback? onExplore;

  const BuddyAssistantPage({
    super.key,
    this.isIntegrated = false,
    this.onClose,
    this.onExplore,
  });

  @override
  State<BuddyAssistantPage> createState() => _BuddyAssistantPageState();
}

class _BuddyAssistantPageState extends State<BuddyAssistantPage>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  final String _controlUrl = AppConfig.controlHttpUrl;
  final String _voiceUrl = AppConfig.voiceWsUrl;

  final TextEditingController _commandController = TextEditingController();
  final ScrollController _logScrollController = ScrollController();

  WebSocket? _wsChannel;
  bool _isConnected = false;
  String _assistantState = 'THINKING'; // LISTENING, THINKING, SPEAKING
  bool _isMuted = true;
  String? _pendingTextAfterConnect; // text to send once WS connects
  int _messageLimit = 15;
  final List<String> _logs = [];
  bool _isPlayingAudio = false;
  String _latestServerState = 'THINKING';

  // Audio playback and recording variables
  late final AudioRecorder _audioRecorder;
  late final AudioPlayer _audioPlayer;
  bool _isMicRecording = false;
  final BytesBuilder _audioBuffer = BytesBuilder();
  StreamSubscription<Uint8List>? _recordSub;
  final FlutterTts _flutterTts = FlutterTts();

  // Streaming TTS state variables
  int _parsedTextLength = 0;
  String _unspokenBuffer = '';
  final List<String> _ttsQueue = [];
  bool _isTtsSpeaking = false;

  @override
  void initState() {
    super.initState();
    _audioRecorder = AudioRecorder();
    _audioPlayer = AudioPlayer();
    _configureAudioPlayer();

    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _isPlayingAudio = false;
          _assistantState = _latestServerState;
        });
        _updateVoiceStreamState();
      }
    });

    _initTts();
    _connectWebSocket();
    _checkInitialSettings();
  }

  @override
  void dispose() {
    _wsChannel?.close();
    _commandController.dispose();
    _logScrollController.dispose();
    _recordSub?.cancel();
    _audioRecorder.dispose();
    _audioPlayer.stop();
    _audioPlayer.dispose();
    _flutterTts.stop();
    super.dispose();
  }

  void _checkInitialSettings() async {
    try {
      final response = await http
          .get(Uri.parse('$_controlUrl/api/status'))
          .timeout(const Duration(seconds: 2));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        setState(() {
          _isConnected = true;
          _isMuted = data['muted'] == true;
          if (data['speaking'] == true) {
            _assistantState = 'SPEAKING';
          } else if (data['connected'] == true) {
            _assistantState = 'LISTENING';
          } else {
            _assistantState = 'THINKING';
          }
        });
        _updateVoiceStreamState();
      }
    } catch (_) {}
  }

  // ── TTS Setup ──────────────────────────────────────────────────────────────

  Future<void> _initTts() async {
    try {
      await _flutterTts.setLanguage('en-US');
      await _flutterTts.setSpeechRate(0.5); // Standard normal speaking rate on Android
      await _flutterTts.setVolume(1.0);
      await _flutterTts.setPitch(1.0);

      _flutterTts.setStartHandler(() {
        if (mounted) {
          setState(() {
            _isPlayingAudio = true;
            _assistantState = 'SPEAKING';
          });
          _updateVoiceStreamState(); // stops mic while speaking
        }
      });

      _flutterTts.setCompletionHandler(() {
        if (mounted) {
          _isTtsSpeaking = false;
          if (_ttsQueue.isNotEmpty) {
            _playNextTtsFromQueue();
          } else {
            setState(() {
              _isPlayingAudio = false;
              // After speaking, go back to LISTENING so mic re-opens
              _assistantState =
                  (_latestServerState == 'MUTED') ? 'THINKING' : 'LISTENING';
            });
            _updateVoiceStreamState(); // re-opens mic
          }
        }
      });

      _flutterTts.setCancelHandler(() {
        if (mounted) {
          _isTtsSpeaking = false;
          _ttsQueue.clear();
          setState(() {
            _isPlayingAudio = false;
            _assistantState = _latestServerState;
          });
          _updateVoiceStreamState();
        }
      });

      _flutterTts.setErrorHandler((msg) {
        if (mounted) {
          _isTtsSpeaking = false;
          _ttsQueue.clear();
          setState(() {
            _isPlayingAudio = false;
            _assistantState = _latestServerState;
          });
          _updateVoiceStreamState();
          debugPrint('[System] TTS Error: $msg');
        }
      });
    } catch (e) {
      debugPrint('[System] TTS init warning: $e');
    }
  }

  void _streamTtsResponse(String text, {required bool isFinal}) {
    if (_isMuted) return;

    if (text.length < _parsedTextLength || text.isEmpty) {
      _parsedTextLength = 0;
      _unspokenBuffer = '';
      _ttsQueue.clear();
    }

    if (text.length > _parsedTextLength) {
      String newPart = text.substring(_parsedTextLength);
      _parsedTextLength = text.length;
      _unspokenBuffer += newPart;
    }

    _processUnspokenBuffer(isFinal: isFinal);
  }

  void _processUnspokenBuffer({required bool isFinal}) {
    // Phrase separators: period, question mark, exclamation mark, semicolon, colon, comma, newline
    final RegExp phraseEnd = RegExp(r'[.!?;\n,]');

    int searchStart = 0;
    while (true) {
      final match = phraseEnd.firstMatch(_unspokenBuffer.substring(searchStart));

      if (match == null) {
        if (!isFinal && _unspokenBuffer.length > 45) {
          int lastSpaceIdx = _unspokenBuffer.lastIndexOf(' ');
          if (lastSpaceIdx > 15) {
            String chunk = _unspokenBuffer.substring(0, lastSpaceIdx).trim();
            _unspokenBuffer = _unspokenBuffer.substring(lastSpaceIdx + 1);
            if (chunk.isNotEmpty) {
              _ttsQueue.add(chunk);
            }
            searchStart = 0;
            continue;
          }
        }
        break;
      }

      int endIdx = searchStart + match.end;
      String phrase = _unspokenBuffer.substring(0, endIdx).trim();
      _unspokenBuffer = _unspokenBuffer.substring(endIdx);
      searchStart = 0;

      if (phrase.isNotEmpty) {
        _ttsQueue.add(phrase);
      }
    }

    if (isFinal) {
      String remaining = _unspokenBuffer.trim();
      if (remaining.isNotEmpty) {
        _ttsQueue.add(remaining);
      }
      _unspokenBuffer = '';
    }

    _playNextTtsFromQueue();
  }

  String _detectLanguage(String text) {
    // Check for Tamil characters (Unicode block: 0B80–0BFF)
    if (RegExp(r'[\u0B80-\u0BFF]').hasMatch(text)) {
      return 'ta-IN';
    }
    // Check for Hindi/Devanagari characters (Unicode block: 0900–097F)
    if (RegExp(r'[\u0900-\u097F]').hasMatch(text)) {
      return 'hi-IN';
    }
    // Check for Telugu characters (Unicode block: 0C00–0C7F)
    if (RegExp(r'[\u0C00-\u0C7F]').hasMatch(text)) {
      return 'te-IN';
    }
    // Check for Kannada characters (Unicode block: 0C80–0CFF)
    if (RegExp(r'[\u0C80-\u0CFF]').hasMatch(text)) {
      return 'kn-IN';
    }
    // Check for Malayalam characters (Unicode block: 0D00–0D7F)
    if (RegExp(r'[\u0D00-\u0D7F]').hasMatch(text)) {
      return 'ml-IN';
    }
    // Default to English
    return 'en-US';
  }

  Future<void> _playNextTtsFromQueue() async {
    if (_isTtsSpeaking || _isMuted || _ttsQueue.isEmpty) return;

    _isTtsSpeaking = true;
    String nextSentence = _ttsQueue.removeAt(0);

    try {
      // Detect script and set language. If the device doesn't have that voice,
      // fall back silently to en-US so no error message is shown in chat.
      final String langCode = _detectLanguage(nextSentence);
      bool isAvailable = false;
      try {
        final result = await _flutterTts.isLanguageAvailable(langCode);
        if (result is bool) {
          isAvailable = result;
        } else if (result is int) {
          isAvailable = result == 1;
        } else if (result == 'true' || result == true) {
          isAvailable = true;
        }
      } catch (_) {}

      try {
        if (isAvailable) {
          await _flutterTts.setLanguage(langCode);
        } else {
          await _flutterTts.setLanguage('en-US');
        }
      } catch (_) {
        await _flutterTts.setLanguage('en-US');
      }
      await _flutterTts.speak(nextSentence);
    } catch (e) {
      // Don't show TTS errors to the user — just skip this phrase and continue
      _isTtsSpeaking = false;
      _playNextTtsFromQueue();
    }
  }

  Future<void> _stopAndClearTts() async {
    _ttsQueue.clear();
    _unspokenBuffer = '';
    _parsedTextLength = 0;
    _isTtsSpeaking = false;
    try {
      await _flutterTts.stop();
    } catch (_) {}
  }


  Future<void> _configureAudioPlayer() async {
    try {
      await _audioPlayer.setAudioContext(
        AudioContext(
          iOS: AudioContextIOS(
            category: AVAudioSessionCategory.playback,
            options: {
              AVAudioSessionOptions.mixWithOthers,
              AVAudioSessionOptions.duckOthers,
            },
          ),
          android: AudioContextAndroid(
            isSpeakerphoneOn: true,
            stayAwake: true,
            contentType: AndroidContentType.music,
            usageType: AndroidUsageType.media,
            audioFocus: AndroidAudioFocus.gain,
          ),
        ),
      );
    } catch (e) {
      debugPrint('[System] Warning: Failed to configure audio context: $e');
    }
  }


  void _connectWebSocket() async {
    try {
      _wsChannel = await WebSocket.connect(
        _voiceUrl,
      ).timeout(const Duration(seconds: 4));

      setState(() {
        _isConnected = true;
        _addLog('[System] Voice Stream Connected.');
      });
      _updateVoiceStreamState();

      // If text was typed while disconnected, send it now
      if (_pendingTextAfterConnect != null) {
        final pending = _pendingTextAfterConnect!;
        _pendingTextAfterConnect = null;
        // Small delay so server is fully ready to accept the message
        Future.delayed(const Duration(milliseconds: 400), () {
          if (mounted && _isConnected && _wsChannel != null) {
            _wsChannel!.add(json.encode({'type': 'text', 'text': pending}));
          }
        });
      }

      _wsChannel!.listen(
        (message) {
          if (message is String) {
            try {
              final data = json.decode(message);
              if (data['type'] == 'state') {
                final String s = data['state'] ?? 'THINKING';
                _latestServerState = s;
                if (s == 'MUTED') {
                  // Server is muted — update UI only.
                  // Do NOT close the WebSocket or abort TTS here so that:
                  //   1. TTS can finish speaking the current response.
                  //   2. The connection stays alive for future text commands.
                  // The connection is only closed when the user explicitly mutes
                  // or the server drops the socket.
                  setState(() {
                    _isMuted = true;
                    _assistantState = 'MUTED';
                  });
                  _updateVoiceStreamState();
                } else {
                  setState(() {
                    _isMuted = false;
                  });
                  if (!_isPlayingAudio && _audioBuffer.isEmpty) {
                    setState(() {
                      _assistantState = s;
                    });
                    _updateVoiceStreamState();
                  }
                }
              } else if (data['type'] == 'audio') {
                final String base64Data = data['data'] ?? '';
                if (base64Data.isNotEmpty) {
                  final bytes = base64.decode(base64Data);
                  _audioBuffer.add(bytes);
                }
              } else if (data['type'] == 'audio_end') {
                // Clear the PCM buffer — TTS is used for mobile audio output
                _audioBuffer.clear();
              } else if (data['type'] == 'audio_cancel') {
                _audioPlayer.stop();
                _stopAndClearTts();
                setState(() {
                  _isPlayingAudio = false;
                  _assistantState = _latestServerState;
                });
                _audioBuffer.clear();
                _updateVoiceStreamState();
              } else if (data['type'] == 'log') {
                final String text = data['text'] ?? '';
                if (text.contains('Shutdown requested') || text.contains('shutdown_buddy')) {
                  _stopAndClearTts();
                  setState(() {
                    _isMuted = true;
                    _assistantState = 'MUTED';
                  });
                  _updateVoiceStreamState();
                  _wsChannel?.close();
                }
                if (text.startsWith('[System]') || text.startsWith('[Error]')) {
                  _addLog(text);
                } else if (text.startsWith('SYS:')) {
                  _addLog(text.replaceFirst('SYS:', '[System]'));
                }
              } else if (data['type'] == 'transcript') {
                final String role = data['role'] ?? 'Buddy';
                final String text = data['text'] ?? '';
                final bool isFinal = data['is_final'] == true;

                setState(() {
                  final prefix = '$role: ';
                  int existingIndex = -1;
                  for (int i = _logs.length - 1; i >= 0; i--) {
                    if (_logs[i].startsWith(prefix) &&
                        !_logs[i].endsWith(' (final)')) {
                      existingIndex = i;
                      break;
                    }
                  }

                  if (existingIndex != -1) {
                    if (isFinal) {
                      _logs[existingIndex] = '$prefix$text (final)';
                    } else {
                      _logs[existingIndex] = '$prefix$text';
                    }
                  } else {
                    if (isFinal) {
                      _logs.add('$prefix$text (final)');
                    } else {
                      _logs.add('$prefix$text');
                    }
                  }
                });
                // Handle live TTS streaming for Buddy's response
                if (role == 'Buddy') {
                  _streamTtsResponse(text, isFinal: isFinal);
                }
                Future.delayed(const Duration(milliseconds: 100), () {
                  if (_logScrollController.hasClients) {
                    _logScrollController.animateTo(
                      _logScrollController.position.maxScrollExtent,
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOut,
                    );
                  }
                });
              } else if (data['type'] == 'history') {
                final List<dynamic> historyLogs = data['logs'] ?? [];
                setState(() {
                  _logs.removeWhere((log) => !log.startsWith('[Error]'));
                  _logs.addAll(
                    historyLogs.map(
                      (e) => e.toString().endsWith(' (final)')
                          ? e.toString()
                          : '${e.toString()} (final)',
                    ),
                  );
                });
                Future.delayed(const Duration(milliseconds: 100), () {
                  if (_logScrollController.hasClients) {
                    _logScrollController.animateTo(
                      _logScrollController.position.maxScrollExtent,
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOut,
                    );
                  }
                });
              }
            } catch (_) {}
          }
        },
        onError: (err) {
          _handleDisconnect('Connection error: $err');
        },
        onDone: () {
          _handleDisconnect('Connection closed.');
        },
      );
    } catch (e) {
      _handleDisconnect('Failed to connect: $e');
    }
  }

  void _handleDisconnect(String reason) {
    if (mounted) {
      setState(() {
        _isConnected = false;
        _isMuted = true; // Always mute/disable voice session on disconnect
        _assistantState = 'MUTED';
        _wsChannel = null;
      });
      _updateVoiceStreamState();
      _addLog('[System] Disconnected: $reason');
      
      // Retry connection after 5 seconds ONLY if not muted
      if (!_isMuted) {
        Future.delayed(const Duration(seconds: 5), () {
          if (mounted && !_isConnected && !_isMuted) {
            _connectWebSocket();
          }
        });
      }
    }
  }

  Future<void> _sendTextCommand(String text) async {
    if (text.isEmpty) return;
    _commandController.clear();
    _addLog('You: $text');
    await _stopAndClearTts();

    // If disconnected or muted, auto-connect and unmute so Buddy replies in voice + text
    if (!_isConnected || _isMuted) {
      setState(() {
        _isMuted = false;
        _assistantState = 'THINKING';
        _latestServerState = 'THINKING';
      });
      _updateVoiceStreamState();

      if (!_isConnected) {
        // Connect WebSocket first, then send text once connected
        _pendingTextAfterConnect = text;
        _connectWebSocket();
        return;
      }
    }

    if (_wsChannel != null && _isConnected) {
      _wsChannel!.add(json.encode({'type': 'text', 'text': text}));
    } else {
      // HTTP Fallback
      try {
        await http.post(
          Uri.parse('$_controlUrl/api/command'),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'text': text}),
        );
      } catch (e) {
        _addLog('[Error] Could not submit command: $e');
      }
    }
  }

  Future<void> _sendAction(
    String action, [
    Map<String, dynamic>? params,
  ]) async {
    if (action == 'mute_volume') {
      await _stopAndClearTts();
      setState(() {
        _isMuted = !_isMuted;
        if (!_isMuted) {
          // Turning mic ON
          _assistantState = 'LISTENING';
          _latestServerState = 'LISTENING';
        } else {
          // Turning mic OFF
          _assistantState = 'MUTED';
          _latestServerState = 'MUTED';
        }
      });
      if (!_isMuted && !_isConnected) {
        _connectWebSocket();
      } else {
        _updateVoiceStreamState();
      }
    }
    try {
      final response = await http.post(
        Uri.parse('$_controlUrl/api/action'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'action': action, 'parameters': params ?? {}}),
      );
      if (response.statusCode == 200) {
        json.decode(response.body);
      }
    } catch (e) {
      _addLog('[Error] Action execution failed: $e');
    }
  }

  Uint8List prependWavHeader(Uint8List pcm, int sampleRate, int channels, int bits) {
    final int totalAudioLen = pcm.length;
    final int totalDataLen = totalAudioLen + 36;
    final int byteRate = sampleRate * channels * bits ~/ 8;
    final int blockAlign = channels * bits ~/ 8;

    final header = Uint8List(44);
    final ByteData headerData = ByteData.view(header.buffer);

    // RIFF header
    headerData.setUint8(0, 0x52); // R
    headerData.setUint8(1, 0x49); // I
    headerData.setUint8(2, 0x46); // F
    headerData.setUint8(3, 0x46); // F
    headerData.setUint32(4, totalDataLen, Endian.little);
    headerData.setUint8(8, 0x57); // W
    headerData.setUint8(9, 0x41); // A
    headerData.setUint8(10, 0x56); // V
    headerData.setUint8(11, 0x45); // E

    // fmt chunk
    headerData.setUint8(12, 0x66); // f
    headerData.setUint8(13, 0x6D); // m
    headerData.setUint8(14, 0x74); // t
    headerData.setUint8(15, 0x20); // ' '
    headerData.setUint32(16, 16, Endian.little); // chunk size (16)
    headerData.setUint16(20, 1, Endian.little); // audio format (1 = PCM)
    headerData.setUint16(22, channels, Endian.little);
    headerData.setUint32(24, sampleRate, Endian.little);
    headerData.setUint32(28, byteRate, Endian.little);
    headerData.setUint16(32, blockAlign, Endian.little);
    headerData.setUint16(34, bits, Endian.little);

    // data chunk
    headerData.setUint8(36, 0x64); // d
    headerData.setUint8(37, 0x61); // a
    headerData.setUint8(38, 0x74); // t
    headerData.setUint8(39, 0x61); // a
    headerData.setUint32(40, totalAudioLen, Endian.little);

    final wav = Uint8List(44 + totalAudioLen);
    wav.setRange(0, 44, header);
    wav.setRange(44, wav.length, pcm);
    return wav;
  }

  Future<void> _startMicRecording() async {
    if (_isMicRecording) return;
    try {
      // Robust runtime microphone permission handling
      var status = await Permission.microphone.status;
      if (!status.isGranted) {
        status = await Permission.microphone.request();
      }

      if (status.isGranted) {
        // Also perform the recorder package's own check to be absolutely safe
        if (await _audioRecorder.hasPermission()) {
          final recordStream = await _audioRecorder.startStream(
            const RecordConfig(
              encoder: AudioEncoder.pcm16bits,
              sampleRate: 16000,
              numChannels: 1,
            ),
          );
          setState(() {
            _isMicRecording = true;
          });
          _recordSub = recordStream.listen((data) {
            if (_wsChannel != null && _isConnected) {
              _wsChannel!.add(data);
            }
          });
          return;
        }
      }

      // If we reach here, permission is denied
      _addLog('[System] Microphone permission denied. Please enable microphone access to use Voice Features.');
      if (status.isPermanentlyDenied) {
        _addLog('[System] Redirecting to App Settings to enable Microphone...');
        openAppSettings();
      }
    } catch (e) {
      _addLog('[Error] Failed to start microphone recording: $e');
    }
  }

  Future<void> _stopMicRecording() async {
    if (!_isMicRecording) return;
    try {
      await _recordSub?.cancel();
      _recordSub = null;
      await _audioRecorder.stop();
    } catch (_) {}
    setState(() {
      _isMicRecording = false;
    });
  }

  void _updateVoiceStreamState() {
    bool shouldRecord = _isConnected && !_isMuted && _assistantState == 'LISTENING';
    if (shouldRecord) {
      _startMicRecording();
    } else {
      _stopMicRecording();
    }
  }

  void _addLog(String log) {
    if (mounted) {
      setState(() {
        _logs.add(log);
      });
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_logScrollController.hasClients) {
          _logScrollController.animateTo(
            _logScrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final allVisibleLogs = _logs;
    final hasMoreMessages = allVisibleLogs.length > _messageLimit;
    final visibleLogs = hasMoreMessages
        ? allVisibleLogs.sublist(allVisibleLogs.length - _messageLimit)
        : allVisibleLogs;
    final showHistoryControls = allVisibleLogs.isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _logScrollController,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                itemCount: visibleLogs.length + (showHistoryControls ? 1 : 0),
                itemBuilder: (context, index) {
                  if (showHistoryControls && index == 0) {
                    return _buildHistoryControls(hasMoreMessages);
                  }

                  final log =
                      visibleLogs[index - (showHistoryControls ? 1 : 0)];

                  if (log.startsWith('[System]') || log.startsWith('[Error]')) {
                    final isSystem = log.startsWith('[System]');
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Text(
                          log,
                          style: GoogleFonts.outfit(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isSystem ? Colors.blueGrey.shade600 : Colors.redAccent.shade200,
                          ),
                        ),
                      ),
                    );
                  }

                  final isUser = log.startsWith('You:');
                  final messageText = log
                      .replaceFirst('You: ', '')
                      .replaceFirst('Buddy: ', '')
                      .replaceFirst(' (final)', '')
                      .trim();

                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: Row(
                      mainAxisAlignment: isUser
                          ? MainAxisAlignment.end
                          : MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (!isUser) ...[
                          const CircleAvatar(
                            radius: 16,
                            backgroundColor: Colors.transparent,
                            backgroundImage: AssetImage(
                              'assets/images/buddy_logo.png',
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Flexible(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: isUser ? Colors.purple : Colors.white,
                              borderRadius: BorderRadius.only(
                                topLeft: const Radius.circular(20),
                                topRight: const Radius.circular(20),
                                bottomLeft: isUser
                                    ? const Radius.circular(20)
                                    : const Radius.circular(4),
                                bottomRight: isUser
                                    ? const Radius.circular(4)
                                    : const Radius.circular(20),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.05),
                                  blurRadius: 5,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Text(
                              messageText,
                              style: GoogleFonts.outfit(
                                color: isUser ? Colors.white : Colors.black87,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                        if (isUser) ...[
                          const SizedBox(width: 8),
                          CircleAvatar(
                            radius: 16,
                            backgroundColor: Colors.blue.shade100,
                            child: const Icon(
                              Icons.person,
                              color: Colors.blue,
                              size: 16,
                            ),
                          ),
                        ],
                      ],
                    ),
                  );
                },
              ),
            ),

            _buildInputArea(),
          ],
        ),
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      color: Colors.white,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildShortcutChip('Check reminder', LucideIcons.bell),
                  const SizedBox(width: 8),
                  _buildShortcutChip(
                    'Translate a phrase',
                    LucideIcons.languages,
                  ),
                  const SizedBox(width: 8),
                  _buildShortcutChip('Write an email', LucideIcons.mail),
                ],
              ),
            ),
          ),
          AnimatedAIInputField(
            controller: _commandController,
            isListening: _isMicRecording,
            isSpeaking: _assistantState == 'SPEAKING',
            isVoiceSessionActive: _isConnected && !_isMuted,
            isEnabled: true,
            isMuted: _isMuted,
            onMicPressed: () => _sendAction('mute_volume'),
            onAttachPressed: _showAttachOptions,
            onSendPressed: () => _sendTextCommand(_commandController.text),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryControls(bool hasMoreMessages) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20, top: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (hasMoreMessages) ...[
            _smallActionButton(
              icon: LucideIcons.refreshCw,
              label: 'Load More',
              color: Colors.purple,
              onTap: () => setState(() => _messageLimit += 15),
            ),
            const SizedBox(width: 12),
          ],
          _smallActionButton(
            icon: LucideIcons.trash2,
            label: 'Clear History',
            color: Colors.redAccent,
            onTap: _showClearHistoryDialog,
          ),
        ],
      ),
    );
  }

  Widget _smallActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShortcutChip(String text, IconData icon) {
    return GestureDetector(
      onTap: () {
        _commandController.text = text;
        _commandController.selection = TextSelection.collapsed(
          offset: _commandController.text.length,
        );
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: const Color(0xFF64748B)),
            const SizedBox(width: 6),
            Text(
              text,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAttachOptions() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Attachments are not available in this chat mode yet.',
          style: GoogleFonts.outfit(),
        ),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showClearHistoryDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Clear History',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Are you sure you want to clear the visible chat history?',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        if (_wsChannel != null && _isConnected) {
                          try {
                            _wsChannel!.add(json.encode({'type': 'clear_history'}));
                          } catch (_) {}
                        } else {
                          _sendAction('clear_history');
                        }
                        setState(() {
                          _logs.clear();
                          _messageLimit = 15;
                        });
                        Navigator.pop(dialogContext);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.redAccent,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        'Clear',
                        style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

}
