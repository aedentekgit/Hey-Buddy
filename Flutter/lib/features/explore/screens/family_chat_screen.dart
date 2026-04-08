import 'dart:io';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/explore/providers/family_provider.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:flutter/services.dart';
import 'package:buddy_mobile/features/voice_assistant/widgets/animated_ai_input_field.dart';

class FamilyChatScreen extends StatefulWidget {
  final String title;
  final bool isGroup;
  final String? avatarUrl;

  const FamilyChatScreen({
    super.key,
    this.title = 'Private Chat',
    this.isGroup = false,
    this.avatarUrl,
  });

  @override
  State<FamilyChatScreen> createState() => _FamilyChatScreenState();
}

class _FamilyChatScreenState extends State<FamilyChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<FamilyProvider>().clearUnreadCount();
    });
  }

  void _onFocusChange() {
    setState(() {});
  }

  void _onTextChanged() {
    setState(() {});
  }
  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    // No longer needed with reverse: true
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(36),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
                border: Border.all(
                  color: AppColors.border.withValues(alpha: 0.8),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.maybePop(context),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.border.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Icon(
                        LucideIcons.chevronLeft,
                        size: 20,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Avatar
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      gradient: widget.avatarUrl == null ? AppColors.headerGradient : null,
                      borderRadius: BorderRadius.circular(12),
                      image: widget.avatarUrl != null && widget.avatarUrl!.isNotEmpty
                          ? DecorationImage(
                              image: CachedNetworkImageProvider(AppConfig.formatImageUrl(widget.avatarUrl)!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: (widget.avatarUrl == null || widget.avatarUrl!.isEmpty)
                        ? Icon(
                            widget.isGroup ? LucideIcons.users : LucideIcons.user,
                            size: 18,
                            color: Colors.white,
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.isGroup ? 'Family Group' : widget.title,
                          style: GoogleFonts.nunito(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: AppColors.text,
                            height: 1.2,
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
                              'Secure Connection',
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
                  PopupMenuButton<String>(
                    icon: Icon(LucideIcons.moreVertical, color: AppColors.text, size: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    color: AppColors.surface,
                    offset: const Offset(0, 40),
                    onSelected: (value) async {
                      final provider = context.read<FamilyProvider>();
                      if (value == 'mute') {
                        final success = await provider.muteCurrentChat();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(success ? 'Chat mute toggled' : 'Failed to mute chat')),
                        );
                      } else if (value == 'emergency') {
                        final success = await provider.sendEmergencyAlert("Urgent assistance required!");
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(success ? 'SOS Sent to emergency contacts!' : 'Failed to send SOS'),
                            backgroundColor: success ? AppColors.green : AppColors.danger,
                          ),
                        );
                      } else if (value == 'clear') {
                        final success = await provider.deleteCurrentChatHistory();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(success ? 'Chat history cleared' : 'Failed to clear history')),
                        );
                      } else if (value == 'archive') {
                        final success = await provider.archiveCurrentChat();
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(success ? 'Chat archive toggled' : 'Failed to archive chat')),
                        );
                      }
                    },
                    itemBuilder: (context) => [
                      PopupMenuItem(
                        value: 'mute',
                        child: Row(
                          children: [
                            Icon(LucideIcons.bellOff, size: 18, color: AppColors.textMid),
                            const SizedBox(width: 12),
                            Text('Mute', style: GoogleFonts.inter(fontSize: 14, color: AppColors.text)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'emergency',
                        child: Row(
                          children: [
                            Icon(LucideIcons.alertTriangle, size: 18, color: AppColors.danger),
                            const SizedBox(width: 12),
                            Text('Emergency Help', style: GoogleFonts.inter(fontSize: 14, color: AppColors.danger)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'clear',
                        child: Row(
                          children: [
                            Icon(LucideIcons.trash2, size: 18, color: AppColors.textMid),
                            const SizedBox(width: 12),
                            Text('Delete chat history', style: GoogleFonts.inter(fontSize: 14, color: AppColors.text)),
                          ],
                        ),
                      ),
                      PopupMenuItem(
                        value: 'archive',
                        child: Row(
                          children: [
                            Icon(LucideIcons.archive, size: 18, color: AppColors.textMid),
                            const SizedBox(width: 12),
                            Text('Archive', style: GoogleFonts.inter(fontSize: 14, color: AppColors.text)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Consumer<FamilyProvider>(
              builder: (context, provider, _) {
                // scroll to bottom no longer needed for reversed list
                if (provider.isLoading && provider.messages.isEmpty) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (provider.messages.isEmpty) {
                  return _buildEmptyState();
                }
                return ListView.builder(
                  controller: _scrollController,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 20,
                  ),
                  itemCount: provider.messages.length,
                  itemBuilder: (context, index) {
                    final msgData = provider.messages[index];
                    if (msgData is! Map) return const SizedBox();
                    final msg = msgData as Map<String, dynamic>;

                    final bool isMe =
                        provider.currentUserId != null &&
                        msg['sender_id']?.toString() == provider.currentUserId!.toString();

                    String? avatar;
                    if (isMe) {
                      avatar = context
                          .read<UserProvider>()
                          .user['profilePicture'];
                    } else {
                      avatar = AppConfig.formatImageUrl(msg['sender_avatar']);
                    }

                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onLongPress: () {
                        HapticFeedback.lightImpact();
                        _handleLongPressMessage(msg);
                      },
                      child: _buildMessageBubble(msg, isMe, avatar),
                    );
                  },
                );
              },
            ),
          ),
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
            child: Icon(
              LucideIcons.messageSquare,
              size: 28,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'No messages yet',
            style: GoogleFonts.nunito(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Start the conversation!',
            style: GoogleFonts.inter(fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(
    Map<String, dynamic> msg,
    bool isMe,
    String? avatarUrl,
  ) {
    final time = _formatTime(msg['timestamp']);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        mainAxisAlignment: isMe
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          // Left avatar (other person)
          if (!isMe) ...[
            _buildAvatar(msg['sender_name'], avatarUrl: avatarUrl),
            const SizedBox(width: 8),
          ],

          // Bubble
          Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.72,
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                gradient: isMe
                    ? const LinearGradient(
                        colors: [Color(0xFF5B6CF9), AppColors.accent],
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
                          color: Colors.black.withValues(alpha: 0.06),
                          blurRadius: 12,
                          offset: const Offset(0, 3),
                        ),
                      ],
              ),
              child: IntrinsicWidth(
                child: Stack(
                  children: [
                    Padding(
                      padding: EdgeInsets.only(
                        right: isMe ? 4 : 24,
                        left: isMe ? 24 : 4,
                        top: 2,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Handle Forwarded label
                          if (msg['forwardedFrom'] != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 4),
                              child: Row(
                                children: [
                                  Icon(LucideIcons.forward, size: 10, color: Colors.grey),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Forwarded',
                                    style: GoogleFonts.inter(
                                      fontSize: 10,
                                      fontStyle: FontStyle.italic,
                                      color: isMe ? Colors.white70 : Colors.black45,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          
                          // Handle Reply/Tag UI
                          if (msg['replyTo'] != null)
                            GestureDetector(
                              onTap: () {
                                final originalId = msg['replyTo'];
                                if (originalId != null) {
                                  _jumpToMessage(originalId);
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                margin: const EdgeInsets.only(bottom: 8),
                                decoration: BoxDecoration(
                                  color: (isMe ? Colors.white : AppColors.accent).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border(
                                    left: BorderSide(
                                      color: isMe ? Colors.white : AppColors.accent,
                                      width: 3,
                                    ),
                                  ),
                                ),
                                child: Consumer<FamilyProvider>(
                                  builder: (context, provider, _) {
                                    final originalMsg = provider.messages.firstWhere(
                                      (m) => (m['id'] ?? m['_id']) == msg['replyTo'],
                                      orElse: () => null,
                                    );
                                    final sender = originalMsg?['sender_name'] ?? 'Someone';
                                    final content = originalMsg?['content'] ?? (originalMsg?['fileUrl'] != null ? 'Media' : '...');
                                    return Text(
                                      '$sender: $content',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        color: isMe ? Colors.white70 : AppColors.textMid,
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),

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

                          // Media Content
                          if (msg['fileUrl'] != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _buildMediaPreview(msg),
                            ),

                          if (msg['content'] != null && msg['content'].toString().isNotEmpty)
                            Text(
                              msg['content'] ?? '',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w400,
                                color: isMe ? Colors.white : AppColors.text,
                                height: 1.45,
                              ),
                            ),
                          
                          // Reactions, Stars, Pins
                          if ((msg['reactions'] != null && (msg['reactions'] as List).isNotEmpty) || 
                              (msg['isStarred'] == true) || 
                              (msg['isPinned'] == true))
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Wrap(
                                spacing: 4,
                                runSpacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  if (msg['isPinned'] == true)
                                    Icon(LucideIcons.pin, size: 10, color: Colors.blueAccent),
                                  if (msg['isStarred'] == true)
                                    Icon(LucideIcons.star, size: 10, color: Colors.amber),
                                  
                                  ..._buildReactionChips(msg),
                                ],
                              ),
                            ),


                        ],
                      ),
                    ),
                    Positioned(
                      top: -10,
                      right: isMe ? null : -12,
                      left: isMe ? -12 : null,
                      child: GestureDetector(
                        onTapDown: (details) {
                          HapticFeedback.lightImpact();
                          _showLocalizedMenu(msg, details.globalPosition, isMe: isMe);
                        },
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          color: Colors.transparent,
                          child: Icon(
                            LucideIcons.chevronDown,
                            size: 14,
                            color: isMe ? Colors.white70 : AppColors.textDim,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
              ),
              // External Timestamp and Copy Row
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 4, right: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (isMe) ...[
                      GestureDetector(
                        onTap: () {
                          final textToCopy = msg['content']?.toString() ?? '';
                          Clipboard.setData(ClipboardData(text: textToCopy));
                          HapticFeedback.lightImpact();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Copied to clipboard'), behavior: SnackBarBehavior.floating),
                          );
                        },
                        child: Icon(LucideIcons.copy, size: 10, color: AppColors.textDim),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      time,
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        color: AppColors.textDim,
                      ),
                    ),
                    if (isMe) ...[
                      const SizedBox(width: 4),
                      _buildReadReceipt(msg),
                    ],
                    if (!isMe) ...[
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          final textToCopy = msg['content']?.toString() ?? '';
                          Clipboard.setData(ClipboardData(text: textToCopy));
                          HapticFeedback.lightImpact();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Copied to clipboard'), behavior: SnackBarBehavior.floating),
                          );
                        },
                        child: Icon(LucideIcons.copy, size: 10, color: AppColors.textDim),
                      ),
                    ],
                  ],
                ),
              ),
            ],
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

  Widget _buildReadReceipt(Map<String, dynamic> msg) {
    final readBy = List<dynamic>.from(msg['readBy'] ?? []);
    final deliveredTo = List<dynamic>.from(msg['deliveredTo'] ?? []);
    
    // Check if anyone else has read or delivered
    final currentUserId = context.read<FamilyProvider>().currentUserId;
    bool isRead = readBy.any((id) => id.toString() != currentUserId);
    bool isDelivered = deliveredTo.any((id) => id.toString() != currentUserId) || isRead;

    if (isRead) {
      // Blue tick (Cyan-ish to contrast with the blue bubble)
      return const Icon(Icons.done_all, size: 14, color: Color(0xFF00F3FF));
    } else if (isDelivered) {
      // Double grey tick
      return const Icon(Icons.done_all, size: 14, color: Colors.white60);
    } else {
      // Single grey tick
      return const Icon(Icons.check, size: 14, color: Colors.white60);
    }
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
                placeholder: (_, _) => _fallbackAvatarPlaceholder(name, isMe),
                errorWidget: (_, _, _) =>
                    _fallbackAvatarPlaceholder(name, isMe),
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

  List<Widget> _buildReactionChips(Map<String, dynamic> msg) {
    if (msg['reactions'] == null) return [];
    
    final reactions = List<Map<String, dynamic>>.from(msg['reactions']);
    final grouped = <String, List<String>>{};
    for (var r in reactions) {
      final emoji = r['emoji'] as String;
      final userId = r['userId'] as String;
      grouped.putIfAbsent(emoji, () => []).add(userId);
    }

    final currentUserId = context.read<FamilyProvider>().currentUserId;

    return grouped.entries.map((entry) {
      final isMyReaction = entry.value.contains(currentUserId);
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isMyReaction 
              ? AppColors.accent.withValues(alpha: 0.2) 
              : Colors.black.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isMyReaction ? AppColors.accent : Colors.transparent,
            width: 0.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(entry.key, style: const TextStyle(fontSize: 12)),
            if (entry.value.length > 1) ...[
              const SizedBox(width: 2),
              Text(
                '${entry.value.length}',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isMyReaction ? AppColors.accent : AppColors.textMid,
                ),
              ),
            ],
          ],
        ),
      );
    }).toList();
  }

  Widget _buildMediaPreview(Map<String, dynamic> msg) {
    final url = AppConfig.formatImageUrl(msg['fileUrl']);
    final isImage = msg['fileType'] == 'image';

    if (isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: url ?? '',
          placeholder: (_, _) => Container(
            height: 150,
            width: double.infinity,
            color: Colors.black12,
            child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
          ),
          errorWidget: (_, _, _) => Icon(Icons.error),
          fit: BoxFit.cover,
        ),
      );
    }

    // Document Preview
    return GestureDetector(
      onTap: () async {
        if (url != null) {
          final uri = Uri.parse(url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.black.withValues(alpha: 0.1)),
        ),
        child: Row(
          children: [
            Icon(LucideIcons.fileText, size: 20, color: AppColors.accent),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                msg['fileName'] ?? 'Document',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Icon(LucideIcons.download, size: 16, color: AppColors.textMid),
          ],
        ),
      ),
    );
  }

  Widget _buildInputSection() {
    return Consumer<FamilyProvider>(
      builder: (context, provider, _) => Container(
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
        decoration: const BoxDecoration(
          color: Colors.transparent, 
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Replying To Preview
              if (provider.replyingTo != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.reply, size: 16, color: AppColors.accent),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Replying to ${provider.replyingTo['sender_name'] ?? 'someone'}: ${provider.replyingTo['content'] ?? (provider.replyingTo['fileUrl'] != null ? 'Media' : '...')}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMid),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => provider.setReplyingTo(null),
                        child: Icon(LucideIcons.x, size: 16),
                      ),
                    ],
                  ),
                ),

              AnimatedAIInputField(
                controller: _messageController,
                onMicPressed: () {
                  // TODO: Voice message logic
                },
                onAttachPressed: _showAttachmentOptions,
                onSendPressed: _sendMessage,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLocalizedMenu(Map<String, dynamic> msg, Offset position, {bool isMe = false}) {
    final provider = context.read<FamilyProvider>();
    final msgId = (msg['id'] ?? msg['_id'])?.toString();
    if (msgId == null) return;

    final isStarred = msg['isStarred'] ?? false;
    final isPinned = msg['isPinned'] ?? false;

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Close',
      barrierColor: Colors.black26, 
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, anim1, anim2) {
        const width = 220.0;
        double left = isMe ? position.dx - width : position.dx;
        double top = position.dy;
        
        final screenSize = MediaQuery.of(ctx).size;
        // Adjust horizontal if too far right
        if (left + width > screenSize.width) {
          left = screenSize.width - width - 16;
        }
        // Adjust horizontal if too far left
        if (left < 16) {
          left = 16;
        }
        // Adjust vertical if too far down
        if (top + 320 > screenSize.height) {
          top = screenSize.height - 340;
        }

        return Stack(
          children: [
            Positioned(
              left: left,
              top: top,
              child: Material(
                color: Colors.transparent,
                child: FadeTransition(
                  opacity: anim1,
                  child: ScaleTransition(
                    scale: anim1,
                    alignment: isMe ? Alignment.topRight : Alignment.topLeft,
                    child: Container(
                      width: width,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E1E1E),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.4),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                        border: Border.all(color: Colors.white10, width: 0.5),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // Reaction Bar
                          Container(
                            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏'].map((emoji) {
                                return GestureDetector(
                                  onTap: () {
                                    provider.reactToMessage(msgId, emoji);
                                    Navigator.pop(ctx);
                                  },
                                  child: Text(emoji, style: const TextStyle(fontSize: 22)),
                                );
                              }).toList(),
                            ),
                          ),
                          const Divider(color: Colors.white10, height: 1),
                          _buildOptionItem(
                            icon: LucideIcons.reply,
                            label: 'Reply',
                            onTap: () {
                              provider.setReplyingTo(msg);
                              Navigator.pop(ctx);
                            },
                          ),
                          _buildOptionItem(
                            icon: isStarred ? LucideIcons.starOff : LucideIcons.star,
                            label: isStarred ? 'Unstar' : 'Star',
                            iconColor: isStarred ? Colors.amber : Colors.white,
                            onTap: () {
                              provider.starMessage(msgId, !isStarred);
                              Navigator.pop(ctx);
                            },
                          ),
                          _buildOptionItem(
                            icon: isPinned ? LucideIcons.pinOff : LucideIcons.pin,
                            label: isPinned ? 'Unpin' : 'Pin',
                            onTap: () {
                              provider.pinMessage(msgId, !isPinned);
                              Navigator.pop(ctx);
                            },
                          ),
                          _buildOptionItem(
                            icon: LucideIcons.forward,
                            label: 'Forward',
                            onTap: () {
                              Navigator.pop(ctx);
                            },
                          ),
                          _buildOptionItem(
                            icon: LucideIcons.copy,
                            label: 'Copy',
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: msg['content'] ?? ''));
                              Navigator.pop(ctx);
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _handleLongPressMessage(Map<String, dynamic> msg) {
    final provider = context.read<FamilyProvider>();
    final msgId = (msg['id'] ?? msg['_id'])?.toString();
    if (msgId == null) return;

    final isStarred = msg['isStarred'] ?? false;
    final isPinned = msg['isPinned'] ?? false;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF1E1E1E), // Dark theme as per reference
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Reaction Bar (Exactly as image 3)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏'].map((emoji) {
                  return GestureDetector(
                    onTap: () {
                      provider.reactToMessage(msgId, emoji);
                      Navigator.pop(ctx);
                    },
                    child: Text(emoji, style: const TextStyle(fontSize: 28)),
                  );
                }).toList(),
              ),
            ),
            const Divider(color: Colors.white12, height: 1),

            // Actions (Exactly as image 2)
            _buildOptionItem(
              icon: LucideIcons.reply,
              label: 'Reply',
              onTap: () {
                provider.setReplyingTo(msg);
                Navigator.pop(ctx);
              },
            ),
            _buildOptionItem(
              icon: LucideIcons.smile,
              label: 'React',
              onTap: () {
                // Already have the bar, but can show more options here if needed
                Navigator.pop(ctx);
              },
            ),
            _buildOptionItem(
              icon: isStarred ? LucideIcons.starOff : LucideIcons.star,
              label: isStarred ? 'Unstar' : 'Star',
              iconColor: isStarred ? Colors.amber : Colors.white,
              onTap: () {
                provider.starMessage(msgId, !isStarred);
                Navigator.pop(ctx);
              },
            ),
            _buildOptionItem(
              icon: isPinned ? LucideIcons.pinOff : LucideIcons.pin,
              label: isPinned ? 'Unpin' : 'Pin',
              onTap: () {
                provider.pinMessage(msgId, !isPinned);
                Navigator.pop(ctx);
              },
            ),
            _buildOptionItem(
              icon: LucideIcons.forward,
              label: 'Forward',
              onTap: () {
                Navigator.pop(ctx);
                // Implementation for room picker coming soon
              },
            ),
            _buildOptionItem(
              icon: LucideIcons.copy,
              label: 'Copy',
              onTap: () {
                Clipboard.setData(ClipboardData(text: msg['content'] ?? ''));
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied to clipboard')),
                );
              },
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildOptionItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color iconColor = Colors.white,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor, size: 20),
      title: Text(
        label,
        style: GoogleFonts.inter(
          color: Colors.white,
          fontWeight: FontWeight.w500,
          fontSize: 15,
        ),
      ),
      onTap: onTap,
    );
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: Icon(LucideIcons.image, color: AppColors.accent),
              title: Text('Photo Gallery', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(ctx);
                _handleAttachment('gallery');
              },
            ),
            ListTile(
              leading: Icon(LucideIcons.camera, color: AppColors.teal),
              title: Text('Camera', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(ctx);
                _handleAttachment('camera');
              },
            ),
            ListTile(
              leading: Icon(LucideIcons.fileText, color: AppColors.orange),
              title: Text('Document', style: GoogleFonts.inter(fontWeight: FontWeight.w600)),
              onTap: () {
                Navigator.pop(ctx);
                _handleAttachment('document');
              },
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Future<void> _handleAttachment(String type) async {
    final provider = context.read<FamilyProvider>();
    List<int>? bytes;
    String? name;

    try {
      if (type == 'document') {
        final res = await FilePicker.platform.pickFiles();
        if (res != null && res.files.single.bytes != null) {
          bytes = res.files.single.bytes;
          name = res.files.single.name;
        } else if (res != null && res.files.single.path != null) {
          final file = File(res.files.single.path!);
          bytes = await file.readAsBytes();
          name = res.files.single.name;
        }
      } else {
        final picker = ImagePicker();
        final xFile = await picker.pickImage(
          source: type == 'camera' ? ImageSource.camera : ImageSource.gallery,
        );
        if (xFile != null) {
          bytes = await xFile.readAsBytes();
          name = xFile.name;
        }
      }

      if (bytes != null && name != null) {
        // Show loading toast or overlay
        final uploadRes = await provider.uploadChatFile(bytes, name);
        if (uploadRes['success'] == true) {
          provider.sendMessage('', fileData: uploadRes['data']);
        }
      }
    } catch (e) {
      debugPrint('Attachment error: $e');
    }
  }

  void _sendMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty && context.read<FamilyProvider>().replyingTo == null) return;
    context.read<FamilyProvider>().sendMessage(text);
    _messageController.clear();
    _scrollToBottom();
  }

  void _jumpToMessage(String id) {
    final provider = context.read<FamilyProvider>();
    final index = provider.messages.indexWhere((m) => m is Map && m['id'] == id);
    if (index != -1) {
      // In a standard ListView.builder, jumping to arbitrary index is hard
      // unless we use a package like scrollable_positioned_list or
      // fixed heights. We'll at least scroll to a rough area for now.
      _scrollController.animateTo(
        index * 80.0, // Rough estimate of bubble height
        duration: const Duration(milliseconds: 500),
        curve: Curves.easeInOut,
      );
    }
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

