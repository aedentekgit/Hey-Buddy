import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/animated_ai_input_field.dart';

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
    with TickerProviderStateMixin {
  final String _httpHost = '10.0.2.2:5003';
  final String _wsHost = '10.0.2.2:5002';

  final TextEditingController _commandController = TextEditingController();
  final ScrollController _logScrollController = ScrollController();

  WebSocket? _wsChannel;
  bool _isConnected = false;
  String _assistantState = 'THINKING'; // LISTENING, THINKING, SPEAKING
  bool _isMuted = false;
  int _messageLimit = 15;
  final List<String> _logs = [];

  late AnimationController _pulseController;
  late AnimationController _rotateController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();

    // Orb/Face animations
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 0.9, end: 1.1).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _rotateController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();

    _connectWebSocket();
    _checkInitialSettings();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rotateController.dispose();
    _wsChannel?.close();
    _commandController.dispose();
    _logScrollController.dispose();
    super.dispose();
  }

  void _checkInitialSettings() async {
    try {
      final response = await http
          .get(Uri.parse('http://$_httpHost/api/status'))
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
      }
    } catch (_) {}
  }

  void _connectWebSocket() async {
    try {
      _wsChannel = await WebSocket.connect(
        'ws://$_wsHost',
      ).timeout(const Duration(seconds: 4));

      setState(() {
        _isConnected = true;
        _addLog('[System] Voice Stream Connected.');
      });

      _wsChannel!.listen(
        (message) {
          if (message is String) {
            try {
              final data = json.decode(message);
              if (data['type'] == 'state') {
                setState(() {
                  String s = data['state'] ?? 'THINKING';
                  if (s == 'MUTED') {
                    _isMuted = true;
                  } else {
                    _isMuted = false;
                    _assistantState = s;
                  }
                });
              } else if (data['type'] == 'log') {
                final String text = data['text'] ?? '';
                if (!text.startsWith('You:') && !text.startsWith('Buddy:')) {
                  _addLog(text);
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
        _assistantState = 'THINKING';
        _wsChannel = null;
      });
      _addLog('[System] Disconnected: $reason');
      // Retry connection after 5 seconds
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted && !_isConnected) {
          _connectWebSocket();
        }
      });
    }
  }

  Future<void> _sendTextCommand(String text) async {
    if (text.isEmpty) return;
    _commandController.clear();
    _addLog('You: $text');

    if (_wsChannel != null && _isConnected) {
      _wsChannel!.add(json.encode({'type': 'text', 'text': text}));
    } else {
      // HTTP Fallback
      try {
        await http.post(
          Uri.parse('http://$_httpHost/api/command'),
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
    try {
      final response = await http.post(
        Uri.parse('http://$_httpHost/api/action'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'action': action, 'parameters': params ?? {}}),
      );
      if (response.statusCode == 200) {
        json.decode(response.body);
        if (action == 'mute_volume') {
          setState(() {
            _isMuted = !_isMuted;
          });
        }
      }
    } catch (e) {
      _addLog('[Error] Action execution failed: $e');
    }
  }

  void _addLog(String log) {
    if (log.startsWith('[System]')) return;

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

  Color _getOrbColor() {
    if (_isMuted) return Colors.redAccent;
    switch (_assistantState) {
      case 'LISTENING':
        return const Color(0xFF00E5FF); // Bright Cyan
      case 'SPEAKING':
        return const Color(0xFF00FF87); // Vibrant Green
      case 'THINKING':
      default:
        return const Color(0xFFC5A059); // Premium Gold
    }
  }

  String _getOrbLabel() {
    if (_isMuted) return 'BUDDY MUTED';
    switch (_assistantState) {
      case 'LISTENING':
        return 'BUDDY LISTENING';
      case 'SPEAKING':
        return 'BUDDY SPEAKING';
      case 'THINKING':
      default:
        return 'BUDDY THINKING';
    }
  }

  @override
  Widget build(BuildContext context) {
    final allVisibleLogs = _logs
        .where((log) => !log.startsWith('[System]'))
        .toList();
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

                  if (log.startsWith('[Error]')) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Text(
                          log,
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            color: Colors.black38,
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
                              'assets/images/buddy_logo.gif',
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
                                  color: Colors.black.withOpacity(0.05),
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
            isListening: false,
            isSpeaking: false,
            isVoiceSessionActive: false,
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

  Widget _buildControlBtn({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.outfit(fontSize: 9, color: Colors.white60),
            ),
          ],
        ),
      ),
    );
  }
}
