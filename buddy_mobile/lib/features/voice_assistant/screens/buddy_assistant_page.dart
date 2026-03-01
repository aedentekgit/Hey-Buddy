import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'dart:io';
import 'dart:convert';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/voice_assistant/services/buddy_service.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:buddy_mobile/features/auth/screens/splash_screen.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/animated_ai_input_field.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/typewriter_text.dart';
import 'package:buddy_mobile/shared/widgets/keyboard_guided_hover.dart';

class BuddyAssistantPage extends StatefulWidget {
  final bool isIntegrated;
  final VoidCallback? onClose;
  final VoidCallback? onExplore;
  const BuddyAssistantPage({super.key, this.isIntegrated = false, this.onClose, this.onExplore});

  @override
  State<BuddyAssistantPage> createState() => _BuddyAssistantPageState();
}

class _BuddyAssistantPageState extends State<BuddyAssistantPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ImagePicker _picker = ImagePicker();
  final SpeechToText _speechToText = SpeechToText();
  final FlutterTts _flutterTts = FlutterTts();
  final AudioPlayer _audioPlayer = AudioPlayer();
  
  bool _isListening = false;
  String _selectedLanguage = "en-US";
  File? _selectedImage;
  int _messageLimit = 15;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<BuddyProvider>(context, listen: false);
      provider.fetchHistory().then((_) {
        // Scroll to the bottom immediately after history is fetched
        _scrollToBottom(false);
      });
      _initTts();

      // Enable Realtime Socket for Instant Updates (Streaming Response)
      provider.toggleRealtime(true);

      // Setup Realtime Audio Listener
      provider.socketService.audioStream.listen((base64Audio) async {
        if (base64Audio.isNotEmpty) {
          await _audioPlayer.play(BytesSource(base64Decode(base64Audio)));
        }
      });

      // Fetch Local News based on location
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final lat = userProvider.user['currentLocation']?['lat'];
      final lon = userProvider.user['currentLocation']?['lng'];
      provider.fetchLocalNews(lat, lon);
    });
  }

  Future<void> _initSpeech() async {
    try {
      final status = await Permission.microphone.request();
      if (status != PermissionStatus.granted) {
        if (kDebugMode) print('Microphone permission not granted');
        return;
      }

      bool available = await _speechToText.initialize(
        onStatus: (status) { if (kDebugMode) print('STT Status: $status'); },
        onError: (error) { if (kDebugMode) print('STT Error: $error'); },
      );
      if (kDebugMode) print('STT Available: $available');
    } catch (e) {
      if (kDebugMode) print('Error initializing speech: $e');
    }
  }

  Future<void> _initTts() async {
    try {
      await _flutterTts.setLanguage(_selectedLanguage);
      
      // Use pre-resolved voice configurations from backend payload
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final resolvedConfig = userProvider.user['resolvedVoiceConfig'] as Map<String, dynamic>? ?? {};
      
      double pitch = (resolvedConfig['pitch'] as num?)?.toDouble() ?? 1.0;
      double speechRate = (resolvedConfig['speechRate'] as num?)?.toDouble() ?? 0.5;

      await _flutterTts.setSpeechRate(speechRate);
      await _flutterTts.setVolume(1.0);
      await _flutterTts.setPitch(pitch);
    } catch (e) {
      if (kDebugMode) print('Error initializing TTS: $e');
    }
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    _speechToText.stop();
    _flutterTts.stop();
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

    // Send to API
    await provider.sendMessage(text, imagePath: imagePath, language: _selectedLanguage);
    
    _scrollToBottom();
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
                        content: Text('Speech recognition not available. Please check permissions in Settings.'),
                        backgroundColor: Colors.redAccent,
                    ),
                );
            }
            return;
        }
        
        setState(() => _isListening = true);
        await _speechToText.listen(
          onResult: (result) {
            if (kDebugMode) print('STT Result: "${result.recognizedWords}" (Final: ${result.finalResult})');
            setState(() {
                _inputController.text = result.recognizedWords;
            });
            if (result.finalResult) {
              if (kDebugMode) print('STT Final Result arrived. Sending message...');
              setState(() => _isListening = false);
              _handleSend();
            }
          },
          listenFor: const Duration(seconds: 30),
          pauseFor: const Duration(seconds: 10),
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
      backgroundColor: const Color(0xFFF9FAFF),
      body: SafeArea(
        child: KeyboardGuidedHover(
          child: Column(
            children: [
              Expanded(
                child: provider.messages.isEmpty 
                  ? _buildEmptyState(provider, branding) 
                  : _buildChatList(provider, branding),
              ),

              if (provider.isThinking) _buildThinkingIndicator(branding),
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
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        shape: BoxShape.circle,
                      ),
                      child: ClipOval(
                        child: Image.asset(
                          'assets/app_icon.png',
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            "Buddy in ${provider.localCity ?? 'Your Area'}",
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "Here's what's happening around you right now.",
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              color: const Color(0xFF64748B),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                InkWell(
                  onTap: provider.isFetchingNews ? null : () {
                    final userProvider = Provider.of<UserProvider>(context, listen: false);
                    final lat = userProvider.user['currentLocation']?['lat'];
                    final lon = userProvider.user['currentLocation']?['lng'];
                    provider.fetchLocalNews(lat, lon);
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          provider.isFetchingNews ? "Refreshing..." : "Refresh",
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: provider.isFetchingNews ? Colors.grey : const Color(0xFF1E293B),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (provider.isFetchingNews)
                          const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1E293B)),
                          )
                        else
                          const Icon(LucideIcons.rotateCcw, size: 16, color: Color(0xFF1E293B)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (provider.isFetchingNews)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 20),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (provider.localNews.isEmpty) ...[
                  _buildSuggestionItem("What is the format of T20 WC 2026? 📜"),
                  const SizedBox(height: 12),
                  _buildSuggestionItem("Budget 2026: Taxpayers' Relief 💰"),
                  const SizedBox(height: 12),
                  _buildSuggestionItem("Convert photo of paper doc to document"),
                ] else
                  ...provider.localNews.map((news) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _buildSuggestionItem(news),
                  )).toList(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuggestionItem(String text) {
    return Material(
      color: const Color(0xFFF1F7FF),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () {
          _inputController.text = text;
          _handleSend();
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Text(
          text,
          style: GoogleFonts.outfit(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: const Color(0xFF1E6AFF),
          ),
        ),
        ), // Container
      ), // InkWell
    ); // Material
  }

  Widget _buildPixelAnimation(BrandingProvider branding) {
    return Container(
      width: 180,
      height: 180,
      
      decoration: BoxDecoration(
        color: branding.primaryColor.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: CustomPaint(
        painter: PixelPainter(branding.primaryColor),
      ),
    );
  }

  Widget _buildChatList(BuddyProvider provider, BrandingProvider branding) {
    int totalMessages = provider.messages.length;
    int displayCount = totalMessages > _messageLimit ? _messageLimit : totalMessages;
    bool hasMore = totalMessages > _messageLimit;

    return ListView.builder(
      reverse: true, // Force list to start from the bottom edge
      controller: _scrollController,
      padding: const EdgeInsets.all(18),
      itemCount: displayCount + 1, // Always show the top row if messages exist
      itemBuilder: (context, index) {
        if (index == displayCount) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (hasMore) ...[
                  TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _messageLimit += 15;
                      });
                    },
                    icon: Icon(LucideIcons.refreshCw, size: 16, color: branding.primaryColor),
                    label: Text(
                      "Load More",
                      style: GoogleFonts.outfit(
                        color: branding.primaryColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: TextButton.styleFrom(
                      backgroundColor: branding.primaryColor.withOpacity(0.1),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                ],
                TextButton.icon(
                  onPressed: () => _showClearHistoryDialog(context, provider),
                  icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.redAccent),
                  label: Text(
                    "Clear Chat",
                    style: GoogleFonts.outfit(
                      color: Colors.redAccent,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.redAccent.withOpacity(0.1),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ],
            ),
          );
        }

        // Reverse index since the ListView is now building bottom-up
        final msg = provider.messages[totalMessages - 1 - index];
        final isUser = msg['type'] == 'user';

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (!isUser) ...[
                Text(
                  "BUDDY",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: branding.primaryColor,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 6),
              ],
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
                decoration: BoxDecoration(
                  color: isUser ? branding.primaryColor : Colors.white,
                  gradient: isUser 
                    ? LinearGradient(
                        colors: [branding.primaryColor, branding.primaryColor.withOpacity(0.8)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(12),
                    topRight: const Radius.circular(12),
                    bottomLeft: Radius.circular(isUser ? 12 : 4),
                    bottomRight: Radius.circular(isUser ? 4 : 12),
                  ),
                  boxShadow: [
                    if (!isUser)
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                  ],
                  border: !isUser ? Border.all(color: Colors.black.withOpacity(0.04)) : null,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (msg['image'] != null) ...[
                        ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.file(File(msg['image']), width: 260),
                        ),
                        const SizedBox(height: 8),
                    ],
                    if (isUser)
                      Text(
                        msg['text'],
                        style: GoogleFonts.outfit(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                          height: 1.6,
                        ),
                      )
                    else
                      TypewriterText(
                        msg['text'],
                        key: ValueKey(msg['id']),
                        enabled: msg['shouldType'] ?? true,
                        duration: const Duration(milliseconds: 8),
                        style: GoogleFonts.outfit(

                          color: const Color(0xFF1E293B),
                          fontSize: 15,
                          fontWeight: FontWeight.w400,
                          height: 1.6,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
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
              borderRadius: BorderRadius.circular(12),
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

  Widget _buildInputArea(BuddyProvider provider, BrandingProvider branding, AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
      color: const Color(0xFFF9FAFF),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_selectedImage != null) ...[
            Stack(
              children: [
                Container(
                  height: 100,
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    image: DecorationImage(image: FileImage(_selectedImage!), fit: BoxFit.cover),
                  ),
                ),
                Positioned(
                  right: 8, top: 8,
                  child: InkWell(
                    onTap: () => setState(() => _selectedImage = null),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                      child: const Icon(LucideIcons.x, size: 16),
                    ),
                  ),
                ),
              ],
            ),
          ],
          AnimatedAIInputField(
            controller: _inputController,
            isListening: _isListening,
            isEnabled: true,
            onMicPressed: _isListening ? _stopListening : _startListening,
            onAttachPressed: _pickImage,
            onSendPressed: _handleSend,
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAction(String title, IconData icon, VoidCallback onTap, BrandingProvider branding) {
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
                          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4)),
                      ],
                  ),
                  child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                          Icon(icon, size: 16, color: branding.primaryColor),
                          const SizedBox(width: 8),
                          Text(title, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w600, color: const Color(0xFF1E293B))),
                      ],
                  ),
              ),
          ),
      );
  }

  void _showAuthPrompt() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("Login Required", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text("To use advanced features like Reminders and Memory, please log in.", style: GoogleFonts.outfit()),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Later")),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Theme.of(context).primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text("Login"),
          ),
        ],
      ),
    );
  }

  void _showClearHistoryDialog(BuildContext context, BuddyProvider provider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text("Clear Chat History", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text("Are you sure you want to delete all chat history? This action cannot be undone.", style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: Text("Cancel", style: GoogleFonts.outfit(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await provider.deleteAllHistory();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text("Delete All", style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
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
            Paint()..color = primaryColor.withOpacity(opacity)
        );
    }
  }

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
