import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'dart:io';
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
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

class BuddyAssistantPage extends StatefulWidget {
  const BuddyAssistantPage({super.key});

  @override
  State<BuddyAssistantPage> createState() => _BuddyAssistantPageState();
}

class _BuddyAssistantPageState extends State<BuddyAssistantPage> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final ImagePicker _picker = ImagePicker();
  final SpeechToText _speechToText = SpeechToText();
  final FlutterTts _flutterTts = FlutterTts();
  
  bool _isListening = false;
  String _selectedLanguage = "en-US";
  File? _selectedImage;

  @override
  void initState() {
    super.initState();
    _initSpeech();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BuddyProvider>(context, listen: false).fetchHistory();
      _initTts();
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

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _handleSend() async {
    final text = _inputController.text.trim();
    if (text.isEmpty && _selectedImage == null) return;

    final provider = Provider.of<BuddyProvider>(context, listen: false);
    
    // Add user message locally
    provider.addMessage('user', text, image: _selectedImage?.path);
    _inputController.clear();
    setState(() {
      _selectedImage = null;
    });
    _scrollToBottom();

    // Send to API
    final imagePath = _selectedImage?.path;
    await provider.sendMessage(text, imagePath: imagePath, language: _selectedLanguage);
    
    // Speak response
    if (provider.messages.isNotEmpty && provider.messages.last['type'] == 'ai') {
      final lastMsg = provider.messages.last['text'];
      if (lastMsg != null && lastMsg.isNotEmpty) {
          await _flutterTts.speak(lastMsg);
      }
    }
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
    if (!_speechToText.isAvailable) {
        await _initSpeech();
    }
    
    if (!_speechToText.isAvailable) {
        if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Speech recognition not available. Please check microphone permissions.')),
            );
        }
        return;
    }
    
    setState(() => _isListening = true);
    await _speechToText.listen(
      onResult: (result) {
        setState(() {
            _inputController.text = result.recognizedWords;
        });
        if (result.finalResult) {
          setState(() => _isListening = false);
          _handleSend();
        }
      },
    );
  }

  void _stopListening() async {
    await _speechToText.stop();
    setState(() => _isListening = false);
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<BuddyProvider>(context);
    final branding = Provider.of<BrandingProvider>(context);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.white,
      drawer: _buildHistoryDrawer(provider, branding),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(provider, branding),
            Expanded(
              child: provider.messages.isEmpty 
                ? _buildEmptyState(branding) 
                : _buildChatList(provider, branding),
            ),
            if (provider.isThinking) _buildThinkingIndicator(branding),
            _buildInputArea(provider, branding),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuddyProvider provider, BrandingProvider branding) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.black.withOpacity(0.06))),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // History Button
          InkWell(
            onTap: () => _scaffoldKey.currentState?.openDrawer(),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [branding.primaryColor, branding.primaryColor.withOpacity(0.8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: branding.primaryColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(LucideIcons.history, color: Colors.white, size: 20),
            ),
          ),

          // Back Button
          InkWell(
            onTap: () => Navigator.pop(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [branding.primaryColor, branding.primaryColor.withOpacity(0.8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: branding.primaryColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.arrowLeft, size: 14, color: Colors.white),
                  SizedBox(width: 6),
                  Text(
                    "BACK",
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: Colors.white,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BrandingProvider branding) {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 40),
            _buildPixelAnimation(branding),
            const SizedBox(height: 28),
            Text(
              "Hey Buddy!",
              style: GoogleFonts.outfit(
                fontSize: 32,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              "Tap to speak or type below",
              style: GoogleFonts.outfit(
                fontSize: 16,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 40),
          ],
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
        borderRadius: BorderRadius.circular(20),
      ),
      child: CustomPaint(
        painter: PixelPainter(branding.primaryColor),
      ),
    );
  }

  Widget _buildChatList(BuddyProvider provider, BrandingProvider branding) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(18),
      itemCount: provider.messages.length,
      itemBuilder: (context, index) {
        final msg = provider.messages[index];
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
                    fontWeight: FontWeight.w800,
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
                    topLeft: const Radius.circular(22),
                    topRight: const Radius.circular(22),
                    bottomLeft: Radius.circular(isUser ? 22 : 5),
                    bottomRight: Radius.circular(isUser ? 5 : 22),
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
                    Text(
                      msg['text'],
                      style: GoogleFonts.outfit(
                        color: isUser ? Colors.white : const Color(0xFF1E293B),
                        fontSize: 15,
                        fontWeight: isUser ? FontWeight.w500 : FontWeight.w400,
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
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.black.withOpacity(0.04)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
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

  Widget _buildInputArea(BuddyProvider provider, BrandingProvider branding) {
    return Container(
      padding: const EdgeInsets.all(20),
      color: Colors.white,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (provider.messages.isEmpty) ...[
              Row(
                  children: [
                      _buildQuickAction("Create reminder", LucideIcons.plus, () {}, branding),
                      const SizedBox(width: 12),
                      _buildQuickAction("Upload Image", LucideIcons.camera, _pickImage, branding),
                  ],
              ),
              const SizedBox(height: 20),
          ],
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(40),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(LucideIcons.image, color: Color(0xFF94A3B8), size: 20),
                  onPressed: _pickImage,
                ),
                Expanded(
                  child: TextField(
                    controller: _inputController,
                    style: GoogleFonts.outfit(fontSize: 15),
                    decoration: const InputDecoration(
                      hintText: "Ask Buddy anything...",
                      border: InputBorder.none,
                      hintStyle: TextStyle(color: Color(0xFF94A3B8)),
                    ),
                    onSubmitted: (_) => _handleSend(),
                  ),
                ),
                IconButton(
                  icon: Icon(_isListening ? LucideIcons.mic : LucideIcons.mic, 
                    color: _isListening ? Colors.red : const Color(0xFF94A3B8), 
                    size: 20),
                  onPressed: _isListening ? _stopListening : _startListening,
                ),
                const SizedBox(width: 4),
                InkWell(
                  onTap: _handleSend,
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: branding.primaryColor,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.send, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(
            "Buddy AI can make mistakes. Check important information.",
            style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF94A3B8)),
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

  Widget _buildHistoryDrawer(BuddyProvider provider, BrandingProvider branding) {
    return Drawer(
      width: MediaQuery.of(context).size.width * 0.85,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.only(topRight: Radius.circular(24), bottomRight: Radius.circular(24))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Conversation History", style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.bold)),
                IconButton(icon: const Icon(LucideIcons.x), onPressed: () => Navigator.pop(context)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ElevatedButton.icon(
              onPressed: () {
                  provider.startNewChat();
                  Navigator.pop(context);
              },
              icon: const Icon(LucideIcons.plus, size: 18),
              label: const Text("New Conversation"),
              style: ElevatedButton.styleFrom(
                  backgroundColor: branding.primaryColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const Divider(height: 40),
          Expanded(
            child: provider.isLoading 
              ? Center(child: CircularProgressIndicator(color: branding.primaryColor))
              : provider.historyList.isEmpty
                ? const Center(child: Text("No history yet"))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: provider.historyList.length,
                    itemBuilder: (context, index) {
                      final chat = provider.historyList[index];
                      final isCurrent = chat['_id'] == provider.currentConversationId;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: isCurrent ? branding.primaryColor.withOpacity(0.05) : Colors.transparent,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: isCurrent ? branding.primaryColor.withOpacity(0.2) : Colors.transparent),
                        ),
                        child: ListTile(
                          onTap: () async {
                              // Execute pop first to avoid "looking up deactivated widget" error
                              Navigator.pop(context);
                              await provider.loadConversation(chat['_id']);
                              _scrollToBottom();
                          },
                          leading: Icon(LucideIcons.messageSquare, color: isCurrent ? branding.primaryColor : const Color(0xFF94A3B8), size: 18),
                          title: Text(
                            chat['title'] ?? "History Chat",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500),
                          ),
                          subtitle: Text(
                            DateFormat('dd MMM, yyyy').format(DateTime.parse(chat['createdAt'])),
                            style: const TextStyle(fontSize: 11),
                          ),
                          trailing: IconButton(
                            icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.grey),
                            onPressed: () => provider.deleteConversation(chat['_id']),
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: TextButton.icon(
                onPressed: () => provider.deleteAllHistory(),
                icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.red),
                label: const Text("Clear All History", style: TextStyle(color: Colors.red)),
            ),
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
