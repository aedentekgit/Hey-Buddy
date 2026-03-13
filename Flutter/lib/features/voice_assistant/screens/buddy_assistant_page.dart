import 'package:flutter/material.dart';
import 'dart:ui';
import 'dart:math' as math;
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
import 'package:intl/intl.dart';
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
      final auth = Provider.of<AuthProvider>(context, listen: false);

      provider.fetchHistory().then((_) {
        _scrollToBottom(false);
      });
      _initTts();

      // Enable Realtime Socket and track auth changes for reconnection
      _lastKnownToken = auth.token;
      provider.toggleRealtime(true);

      // Listen to auth changes — reconnect socket when user logs in or out
      // This is the fix for: APK socket connects as guest (null token at startup)
      // and never reconnects after login.
      auth.addListener(_onAuthChanged);

      // Fetch Local News based on location gracefully
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
                  provider.fetchLocalNews(pos.latitude, pos.longitude);
                })
                .catchError((e) {
                  provider.fetchLocalNews(null, null);
                });
          } else {
            provider.fetchLocalNews(null, null);
          }
        });
      } else {
        provider.fetchLocalNews(lat, lon);
      }
    });
  }

  void _onAuthChanged() {
    if (!mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final currentToken = auth.token;

    // Only reconnect if the token actually changed (login or logout)
    if (currentToken != _lastKnownToken) {
      print(
        '[BuddyPage] Auth token changed (${_lastKnownToken == null ? 'was guest' : 'was logged in'} → ${currentToken == null ? 'now guest' : 'now logged in'}). Reconnecting socket...',
      );
      _lastKnownToken = currentToken;

      final provider = Provider.of<BuddyProvider>(context, listen: false);
      // Force a full socket reconnect so it picks up the new JWT
      provider.toggleRealtime(false);
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
        if (kDebugMode) print('Microphone permission not granted');
        return;
      }

      bool available = await _speechToText.initialize(
        onStatus: (status) {
          if (kDebugMode) print('STT Status: $status');
        },
        onError: (error) {
          if (kDebugMode) print('STT Error: $error');
        },
      );
      if (kDebugMode) print('STT Available: $available');
    } catch (e) {
      if (kDebugMode) print('Error initializing speech: $e');
    }
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
    } catch (e) {
      if (kDebugMode) print('Error initializing TTS: $e');
    }
  }

  @override
  void dispose() {
    // Remove auth listener to prevent memory leaks
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      auth.removeListener(_onAuthChanged);
    } catch (_) {}
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

    // LOGIN GUARD: If the user is a guest and their message sounds like a save/reminder/memory action,
    // intercept and show the login prompt instead of sending.
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) {
      final lower = text.toLowerCase();
      final actionKeywords = [
        'remind',
        'reminder',
        'remember',
        'memo',
        'memory',
        'save',
        'note',
        'schedule',
        'alarm',
        'alert',
        'set a',
        'add a',
        'create a',
        'store',
        'don\'t forget',
        'dont forget',
        'keep track',
        'task',
        'todo',
        'to-do',
        'plan',
        'appointment',
        'meeting',
        'event',
        'at ',
        'pm',
        'am',
      ];
      final isActionRequest = actionKeywords.any((kw) => lower.contains(kw));
      if (isActionRequest) {
        _showAuthPrompt(reason: _detectActionReason(lower));
        return;
      }
    }

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

    // Send to API
    await provider.sendMessage(
      text,
      imagePath: imagePath,
      language: _selectedLanguage,
    );

    // Restart wake word detection after manual response processed
    if (!provider.isStreaming) {
      provider.startWakeWordDetection();
    }

    _scrollToBottom();
  }

  /// Returns a human-friendly reason string for the auth prompt.
  String _detectActionReason(String lower) {
    if (lower.contains('remind') || lower.contains('reminder'))
      return 'set a Reminder';
    if (lower.contains('memory') ||
        lower.contains('memo') ||
        lower.contains('remember'))
      return 'save a Memory';
    if (lower.contains('note')) return 'save a Note';
    if (lower.contains('alarm')) return 'set an Alarm';
    if (lower.contains('schedule') ||
        lower.contains('appointment') ||
        lower.contains('meeting'))
      return 'schedule an Event';
    if (lower.contains('task') ||
        lower.contains('todo') ||
        lower.contains('to-do'))
      return 'create a Task';
    return 'save this';
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedImage = File(image.path);
      });
    }
  }

  void _startListening() async {
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
        return;
      }

      final provider = Provider.of<BuddyProvider>(context, listen: false);
      await provider
          .stopAllAudio(); // STOP AI IMMEDIATELY WHEN USER WANTS TO TALK

      // Stop background wake word streaming to free up mic for local STT
      await provider.stopWakeWordDetection();

      setState(() => _isListening = true);
      await _speechToText.listen(
        onResult: (result) {
          if (kDebugMode)
            print(
              'STT Result: "${result.recognizedWords}" (Final: ${result.finalResult})',
            );
          setState(() {
            _inputController.text = result.recognizedWords;
          });
          if (result.finalResult) {
            if (kDebugMode)
              print('STT Final Result arrived. Sending message...');
            setState(() => _isListening = false);
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
    } catch (e) {
      if (kDebugMode) print('STT Exception during listen: $e');
      setState(() => _isListening = false);
    }
  }

  void _stopListening() async {
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
      provider.clearNeedsLogin();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // Force logout in AuthProvider too
        Provider.of<AuthProvider>(context, listen: false).logout();
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => SplashScreen()),
          (route) => false,
        );
      });
    }

    return Scaffold(
      backgroundColor: const Color(0xFFEEF0FB), // JSX lavender bg
      body: SafeArea(
        left: false,
        right: false,
        child: KeyboardGuidedHover(
          child: Column(
            children: [
              Expanded(
                child: Stack(
                  children: [
                    provider.messages.isEmpty
                        ? _buildEmptyState(provider, branding)
                        : _buildChatList(provider, branding),
                  ],
                ),
              ),

              // if (provider.isThinking) _buildThinkingIndicator(branding),
              _buildInputArea(provider, branding, auth),
            ],
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
          const SizedBox(height: 20),
          // ── Buddy Hero Section ────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [branding.primaryColor, const Color(0xFF7C3AED)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: branding.primaryColor.withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withOpacity(0.4),
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.1),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: ClipOval(
                    child: Image.asset(
                      'assets/app_icon.png',
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Buddy in ${provider.localCity ?? 'Your Area'}",
                        style: GoogleFonts.outfit(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "I'm keeping an eye on your surroundings. Here's the latest:",
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: Colors.white.withOpacity(0.9),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // ── Local Intelligence ──────────────────────────
          Row(
            children: [
              Container(
                width: 4,
                height: 20,
                decoration: BoxDecoration(
                  color: branding.primaryColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                "LOCAL INTELLIGENCE",
                style: GoogleFonts.outfit(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: const Color(0xFF64748B),
                ),
              ),
              const Spacer(),
              _smallActionButton(
                icon: provider.isFetchingNews
                    ? LucideIcons.refreshCw
                    : LucideIcons.rotateCcw,
                label: provider.isFetchingNews ? "Loading..." : "Refresh",
                color: branding.primaryColor,
                onTap: provider.isFetchingNews
                    ? null
                    : () {
                        final userProvider = Provider.of<UserProvider>(
                          context,
                          listen: false,
                        );
                        final lat =
                            userProvider.user['currentLocation']?['lat'];
                        final lon =
                            userProvider.user['currentLocation']?['lng'];
                        provider.fetchLocalNews(lat, lon);
                      },
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (provider.isFetchingNews)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Column(
                  children: [
                    CircularProgressIndicator(
                      strokeWidth: 3,
                      color: branding.primaryColor,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      "Analyzing surroundings...",
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: AppColors.textMid,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else if (provider.localNews.isEmpty) ...[
            _buildSuggestionItem(
              "What is the format of T20 WC 2026? 📜",
              branding,
              LucideIcons.helpCircle,
            ),
            const SizedBox(height: 14),
            _buildSuggestionItem(
              "Budget 2026: Taxpayers' Relief 💰",
              branding,
              LucideIcons.wallet,
            ),
            const SizedBox(height: 14),
            _buildSuggestionItem(
              "Convert photo of paper doc to document",
              branding,
              LucideIcons.fileText,
            ),
          ] else
            ...provider.localNews.map((news) {
              IconData icon = LucideIcons.info;
              if (news.toLowerCase().contains('weather'))
                icon = LucideIcons.cloudSun;
              if (news.toLowerCase().contains('event') ||
                  news.toLowerCase().contains('fest'))
                icon = LucideIcons.partyPopper;
              if (news.toLowerCase().contains('traffic') ||
                  news.toLowerCase().contains('infra'))
                icon = LucideIcons.car;
              if (news.toLowerCase().contains('alert'))
                icon = LucideIcons.alertTriangle;

              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _buildSuggestionItem(news, branding, icon),
              );
            }),
          const SizedBox(height: 100), // Space for input
        ],
      ),
    );
  }

  Widget _buildSuggestionItem(
    String text,
    BrandingProvider branding, [
    IconData? icon,
  ]) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            _inputController.text = text;
            _handleSend();
          },
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
            child: Row(
              children: [
                if (icon != null) ...[
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: branding.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon, color: branding.primaryColor, size: 20),
                  ),
                  const SizedBox(width: 16),
                ],
                Expanded(
                  child: Text(
                    text,
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF1E293B),
                      height: 1.3,
                    ),
                  ),
                ),
                Icon(
                  LucideIcons.chevronRight,
                  size: 16,
                  color: Colors.grey[300],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPixelAnimation(BrandingProvider branding) {
    return Container(
      width: 180,
      height: 180,

      decoration: BoxDecoration(
        color: branding.primaryColor.withOpacity(0.05),
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
    final userProvider = Provider.of<UserProvider>(
      context,
      listen: false,
    ); // already defined in build, but _buildMessageItem is a separate method
    final ts = DateFormatter.formatTime(
      DateTime.fromMillisecondsSinceEpoch(
        msg['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
      ),
      format: userProvider.user['timeFormat'] ?? '12',
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Row(
        mainAxisAlignment: isUser
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isUser) ...[
            _buildAssistantAvatar(branding),
            const SizedBox(width: 10),
          ],
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.76,
            ),
            child: Column(
              crossAxisAlignment: isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    gradient: isUser
                        ? LinearGradient(
                            colors: [
                              branding.primaryColor,
                              const Color(0xFF7C3AED),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          )
                        : null,
                    color: isUser ? null : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(22),
                      topRight: const Radius.circular(22),
                      bottomLeft: Radius.circular(isUser ? 22 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 22),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isUser
                            ? branding.primaryColor.withOpacity(0.18)
                            : Colors.black.withOpacity(0.04),
                        blurRadius: 15,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (msg['image'] != null) ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: CachedNetworkImage(
                            imageUrl:
                                msg['image'], // Using CachedNetworkImage if it's a URL
                            width: 240,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Container(
                              height: 180,
                              color: Colors.grey[100],
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            ),
                            errorWidget: (context, url, error) => Image.file(
                              File(msg['image']),
                              width: 240,
                              fit: BoxFit.cover,
                            ), // Fallback to file if it was a file path
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                      if (isUser)
                        Text(
                          msg['text'],
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            height: 1.5,
                          ),
                        )
                      else
                        MarkdownBody(
                          data: msg['text'],
                          styleSheet: MarkdownStyleSheet(
                            p: GoogleFonts.inter(
                              color: const Color(0xFF1E293B),
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              height: 1.5,
                            ),
                            strong: GoogleFonts.inter(
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF0F172A),
                            ),
                            listBullet: GoogleFonts.inter(
                              color: const Color(0xFF1E293B),
                            ),
                            code: GoogleFonts.firaCode(
                              fontSize: 13,
                              backgroundColor: const Color(0xFFF1F5F9),
                              color: branding.primaryColor,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6, left: 4, right: 4),
                  child: Text(
                    ts,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isUser) ...[const SizedBox(width: 10), _buildUserAvatar()],
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
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(22),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(22),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
              border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withOpacity(0.1)),
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
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
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
                imageUrl: avatarUrl,
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
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.black.withOpacity(0.04)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
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
                    color: const Color(0xFF64748B),
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
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      color: Colors.transparent,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
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
                        color: Colors.black.withOpacity(0.1),
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
                            color: Colors.black.withOpacity(0.1),
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
            isListening: _isListening || provider.isListening,
            isSpeaking: provider.isSpeaking,
            isEnabled: true,
            onMicPressed: _isListening ? _stopListening : _startListening,
            onAttachPressed: _pickImage,
            onSendPressed: _handleSend,
          ),
        ],
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
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
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
                  color: const Color(0xFF1E293B),
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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => Padding(
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
                    branding.primaryColor.withOpacity(0.7),
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
    );
  }

  void _showClearHistoryDialog(BuildContext context, BuddyProvider provider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          "Clear Chat History",
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold,
            color: const Color(0xFF1E293B),
          ),
        ),
        content: Text(
          "Are you sure you want to delete all chat history? This action cannot be undone.",
          style: GoogleFonts.outfit(color: const Color(0xFF64748B)),
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(
                    "Cancel",
                    style: GoogleFonts.outfit(
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    Navigator.pop(context);
                    await provider.deleteAllHistory();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: Text(
                    "Delete All",
                    style: GoogleFonts.outfit(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
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
        Paint()..color = primaryColor.withOpacity(opacity),
      );
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
