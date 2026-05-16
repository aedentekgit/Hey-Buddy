// ignore_for_file: deprecated_member_use, unused_element, unused_local_variable, use_build_context_synchronously
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:math' as math;
import 'dart:async';
import 'dart:io';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:buddy_mobile/features/auth/screens/splash_screen.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/animated_ai_input_field.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:buddy_mobile/shared/widgets/keyboard_guided_hover.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/shared/widgets/glass_container.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

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

class _BuddyAssistantPageState extends State<BuddyAssistantPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();
  final SpeechToText _speechToText = SpeechToText();

  bool _isListening = false;
  bool _voiceConversationActive = false;
  bool _waitingForBuddyResponse = false;
  bool _buddyResponseStarted = false;
  bool _isStartingListen = false;
  Timer? _resumeListeningTimer;
  Timer? _speechRestartTimer;
  BuddyProvider? _buddyProvider;
  final String _selectedLanguage = "en-GB";
  File? _selectedImage;
  int _messageLimit = 15;

  String? _lastKnownToken;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<BuddyProvider>(context, listen: false);
      _buddyProvider = provider;
      provider.addListener(_onBuddyProviderChanged);
      final auth = Provider.of<AuthProvider>(context, listen: false);

      provider.fetchHistory().then((_) {
        _scrollToBottom(false);
      });
      _initTts();

      // Load current logo into GPU cache immediately
      final branding = Provider.of<BrandingProvider>(context, listen: false);
      branding.precacheAllImages(context);

      // Enable Realtime Socket and track auth changes for reconnection
      _lastKnownToken = auth.token;
      provider.toggleRealtime(true);

      // Listen to auth changes — reconnect socket when user logs in or out
      // This is the fix for: APK socket connects as guest (null token at startup)
      // and never reconnects after login.
      auth.addListener(_onAuthChanged);

      final userProvider = Provider.of<UserProvider>(context, listen: false);

      double? lat = userProvider.user['currentLocation']?['lat'];
      double? lon = userProvider.user['currentLocation']?['lng'];

      if (lat == null || lon == null) {
        Geolocator.checkPermission().then((permission) {
          if (permission == LocationPermission.always ||
              permission == LocationPermission.whileInUse) {
            Geolocator.getCurrentPosition(
                  desiredAccuracy: LocationAccuracy.high,
                  timeLimit: const Duration(seconds: 15),
                )
                .then((pos) {
                  userProvider.setGuestLocation(pos.latitude, pos.longitude);
                })
                .catchError((e) {
                  // Silent fail on location
                });
          }
        });
      }
    });
  }

  void _onBuddyProviderChanged() {
    if (!mounted || !_voiceConversationActive || !_waitingForBuddyResponse) {
      return;
    }

    final provider = _buddyProvider;
    if (provider == null) return;

    // Wait until Buddy has actually started and fully finished its turn.
    if (provider.isThinking || provider.isSpeaking) {
      _buddyResponseStarted = true;
      _resumeListeningTimer?.cancel();
      _speechRestartTimer?.cancel();
      return;
    }

    if (_buddyResponseStarted && !_isListening) {
      _resumeListeningTimer?.cancel();
      _speechRestartTimer?.cancel();
      _resumeListeningTimer = Timer(const Duration(milliseconds: 900), () {
        if (!mounted || !_voiceConversationActive || _isListening) return;
        final latestProvider = _buddyProvider;
        if (latestProvider == null ||
            latestProvider.isThinking ||
            latestProvider.isSpeaking) {
          return;
        }
        _waitingForBuddyResponse = false;
        _buddyResponseStarted = false;
        _startListening(autoResume: true);
      });
    }
  }

  void _onAuthChanged() {
    if (!mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final currentToken = auth.token;

    // Only reconnect if the token actually changed (login or logout)
    if (currentToken != _lastKnownToken) {
      debugPrint(
        '[BuddyPage] Auth token changed (${_lastKnownToken == null ? 'was guest' : 'was logged in'} → ${currentToken == null ? 'now guest' : 'now logged in'}). Reconnecting socket...',
      );
      _lastKnownToken = currentToken;

      final provider = Provider.of<BuddyProvider>(context, listen: false);

      // Clear previous chat
      provider.clearSession();

      // Force a full socket reconnect so it picks up the new JWT
      provider.toggleRealtime(false);

      if (currentToken != null) {
        // Logged in: fetch history
        provider.fetchHistory();
      }

      Future.delayed(const Duration(milliseconds: 300), () {
        if (mounted) {
          provider.toggleRealtime(true);
        }
      });
    }
  }

  Future<void> _initSpeech() async {
    try {
      // Check status first to avoid forced OS prompt if already determined
      var status = await Permission.microphone.status;
      if (status.isDenied) {
        status = await Permission.microphone.request();
      }

      if (status != PermissionStatus.granted) {
        if (kDebugMode) debugPrint('Microphone permission not granted');
        return;
      }

      bool available = await _speechToText.initialize(
        onStatus: _handleSpeechStatus,
        onError: _handleSpeechError,
      );
      if (kDebugMode) debugPrint('STT Available: $available');
    } catch (e) {
      if (kDebugMode) debugPrint('Error initializing speech: $e');
    }
  }

  void _handleSpeechStatus(String status) {
    if (kDebugMode) debugPrint('STT Status: $status');
    if (!mounted) return;

    final normalized = status.toLowerCase();
    if (normalized == 'listening') {
      if (!_isListening) {
        setState(() => _isListening = true);
      }
      return;
    }

    if (normalized == 'notlistening' || normalized == 'done') {
      if (_isListening) {
        setState(() => _isListening = false);
      }

      // Android STT naturally ends after silence/no speech. In voice-chat mode,
      // bring it back unless Buddy is already processing/speaking.
      _scheduleSpeechRestart();
    }
  }

  void _handleSpeechError(dynamic error) {
    if (kDebugMode) debugPrint('STT Error: $error');
    if (!mounted) return;

    if (_isListening) {
      setState(() => _isListening = false);
    }

    // error_no_match is common when the user is silent. Treat it as a soft
    // end-of-listen, not a broken mic, while the voice session is active.
    _scheduleSpeechRestart(delay: const Duration(milliseconds: 700));
  }

  void _scheduleSpeechRestart({
    Duration delay = const Duration(milliseconds: 1200),
  }) {
    _speechRestartTimer?.cancel();

    if (!_voiceConversationActive ||
        _waitingForBuddyResponse ||
        _isListening ||
        _isStartingListen) {
      return;
    }

    final provider = _buddyProvider;
    if (provider != null && (provider.isThinking || provider.isSpeaking)) {
      return;
    }

    _speechRestartTimer = Timer(delay, () {
      if (!mounted ||
          !_voiceConversationActive ||
          _waitingForBuddyResponse ||
          _isListening ||
          _isStartingListen) {
        return;
      }

      final latestProvider = _buddyProvider;
      if (latestProvider != null &&
          (latestProvider.isThinking || latestProvider.isSpeaking)) {
        return;
      }

      _startListening(autoResume: true);
    });
  }

  Future<void> _initTts() async {
    try {
      final provider = Provider.of<BuddyProvider>(context, listen: false);
      final tts = provider.tts;

      await tts.setLanguage(_selectedLanguage);

      // Use pre-resolved voice configurations from backend payload
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final resolvedConfig =
          userProvider.user['resolvedVoiceConfig'] as Map<String, dynamic>? ??
          {};

      double pitch = (resolvedConfig['pitch'] as num?)?.toDouble() ?? 1.0;
      double speechRate =
          (resolvedConfig['speechRate'] as num?)?.toDouble() ?? 0.5;

      await tts.setSpeechRate(speechRate);
      await tts.setVolume(1.0);
      await tts.setPitch(pitch);

      // ── Sync Voice Response toggle from user preferences ──
      final voicePrefs =
          (userProvider.user['voicePreferences'] as Map<String, dynamic>?) ??
          {};
      final bool voiceEnabled = (voicePrefs['voiceEnabled'] as bool?) ?? true;
      provider.setVoiceEnabled(voiceEnabled);
    } catch (e) {
      if (kDebugMode) debugPrint('Error initializing TTS: $e');
    }
  }

  @override
  void dispose() {
    // Remove auth listener to prevent memory leaks
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      auth.removeListener(_onAuthChanged);
    } catch (_) {}
    _resumeListeningTimer?.cancel();
    _speechRestartTimer?.cancel();
    _buddyProvider?.removeListener(_onBuddyProviderChanged);
    _inputController.dispose();
    _scrollController.dispose();
    _speechToText.stop();
    // TTS/Audio disposal handled by Provider
    super.dispose();
  }

  void _scrollToBottom([bool animated = true]) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        if (animated) {
          _scrollController.animateTo(
            0.0, // With reverse: true, the bottom is offset 0
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        } else {
          _scrollController.jumpTo(0.0);
        }
      }
    });
  }

  Future<void> _handleSend() async {
    final text = _inputController.text.trim();
    if (text.isEmpty && _selectedImage == null) return;

    final provider = Provider.of<BuddyProvider>(context, listen: false);

    // Capture image path before clearing
    final imagePath = _selectedImage?.path;

    // Add user message locally
    provider.addMessage('user', text, image: imagePath);
    _inputController.clear();
    setState(() {
      _selectedImage = null;
    });
    _scrollToBottom();

    if (_voiceConversationActive) {
      _waitingForBuddyResponse = true;
      _buddyResponseStarted = false;
    }

    // Send to API
    await provider.sendMessage(
      text,
      imagePath: imagePath,
      language: _selectedLanguage,
    );

    // Restart wake word detection after manual response processed
    // DISABLED: if (!provider.isStreaming) {
    //   provider.startWakeWordDetection();
    // }

    _scrollToBottom();
  }

  void _showAttachOptions() {
    final branding = Provider.of<BrandingProvider>(context, listen: false);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => _AttachOptionsSheet(
        branding: branding,
        onPickGallery: () async {
          Navigator.pop(ctx);
          final XFile? image = await _picker.pickImage(
            source: ImageSource.gallery,
            imageQuality: 85,
          );
          if (image != null) {
            setState(() => _selectedImage = File(image.path));
          }
        },
        onPickCamera: () async {
          Navigator.pop(ctx);
          final XFile? image = await _picker.pickImage(
            source: ImageSource.camera,
            imageQuality: 85,
          );
          if (image != null) {
            setState(() => _selectedImage = File(image.path));
          }
        },
        onWhatsApp: () {
          Navigator.pop(ctx);
          _inputController.text = 'Share via WhatsApp: ';
        },
        onLink: () {
          Navigator.pop(ctx);
          _showLinkDialog();
        },
      ),
    );
  }

  void _showLinkDialog() {
    final linkController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Paste a Link',
          style: GoogleFonts.outfit(fontWeight: FontWeight.w800),
        ),
        content: TextField(
          controller: linkController,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'https://...',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              if (linkController.text.isNotEmpty) {
                _inputController.text = linkController.text;
              }
              Navigator.pop(ctx);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedImage = File(image.path);
      });
    }
  }

  void _startListening({bool autoResume = false}) async {
    if (_isStartingListen || _speechToText.isListening) return;

    _isStartingListen = true;
    try {
      if (!_speechToText.isAvailable) {
        await _initSpeech();
      }

      if (!_speechToText.isAvailable) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Speech recognition not available. Please check permissions in Settings.',
              ),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
        _isStartingListen = false;
        return;
      }

      final provider = Provider.of<BuddyProvider>(context, listen: false);
      if (!autoResume) {
        await provider
            .stopAllAudio(); // STOP AI IMMEDIATELY WHEN USER WANTS TO TALK
      }

      _resumeListeningTimer?.cancel();
      _speechRestartTimer?.cancel();
      setState(() {
        _voiceConversationActive = true;
        _isListening = true;
      });
      await _speechToText.listen(
        onResult: (result) {
          if (kDebugMode) {
            debugPrint(
              'STT Result: "${result.recognizedWords}" (Final: ${result.finalResult})',
            );
          }
          final recognizedWords = result.recognizedWords.trim();
          setState(() {
            _inputController.text = result.recognizedWords;
          });
          if (result.finalResult) {
            setState(() => _isListening = false);

            if (recognizedWords.isEmpty) {
              if (kDebugMode) {
                debugPrint('STT final result was empty. Restarting listener.');
              }
              _scheduleSpeechRestart();
              return;
            }

            if (kDebugMode) {
              debugPrint('STT Final Result arrived. Sending message...');
            }
            _handleSend();
          }
        },
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 2),
        listenMode: ListenMode.confirmation,
        cancelOnError: false,
        onSoundLevelChange: (level) {
          // Optional: Update animation based on level
        },
      );
      _isStartingListen = false;
    } catch (e) {
      if (kDebugMode) debugPrint('STT Exception during listen: $e');
      _isStartingListen = false;
      setState(() {
        _isListening = false;
        if (!autoResume) {
          _voiceConversationActive = false;
          _isStartingListen = false;
        }
      });
    }
  }

  void _stopListening() async {
    _resumeListeningTimer?.cancel();
    _speechRestartTimer?.cancel();
    _voiceConversationActive = false;
    _isStartingListen = false;
    _waitingForBuddyResponse = false;
    _buddyResponseStarted = false;
    await _speechToText.stop();
    setState(() => _isListening = false);
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<BuddyProvider>(context);
    final branding = Provider.of<BrandingProvider>(context);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final userProvider = Provider.of<UserProvider>(context);

    // Check for 401 Unauthorized and redirect
    if (provider.needsLogin) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        provider.clearNeedsLogin();
        // Force logout in AuthProvider too
        Provider.of<AuthProvider>(context, listen: false).logout();
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => SplashScreen()),
          (route) => false,
        );
      });
    }

    return Scaffold(
      backgroundColor:
          Colors.transparent, // Let main_screen handle the unified background
      body: SafeArea(
        left: false,
        right: false,
        bottom: false,
        child: KeyboardGuidedHover(
          child: Stack(
            children: [
              Column(
                children: [
                  Expanded(
                    child: Stack(
                      children: [
                        provider.isLoading && provider.messages.isEmpty
                            ? const Center(child: CircularProgressIndicator())
                            : provider.messages.isEmpty
                            ? _buildEmptyState(provider, branding)
                            : _buildChatList(provider, branding),
                      ],
                    ),
                  ),

                  // if (provider.isThinking) _buildThinkingIndicator(branding),
                  _buildInputArea(provider, branding, auth),
                ],
              ),
              if (!provider.isConnected) _buildOfflineState(provider, branding),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOfflineState(BuddyProvider provider, BrandingProvider branding) {
    return Positioned.fill(
      child: GlassContainer(
        borderRadius: 0,
        blur: 15,
        opacity: 0.8,
        color: const Color(0xFF0F172A), // Dark slate like React version
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Icon Container
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(0),
                    border: Border.all(
                      color: Colors.redAccent.withValues(alpha: 0.2),
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(
                    LucideIcons.wifiOff,
                    size: 40,
                    color: Colors.redAccent,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  "Buddy is Offline",
                  style: GoogleFonts.outfit(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  "Unable to connect to the AI service.\nPlease ensure the backend server is running and try again.",
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    color: Colors.white.withValues(alpha: 0.6),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                // Buttons
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton.icon(
                    onPressed: () => provider.retryConnection(),
                    icon: const Icon(LucideIcons.refreshCw, size: 20),
                    label: Text(
                      "Reconnect Buddy",
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: branding.primaryColor,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(0),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      if (widget.onExplore != null) {
                        widget.onExplore!();
                      } else {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (_) => const MainScreen()),
                        );
                      }
                    },
                    icon: const Icon(LucideIcons.home, size: 20),
                    label: Text(
                      "Back to Home",
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: BorderSide(
                        color: Colors.white.withValues(alpha: 0.2),
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(0),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuddyProvider provider, BrandingProvider branding) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.22),

          // The GIF (App logo)
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: const BoxDecoration(shape: BoxShape.circle),
              clipBehavior: Clip.antiAlias,
              child: branding.logoUrl != null && branding.logoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: branding.logoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Image.asset(
                        'assets/images/buddy_logo.gif',
                        fit: BoxFit.cover,
                      ),
                      errorWidget: (context, url, error) => Image.asset(
                        'assets/images/buddy_logo.gif',
                        fit: BoxFit.cover,
                      ),
                    )
                  : Image.asset(
                      'assets/images/buddy_logo.gif',
                      fit: BoxFit.cover,
                    ),
            ),
          ),

          const SizedBox(height: 40),

          // Center-aligned invitation to speak
          Opacity(
            opacity: 0.5,
            child: Column(
              children: [
                const Icon(LucideIcons.mic, size: 40, color: Colors.white),
                const SizedBox(height: 16),
                Text(
                  "Tap the microphone or type to start chatting",
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 100), // Space for input
        ],
      ),
    );
  }

  Widget _buildPixelAnimation(BrandingProvider branding) {
    return Container(
      width: 180,
      height: 180,

      decoration: BoxDecoration(
        color: branding.primaryColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: CustomPaint(painter: PixelPainter(branding.primaryColor)),
    );
  }

  Widget _buildChatList(BuddyProvider provider, BrandingProvider branding) {
    int totalMessages = provider.messages.length;
    int displayCount = totalMessages > _messageLimit
        ? _messageLimit
        : totalMessages;
    bool hasMore = totalMessages > _messageLimit;
    bool showThinking = provider.isThinking;

    int itemCount = displayCount + 1 + (showThinking ? 1 : 0);

    return ListView.builder(
      reverse: true,
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      itemCount: itemCount,
      itemBuilder: (context, index) {
        if (showThinking && index == 0) {
          return _buildThinkingBubble(branding);
        }

        int msgIndex = showThinking ? index - 1 : index;

        if (msgIndex == displayCount) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 24.0, top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (hasMore) ...[
                  _smallActionButton(
                    icon: LucideIcons.refreshCw,
                    label: "Load More",
                    color: branding.primaryColor,
                    onTap: () => setState(() => _messageLimit += 15),
                  ),
                  const SizedBox(width: 12),
                ],
                _smallActionButton(
                  icon: LucideIcons.trash2,
                  label: "Clear History",
                  color: Colors.redAccent,
                  onTap: () => _showClearHistoryDialog(context, provider),
                ),
              ],
            ),
          );
        }

        final msg = provider.messages[totalMessages - 1 - msgIndex];
        return _buildMessageItem(msg, branding);
      },
    );
  }

  Widget _buildMessageItem(
    Map<String, dynamic> msg,
    BrandingProvider branding,
  ) {
    final isUser = msg['type'] == 'user';
    final userProvider = Provider.of<UserProvider>(context, listen: false);

    final ts = DateFormatter.formatTime(
      DateTime.fromMillisecondsSinceEpoch(
        msg['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
      ),
      format: userProvider.user['timeFormat'] ?? '12',
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Assistant Avatar on the Left
          if (!isUser) ...[
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(shape: BoxShape.circle),
              clipBehavior: Clip.antiAlias,
              child: branding.logoUrl != null && branding.logoUrl!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: branding.logoUrl!,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Image.asset(
                        'assets/images/buddy_logo.gif',
                        fit: BoxFit.cover,
                      ),
                      errorWidget: (context, url, error) => Image.asset(
                        'assets/images/buddy_logo.gif',
                        fit: BoxFit.cover,
                      ),
                    )
                  : Image.asset(
                      'assets/images/buddy_logo.gif',
                      fit: BoxFit.cover,
                    ),
            ),
            const SizedBox(width: 10),
          ],

          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.74,
            ),
            child: Column(
              crossAxisAlignment: isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onLongPress: () {
                    final textToCopy = msg['text']?.toString() ?? '';
                    if (textToCopy.isNotEmpty) {
                      Clipboard.setData(ClipboardData(text: textToCopy));
                      HapticFeedback.lightImpact();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            "Copied to clipboard",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          backgroundColor: const Color(0xFF1E293B),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      );
                    }
                  },
                  child: Container(
                    padding: msg['image'] != null
                        ? EdgeInsets.zero
                        : const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                    decoration: BoxDecoration(
                      gradient: isUser
                          ? LinearGradient(
                              colors: [
                                branding.primaryColor,
                                branding.primaryColor.withValues(alpha: 0.8),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : null,
                      color: isUser ? null : const Color(0xFFF8FAFC),
                      borderRadius: msg['image'] != null
                          ? BorderRadius.circular(16)
                          : BorderRadius.only(
                              topLeft: const Radius.circular(18),
                              topRight: const Radius.circular(18),
                              bottomLeft: Radius.circular(isUser ? 18 : 0),
                              bottomRight: Radius.circular(isUser ? 0 : 18),
                            ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: IntrinsicWidth(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (msg['image'] != null) ...[
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child:
                                  (msg['image'].toString().startsWith('http') ||
                                      msg['image'].toString().startsWith(
                                        'https',
                                      ))
                                  ? CachedNetworkImage(
                                      imageUrl: msg['image'],
                                      width: 240,
                                      fit: BoxFit.cover,
                                      placeholder: (context, url) => Container(
                                        height: 180,
                                        color: Colors.grey[200],
                                        child: const Center(
                                          child: CircularProgressIndicator(),
                                        ),
                                      ),
                                      errorWidget: (context, url, error) =>
                                          Image.file(
                                            File(msg['image']),
                                            width: 240,
                                            fit: BoxFit.cover,
                                          ),
                                    )
                                  : Image.file(
                                      File(msg['image']),
                                      width: 240,
                                      fit: BoxFit.cover,
                                    ),
                            ),
                            if (msg['text'] != null &&
                                msg['text'].toString().isNotEmpty)
                              const SizedBox(height: 12),
                          ],

                          if (msg['text'] != null &&
                              msg['text'].toString().isNotEmpty)
                            Padding(
                              padding: msg['image'] != null
                                  ? const EdgeInsets.only(
                                      left: 14,
                                      right: 14,
                                      bottom: 14,
                                    )
                                  : EdgeInsets.zero,
                              child: MarkdownBody(
                                data: msg['text'],
                                styleSheet: MarkdownStyleSheet(
                                  p: GoogleFonts.inter(
                                    color: isUser
                                        ? Colors.white
                                        : const Color(0xFF1E293B),
                                    fontSize: 15,
                                    fontWeight: FontWeight.normal,
                                    height: 1.5,
                                  ),
                                  code: GoogleFonts.firaCode(
                                    backgroundColor: isUser
                                        ? Colors.white24
                                        : Colors.grey[200],
                                    color: isUser
                                        ? Colors.white
                                        : Colors.black87,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            )
                          else if (!isUser && msg['isPartial'] == true)
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildDot(0, branding),
                                const SizedBox(width: 5),
                                _buildDot(1, branding),
                                const SizedBox(width: 5),
                                _buildDot(2, branding),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 4),
                Padding(
                  padding: EdgeInsets.only(
                    left: isUser ? 0 : 4,
                    right: isUser ? 4 : 0,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Copy icon on the left of timestamp for User bubble
                      if (isUser) ...[
                        GestureDetector(
                          onTap: () {
                            final textToCopy = msg['text']?.toString() ?? '';
                            Clipboard.setData(ClipboardData(text: textToCopy));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("Content copied to clipboard"),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.all(20),
                              ),
                            );
                          },
                          child: const Icon(
                            LucideIcons.copy,
                            size: 10,
                            color: Colors.black26,
                          ),
                        ),
                        const SizedBox(width: 5),
                      ],
                      Text(
                        ts,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          color: Colors.black45,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      // Copy icon on the right of timestamp for Assistant bubble
                      if (!isUser) ...[
                        const SizedBox(width: 5),
                        GestureDetector(
                          onTap: () {
                            final textToCopy = msg['text']?.toString() ?? '';
                            Clipboard.setData(ClipboardData(text: textToCopy));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("Assistant response copied"),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.all(20),
                              ),
                            );
                          },
                          child: const Icon(
                            LucideIcons.copy,
                            size: 10,
                            color: Colors.black26,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),

          // User Avatar on the Right
          if (isUser) ...[const SizedBox(width: 8), _buildUserAvatar()],
        ],
      ),
    );
  }

  Widget _buildThinkingBubble(BrandingProvider branding) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _buildAssistantAvatar(branding),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(0),
                bottomRight: Radius.circular(18),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildDot(0, branding),
                const SizedBox(width: 5),
                _buildDot(1, branding),
                const SizedBox(width: 5),
                _buildDot(2, branding),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _smallActionButton({
    required IconData icon,
    required String label,
    required Color color,
    VoidCallback? onTap,
  }) {
    return Material(
      color: color.withValues(alpha: 0.05),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: color.withValues(alpha: 0.1)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAssistantAvatar(BrandingProvider branding) {
    return Container(
      width: 34,
      height: 34,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      child: ClipOval(
        child: branding.logoUrl != null && branding.logoUrl!.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: branding.logoUrl!,
                fit: BoxFit.cover,
                placeholder: (context, url) =>
                    Image.asset('assets/app_icon.png', fit: BoxFit.cover),
                errorWidget: (context, url, error) =>
                    Image.asset('assets/app_icon.png', fit: BoxFit.cover),
              )
            : Image.asset('assets/app_icon.png', fit: BoxFit.cover),
      ),
    );
  }

  Widget _buildUserAvatar() {
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    final user = userProvider.user;
    final String? avatarUrl = user['profilePicture'] as String?;
    final String name = user['name'] ?? 'User';

    return Container(
      width: 34,
      height: 34,
      decoration: const BoxDecoration(shape: BoxShape.circle),
      child: ClipOval(
        child: avatarUrl != null && avatarUrl.isNotEmpty
            ? CachedNetworkImage(
                imageUrl: AppConfig.formatImageUrl(avatarUrl) ?? avatarUrl,
                fit: BoxFit.cover,
                placeholder: (context, url) => _buildUserFallback(name),
                errorWidget: (context, url, error) => _buildUserFallback(name),
              )
            : _buildUserFallback(name),
      ),
    );
  }

  Widget _buildUserFallback(String name) {
    final initials = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [Color(0xFF64748B), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          initials,
          style: GoogleFonts.outfit(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildThinkingIndicator(BrandingProvider branding) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "Buddy is thinking",
                  style: GoogleFonts.outfit(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textMid,
                  ),
                ),
                const SizedBox(width: 8),
                _buildDot(0, branding),
                const SizedBox(width: 4),
                _buildDot(1, branding),
                const SizedBox(width: 4),
                _buildDot(2, branding),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDot(int index, BrandingProvider branding) {
    return TweenAnimationBuilder(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: const Duration(seconds: 1),
      builder: (context, double value, child) {
        return Opacity(
          opacity: (math.sin((value * 6.28) + (index * 1.5)) + 1) / 2,
          child: Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: branding.primaryColor,
              shape: BoxShape.circle,
            ),
          ),
        );
      },
    );
  }

  Widget _buildInputArea(
    BuddyProvider provider,
    BrandingProvider branding,
    AuthProvider auth,
  ) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      color: Colors.transparent,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 16.0),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              child: Row(
                children: [
                  _buildShortcutChip(
                    "Check reminder",
                    LucideIcons.bell,
                    provider,
                  ),
                  const SizedBox(width: 8),
                  _buildShortcutChip(
                    "Translate a phrase",
                    LucideIcons.languages,
                    provider,
                  ),
                  const SizedBox(width: 8),
                  _buildShortcutChip(
                    "Write an email",
                    LucideIcons.mail,
                    provider,
                  ),
                ],
              ),
            ),
          ),
          if (_selectedImage != null) ...[
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  height: 120,
                  width: 120,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                    image: DecorationImage(
                      image: FileImage(_selectedImage!),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                Positioned(
                  right: -8,
                  top: -8,
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedImage = null),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: const Icon(
                        LucideIcons.x,
                        size: 14,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
          AnimatedAIInputField(
            controller: _inputController,
            isListening:
                _voiceConversationActive ||
                _isListening ||
                provider.isListening,
            isSpeaking: provider.isSpeaking,
            isVoiceSessionActive: _voiceConversationActive,
            isEnabled: true,
            onMicPressed: _voiceConversationActive
                ? _stopListening
                : _startListening,
            onAttachPressed: _showAttachOptions,
            onSendPressed: _handleSend,
          ),
        ],
      ),
    );
  }

  Widget _buildShortcutChip(
    String text,
    IconData icon,
    BuddyProvider provider,
  ) {
    return GestureDetector(
      onTap: () {
        _inputController.text = text;
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
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
            Icon(icon, size: 14, color: AppColors.textMid),
            const SizedBox(width: 6),
            Text(
              text,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickAction(
    String title,
    IconData icon,
    VoidCallback onTap,
    BrandingProvider branding,
  ) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: branding.primaryColor),
              const SizedBox(width: 8),
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAuthPrompt({String reason = 'use this feature'}) {
    final branding = Provider.of<BrandingProvider>(context, listen: false);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 20, 28, 36),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Handle bar
                Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 24),
                // Icon
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        branding.primaryColor,
                        branding.primaryColor.withValues(alpha: 0.7),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    LucideIcons.logIn,
                    color: Colors.white,
                    size: 30,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Sign in to $reason',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'This action requires a Buddy account. Sign in or create a free account to $reason, get smart reminders, and unlock the full Buddy experience.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.outfit(
                    fontSize: 14,
                    color: const Color(0xFF64748B),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 28),
                // Login button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                    },
                    icon: const Icon(LucideIcons.logIn, size: 18),
                    label: Text(
                      'Sign In to Continue',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: branding.primaryColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // Later button
                SizedBox(
                  width: double.infinity,
                  child: TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text(
                      'Maybe Later',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showClearHistoryDialog(BuildContext context, BuddyProvider provider) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Clear History",
                style: GoogleFonts.nunito(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                "Are you sure you want to delete all chat history? This cannot be undone.",
                style: GoogleFonts.inter(
                  fontSize: 13.5,
                  color: AppColors.textMid,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          'Cancel',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMid,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () async {
                        Navigator.pop(context);
                        await provider.deleteAllHistory();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.dangerLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          'Delete All',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.danger,
                          ),
                        ),
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

class PixelPainter extends CustomPainter {
  final Color primaryColor;
  PixelPainter(this.primaryColor);

  @override
  void paint(Canvas canvas, Size size) {
    // Draw some random pixels
    final math.Random random = math.Random(42);
    const int count = 600;

    for (int i = 0; i < count; i++) {
      final double x = random.nextDouble() * size.width;
      final double y = random.nextDouble() * size.height;
      final double pixelSize = 1.0 + random.nextDouble() * 2.0;
      final double opacity = 0.1 + random.nextDouble() * 0.4;

      canvas.drawRect(
        Rect.fromLTWH(x, y, pixelSize, pixelSize),
        Paint()..color = primaryColor.withValues(alpha: opacity),
      );
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}

/// Professional attach options bottom sheet with multiple media/link options
class _AttachOptionsSheet extends StatelessWidget {
  final BrandingProvider branding;
  final VoidCallback onPickGallery;
  final VoidCallback onPickCamera;
  final VoidCallback onWhatsApp;
  final VoidCallback onLink;

  const _AttachOptionsSheet({
    required this.branding,
    required this.onPickGallery,
    required this.onPickCamera,
    required this.onWhatsApp,
    required this.onLink,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(top: 8, bottom: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),

              // Title
              Text(
                'Share Something',
                style: GoogleFonts.outfit(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Choose how to share with Buddy',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: const Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 24),

              // Options Grid
              Row(
                children: [
                  _AttachOption(
                    icon: LucideIcons.image,
                    label: 'Photos',
                    color: const Color(0xFF6366F1),
                    bgColor: const Color(0xFFEEF2FF),
                    onTap: onPickGallery,
                  ),
                  const SizedBox(width: 12),
                  _AttachOption(
                    icon: LucideIcons.camera,
                    label: 'Camera',
                    color: const Color(0xFF0EA5E9),
                    bgColor: const Color(0xFFE0F2FE),
                    onTap: onPickCamera,
                  ),
                  const SizedBox(width: 12),
                  _AttachOption(
                    // Using messageCircle as WhatsApp icon substitute
                    icon: LucideIcons.messageCircle,
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    bgColor: const Color(0xFFDCFCE7),
                    onTap: onWhatsApp,
                  ),
                  const SizedBox(width: 12),
                  _AttachOption(
                    icon: LucideIcons.link,
                    label: 'Link',
                    color: const Color(0xFFF59E0B),
                    bgColor: const Color(0xFFFEF3C7),
                    onTap: onLink,
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Cancel button
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: const Color(0xFFE2E8F0)),
                    ),
                  ),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AttachOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color bgColor;
  final VoidCallback onTap;

  const _AttachOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.bgColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: color.withValues(alpha: 0.15),
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: color,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
