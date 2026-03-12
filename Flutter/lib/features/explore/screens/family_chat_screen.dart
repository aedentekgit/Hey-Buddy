import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/explore/providers/family_provider.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

class FamilyChatScreen extends StatefulWidget {
  final String title;
  final bool isGroup;

  const FamilyChatScreen({super.key, this.title = 'Private Chat', this.isGroup = false});

  @override
  State<FamilyChatScreen> createState() => _FamilyChatScreenState();
}

class _FamilyChatScreenState extends State<FamilyChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();
  bool _isTyping = false;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_onTextChanged);
    _focusNode.addListener(_onFocusChange);
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _onFocusChange() {
    setState(() {
      _isFocused = _focusNode.hasFocus;
    });
  }

  void _onTextChanged() {
    setState(() {
      _isTyping = _messageController.text.trim().isNotEmpty;
    });
  }

  @override
  void dispose() {
    _messageController.removeListener(_onTextChanged);
    _focusNode.removeListener(_onFocusChange);
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEEF0FB), // JSX lavender bg
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
          Container(
            color: AppColors.surface,
            child: SafeArea(
              bottom: false,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.maybePop(context),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(LucideIcons.arrowLeft,
                            size: 18, color: AppColors.text),
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Avatar
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: AppColors.headerGradient,
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(
                        widget.isGroup ? LucideIcons.users : LucideIcons.user,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.isGroup ? 'Family Group Chat' : widget.title,
                            style: GoogleFonts.nunito(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                            ),
                          ),
                          Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: AppColors.green,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Secure End-to-End Chat',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.green,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Messages ─────────────────────────────────────────────────
          Expanded(
            child: Consumer<FamilyProvider>(
              builder: (context, provider, _) {
                WidgetsBinding.instance
                    .addPostFrameCallback((_) => _scrollToBottom());
                if (provider.messages.isEmpty) {
                  return _buildEmptyState();
                }
                return ListView.builder(
                  controller: _scrollController,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  itemCount: provider.messages.length,
                  itemBuilder: (context, index) {
                    final msg = provider.messages[index];
                    final bool isMe =
                        msg['sender_id'] == provider.currentUserId;
                    
                    String? avatar;
                    if (isMe) {
                      avatar = context.read<UserProvider>().user['profilePicture'];
                    } else {
                      avatar = AppConfig.formatImageUrl(msg['sender_avatar']);
                    }

                    return _buildMessageBubble(msg, isMe, avatar);
                  },
                );
              },
            ),
          ),

          // ── Input ────────────────────────────────────────────────────
          _buildInputSection(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              gradient: AppColors.headerGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(LucideIcons.messageSquare,
                size: 28, color: Colors.white),
          ),
          const SizedBox(height: 14),
          Text(
            'No messages yet',
            style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            'Start the conversation!',
            style:
                GoogleFonts.inter(fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Map<String, dynamic> msg, bool isMe, String? avatarUrl) {
    final time = _formatTime(msg['timestamp']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Left avatar (other person)
          if (!isMe) ...[
            _buildAvatar(msg['sender_name'], avatarUrl: avatarUrl),
            const SizedBox(width: 8),
          ],

          // Bubble
          ConstrainedBox(
              constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.72),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  gradient: isMe
                      ? const LinearGradient(
                          colors: [Color(0xFF5B6CF9), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        )
                      : null,
                  color: isMe ? null : AppColors.surface,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(18),
                    topRight: const Radius.circular(18),
                    bottomLeft: Radius.circular(isMe ? 18 : 4),
                    bottomRight: Radius.circular(isMe ? 4 : 18),
                  ),
                  boxShadow: isMe
                      ? null
                      : [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.06),
                            blurRadius: 12,
                            offset: const Offset(0, 3),
                          ),
                        ],
                ),
                child: IntrinsicWidth(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Sender name in group chat
                      if (widget.isGroup && !isMe)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            msg['sender_name'] ?? 'Unknown',
                            style: GoogleFonts.nunito(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: AppColors.accent,
                            ),
                          ),
                        ),
                      Text(
                        msg['content'] ?? '',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w400,
                          color: isMe ? Colors.white : AppColors.text,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Align(
                        alignment: Alignment.bottomRight,
                        child: Text(
                          time,
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            color: isMe
                                ? Colors.white.withOpacity(0.65)
                                : AppColors.textDim,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ),

          // Right avatar (me)
          if (isMe) ...[
            const SizedBox(width: 8),
            _buildAvatar(null, isMe: true, avatarUrl: avatarUrl),
          ],
        ],
      ),
    );
  }

  Widget _buildAvatar(String? name, {bool isMe = false, String? avatarUrl}) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        gradient: isMe
            ? AppColors.headerGradient
            : LinearGradient(
                colors: [AppColors.teal, AppColors.accent],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
        borderRadius: BorderRadius.circular(10),
      ),
      child: avatarUrl != null && avatarUrl.isNotEmpty
          ? ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: CachedNetworkImage(
                imageUrl: avatarUrl,
                fit: BoxFit.cover,
                placeholder: (_, __) => _fallbackAvatarPlaceholder(name, isMe),
                errorWidget: (_, __, ___) => _fallbackAvatarPlaceholder(name, isMe),
              ),
            )
          : _fallbackAvatarPlaceholder(name, isMe),
    );
  }

  Widget _fallbackAvatarPlaceholder(String? name, bool isMe) {
    return Center(
      child: Text(
        isMe ? 'Me' : (name?.isNotEmpty == true ? name![0].toUpperCase() : '?'),
        style: GoogleFonts.nunito(
          fontSize: isMe ? 9 : 13,
          fontWeight: FontWeight.w900,
          color: Colors.white,
        ),
      ),
    );
  }

  Widget _buildInputSection() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 4, 24, 12),
      decoration: const BoxDecoration(
        color: Colors.transparent, // Let the parent bg show through
      ),
      child: SafeArea(
        top: false,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(100),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF6366F1).withOpacity(0.08),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: CustomPaint(
            painter: _StaticGradientRingPainter(
              borderWidth: 1.5,
              isEnabled: true,
              isFocused: _isFocused,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(100),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                  decoration: BoxDecoration(
                    color: _isFocused
                        ? Colors.white.withOpacity(0.95)
                        : Colors.white.withOpacity(0.85),
                    borderRadius: BorderRadius.circular(100),
                  ),
                  child: Row(
                    children: [
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          focusNode: _focusNode,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            color: const Color(0xFF1E293B),
                            fontWeight: FontWeight.w500,
                          ),
                          decoration: InputDecoration(
                            hintText: 'Type a message…',
                            hintStyle: GoogleFonts.inter(
                              color: const Color(0xFF94A3B8),
                              fontSize: 14,
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(vertical: 8),
                          ),
                          textCapitalization: TextCapitalization.sentences,
                          onSubmitted: (_) => _sendMessage(),
                        ),
                      ),
                      
                      // Mic Button
                      _buildActionIconButton(
                        icon: LucideIcons.mic,
                        color: const Color(0xFF64748B),
                        onTap: () {
                          // TODO: Voice message logic
                        },
                      ),
                      
                      const SizedBox(width: 4),
                      
                      // Plus Button
                      _buildActionIconButton(
                        icon: LucideIcons.plus,
                        color: const Color(0xFF64748B),
                        onTap: () {
                          // TODO: Attach logic
                        },
                      ),
                      
                      const SizedBox(width: 4),
                      
                      // Send Button (only visible when typing)
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        transitionBuilder: (child, animation) => ScaleTransition(
                          scale: animation,
                          child: FadeTransition(opacity: animation, child: child),
                        ),
                        child: _isTyping
                            ? InkWell(
                                key: const ValueKey('send_btn'),
                                onTap: _sendMessage,
                                borderRadius: BorderRadius.circular(100),
                                child: Container(
                                  padding: const EdgeInsets.all(8),
                                  margin: const EdgeInsets.only(left: 4, right: 4),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                    ),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF6366F1).withOpacity(0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      )
                                    ],
                                  ),
                                  child: const Icon(LucideIcons.send, color: Colors.white, size: 16),
                                ),
                              )
                            : const SizedBox(key: ValueKey('empty_send')),
                      ),
                      const SizedBox(width: 4),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionIconButton({
    required IconData icon,
    required Color color,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: color,
          size: 20,
        ),
      ),
    );
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    context.read<FamilyProvider>().sendMessage(text);
    _messageController.clear();
    _scrollToBottom();
  }

  String _formatTime(dynamic timestamp) {
    if (timestamp == null) return '';
    try {
      final dt = DateTime.parse(timestamp.toString()).toLocal();
      final h = dt.hour;
      final m = dt.minute.toString().padLeft(2, '0');
      final period = h >= 12 ? 'PM' : 'AM';
      final hour = h % 12 == 0 ? 12 : h % 12;
      return '$hour:$m $period';
    } catch (e) {
      return '';
    }
  }
}

class _StaticGradientRingPainter extends CustomPainter {
  final double borderWidth;
  final bool isEnabled;
  final bool isFocused;

  _StaticGradientRingPainter({
    required this.borderWidth,
    required this.isEnabled,
    required this.isFocused,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!isEnabled) {
      final borderRect = Offset.zero & size;
      final borderRRect = RRect.fromRectAndRadius(
          borderRect, Radius.circular(size.height / 2));
      final paint = Paint()
        ..color = const Color(0xFFE2E8F0)
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth;
      canvas.drawRRect(borderRRect, paint);
      return;
    }

    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(size.height / 2));

    final List<Color> colors = [
      const Color(0xFF3B82F6), // Blue
      const Color(0xFF8B5CF6), // Purple
      const Color(0xFFD946EF), // Pink
      const Color(0xFF6366F1), // Indigo
      const Color(0xFF3B82F6),
    ];

    final gradient = SweepGradient(
      colors: colors,
      stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      transform: const GradientRotation(math.pi / 4), // Static rotation
    );

    // Inner shadow/glow when focused
    if (isFocused) {
      final blurPaint = Paint()
        ..shader = gradient.createShader(rect)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8)
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth * 2;
      canvas.drawRRect(rrect, blurPaint);
    }

    final paint = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(covariant _StaticGradientRingPainter oldDelegate) {
    return oldDelegate.isFocused != isFocused ||
        oldDelegate.isEnabled != isEnabled ||
        oldDelegate.borderWidth != borderWidth;
  }
}
