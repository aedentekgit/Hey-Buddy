import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'dart:io' show Platform;
import 'package:speech_to_text/speech_to_text.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:permission_handler/permission_handler.dart';

class BuddyAssistantPage extends StatefulWidget {
  const BuddyAssistantPage({super.key});

  @override
  State<BuddyAssistantPage> createState() => _BuddyAssistantPageState();
}

class _BuddyAssistantPageState extends State<BuddyAssistantPage> with TickerProviderStateMixin {
  late AnimationController _orbController;
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  // Voice & Language States
  final SpeechToText _speechToText = SpeechToText();
  final FlutterTts _flutterTts = FlutterTts();
  bool _speechEnabled = false;
  String _selectedLanguage = "auto";
  
  bool _isListening = false;
  bool _isParsing = false;
  String _buddyReply = "";
  // ignore: unused_field
  String _userQuery = "";
  
  // Use 10.0.2.2 for Android Emulator, localhost for iOS/Web
  String get _baseUrl {
    if (Platform.isAndroid) return 'http://10.0.2.2:5001/api';
    return 'http://localhost:5001/api';
  }

  @override
  void initState() {
    super.initState();
    _orbController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
    _initVoiceSystem();
  }

  Future<void> _initVoiceSystem() async {
    // Request Microphone Permission
    var status = await Permission.microphone.request();
    if (status.isGranted) {
      _speechEnabled = await _speechToText.initialize(
        onStatus: (status) => consoleLog("Speech Status: $status"),
        onError: (errorNotification) => consoleLog("Speech Error: $errorNotification"),
      );
    }
    
    // Setup TTS
    await _flutterTts.setLanguage(_selectedLanguage);
    await _flutterTts.setSpeechRate(0.5);
    
    if (mounted) setState(() {});
  }
  
  void consoleLog(String msg) => print("[BuddyVoice] $msg");

  @override
  void dispose() {
    _orbController.dispose();
    _inputController.dispose();
    _scrollController.dispose();
    _speechToText.stop();
    _flutterTts.stop();
    super.dispose();
  }

  // --- VOICE LOGIC ---

  void _startListening() async {
    if (!_speechEnabled) return;
    
    await _flutterTts.stop(); // Stop any current speaking
    
    await _speechToText.listen(
      onResult: (result) {
        if (result.finalResult) {
          setState(() {
            _inputController.text = result.recognizedWords;
            _isListening = false;
          });
          _sendMessage(result.recognizedWords);
        }
      },
      localeId: _selectedLanguage == 'auto' ? null : _selectedLanguage,
    );
    setState(() => _isListening = true);
  }

  void _stopListening() async {
    await _speechToText.stop();
    setState(() => _isListening = false);
  }

  Future<void> _speak(String text) async {
    if (text.isEmpty) return;
    await _flutterTts.setLanguage(_selectedLanguage);
    await _flutterTts.speak(text);
  }

  // --- API CALL ---
  Future<void> _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    setState(() {
      _isParsing = true;
      _userQuery = text;
      _buddyReply = ""; 
    });

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final token = authProvider.token;

      final response = await http.post(
        Uri.parse('$_baseUrl/voice/parse'),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $token",
        },
        body: jsonEncode({
          "text": text,
          "language": _selectedLanguage,
          "timeZone": DateTime.now().timeZoneName,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final reply = data['data']['reply'];
          setState(() {
            _buddyReply = reply;
          });
          _speak(reply); // Auto-speak result
        } else {
          setState(() => _buddyReply = "Error: ${data['message']}");
        }
      } else {
        setState(() => _buddyReply = "Failed. Status: ${response.statusCode}");
      }
    } catch (e) {
      setState(() => _buddyReply = "Connection error: $e");
    } finally {
      setState(() => _isParsing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                controller: _scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 40),
                    _buildAnimatedOrb(),
                    const SizedBox(height: 32),
                    _buildStatusText(),
                    if (_buddyReply.isNotEmpty) _buildResponseCard(),
                    if (_buddyReply.isEmpty) _buildQuickCommands(),
                    const SizedBox(height: 100), // Spacing for bottom input
                  ],
                ),
              ),
            ),
            _buildInputArea(),
          ],
        ),
      ),
    );
  }

  // --- PREMIUM AI ORB ANIMATION ---
  Widget _buildAnimatedOrb() {
    final Color primaryColor = Theme.of(context).primaryColor;
    return GestureDetector(
      onTapDown: (_) => _startListening(),
      onTapUp: (_) => _stopListening(),
      onCancel: () => _stopListening(),
      child: AnimatedBuilder(
        animation: _orbController,
        builder: (context, child) {
          return Stack(
            alignment: Alignment.center,
            children: [
              // Outer Glow
              Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      primaryColor.withOpacity(_isParsing || _isListening ? 0.4 : 0.2),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              // Outer Ring
              Transform.rotate(
                angle: _orbController.value * 2 * math.pi,
                child: Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: primaryColor.withOpacity(0.3), width: 1),
                  ),
                ),
              ),
              // Core Orb
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: (_isParsing || _isListening)
                      ? [primaryColor.withOpacity(0.8), primaryColor] 
                      : [primaryColor, primaryColor.withOpacity(0.6)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: primaryColor.withOpacity(0.5),
                      blurRadius: 20,
                      spreadRadius: 5,
                    )
                  ],
                ),
                child: Icon(
                  _isListening ? LucideIcons.mic : LucideIcons.sparkles,
                  color: Colors.white,
                  size: 32,
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatusText() {
    return Column(
      children: [
        Text(
          _isParsing ? "Buddy is thinking..." : (_isListening ? "Listening..." : "Hey Buddy!"),
          style: GoogleFonts.outfit(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF1E293B),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          _isListening ? "I'm listening..." : "Hold the orb to speak",
          style: const TextStyle(color: Color(0xFF64748B), fontSize: 16),
        ),
      ],
    );
  }

  // --- QUICK COMMANDS GRID ---
  Widget _buildQuickCommands() {
    final commands = [
      {"icon": LucideIcons.plus, "text": "Set Reminder"},
      {"icon": LucideIcons.camera, "text": "Scan Image"},
      {"icon": LucideIcons.brain, "text": "Memories"},
      {"icon": LucideIcons.list, "text": "Active Tasks"},
    ];

    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 2.5,
        ),
        itemCount: commands.length,
        itemBuilder: (context, index) {
          return InkWell(
            onTap: () {
                // Handle quick commands
                _sendMessage("List my reminders"); // Example action
            },
            child: Container(
                decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                    Icon(commands[index]['icon'] as IconData, size: 18, color: const Color(0xFF6366F1)),
                    const SizedBox(width: 8),
                    Text(commands[index]['text'] as String, style: const TextStyle(fontWeight: FontWeight.w600)),
                ],
                ),
            ),
          );
        },
      ),
    );
  }

  // --- RESPONSE CARD ---
  Widget _buildResponseCard() {
    return Container(
      margin: const EdgeInsets.only(top: 32),
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 30)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("BUDDY", style: TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.w800, fontSize: 12)),
              IconButton(
                icon: const Icon(LucideIcons.volume2, size: 18, color: Color(0xFF6366F1)),
                onPressed: () => _speak(_buddyReply),
              )
            ],
          ),
          const SizedBox(height: 8),
          Text(_buddyReply, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, height: 1.5)),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.all(20),
      color: Colors.white.withOpacity(0.9), // Glass effect background for input
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(40),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                decoration: const InputDecoration(hintText: "Ask Buddy anything...", border: InputBorder.none),
                onSubmitted: (val) {
                  _sendMessage(val);
                  _inputController.clear();
                },
              ),
            ),
            IconButton(
              icon: const Icon(LucideIcons.send, color: Color(0xFF6366F1)),
              onPressed: () {
                _sendMessage(_inputController.text);
                _inputController.clear();
              },
            )
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          CircleAvatar(backgroundColor: const Color(0xFFE2E8F0), child: InkWell(
            onTap: () => authProvider.logout(), // Logout on avatar tap for now
            child: const Icon(LucideIcons.user, color: Colors.blueGrey)
          )),
          
          // Language Selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)]
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedLanguage,
                icon: const Icon(LucideIcons.globe, size: 14, color: Color(0xFF6366F1)),
                style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black),
                onChanged: (String? newValue) {
                  if (newValue != null) {
                    setState(() {
                      _selectedLanguage = newValue;
                    });
                    _flutterTts.setLanguage(newValue);
                  }
                },
                items: const [
                  DropdownMenuItem(value: "auto", child: Text("✨ Auto Detect")),
                  DropdownMenuItem(value: "en-US", child: Text("🇺🇸 English")),
                  DropdownMenuItem(value: "hi-IN", child: Text("🇮🇳 हिन्दी (Hindi)")),
                  DropdownMenuItem(value: "bn-IN", child: Text("🇮🇳 বাংলা (Bengali)")),
                  DropdownMenuItem(value: "te-IN", child: Text("🇮🇳 తెలుగు (Telugu)")),
                  DropdownMenuItem(value: "mr-IN", child: Text("🇮🇳 मराठी (Marathi)")),
                  DropdownMenuItem(value: "ta-IN", child: Text("🇮🇳 தமிழ் (Tamil)")),
                  DropdownMenuItem(value: "gu-IN", child: Text("🇮🇳 ગુજરાતી (Gujarati)")),
                  DropdownMenuItem(value: "kn-IN", child: Text("🇮🇳 ಕನ್ನಡ (Kannada)")),
                  DropdownMenuItem(value: "ml-IN", child: Text("🇮🇳 മലയാളം (Malayalam)")),
                  DropdownMenuItem(value: "pa-IN", child: Text("🇮🇳 ਪੰਜਾਬੀ (Punjabi)")),
                  DropdownMenuItem(value: "es-ES", child: Text("🇪🇸 Español")),
                  DropdownMenuItem(value: "fr-FR", child: Text("🇫🇷 Français")),
                  DropdownMenuItem(value: "de-DE", child: Text("🇩🇪 Deutsch")),
                  DropdownMenuItem(value: "zh-CN", child: Text("🇨🇳 中文 (Chinese)")),
                  DropdownMenuItem(value: "ja-JP", child: Text("🇯🇵 日本語 (Japanese)")),
                  DropdownMenuItem(value: "ko-KR", child: Text("🇰🇷 한국어 (Korean)")),
                  DropdownMenuItem(value: "pt-BR", child: Text("🇧🇷 Português")),
                  DropdownMenuItem(value: "it-IT", child: Text("🇮� Italiano")),
                  DropdownMenuItem(value: "ru-RU", child: Text("🇷🇺 Русский")),
                  DropdownMenuItem(value: "ar-SA", child: Text("🇸🇦 العربية (Arabic)")),
                ],
              ),
            ),
          ),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
            child: const Row(children: [Icon(LucideIcons.zap, size: 14, color: Colors.amber), Text(" PRO", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))]),
          )
        ],
      ),
    );
  }
}
