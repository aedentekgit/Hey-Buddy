import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/explore/providers/family_provider.dart';
import 'package:buddy_mobile/features/explore/screens/family_chat_screen.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class ArchivedChatsScreen extends StatelessWidget {
  const ArchivedChatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.surface,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: Icon(LucideIcons.chevronLeft, color: AppColors.text, size: 24),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Archived Chats',
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
          ),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1.0),
          child: Container(
            color: AppColors.border,
            height: 1.0,
          ),
        ),
      ),
      body: Consumer<FamilyProvider>(
        builder: (context, provider, _) {
          final archivedMembers = provider.members
              .where((m) =>
                  m['user_id'] != provider.currentUserId &&
                  provider.archivedMemberIds.contains(m['user_id']))
              .toList();

          if (archivedMembers.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(LucideIcons.archive, size: 48, color: AppColors.textMid.withAlpha(80)),
                  const SizedBox(height: 16),
                  Text(
                    'No archived chats',
                    style: GoogleFonts.inter(fontSize: 15, color: AppColors.textMid),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
            itemCount: archivedMembers.length,
            physics: const BouncingScrollPhysics(),
            itemBuilder: (context, index) {
              final m = archivedMembers[index];
              return _ArchivedMemberCard(
                member: m,
                onUnarchive: () => provider.toggleArchive(m['user_id']),
                onChat: () {
                  provider.openPrivateChat(m['user_id']);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => FamilyChatScreen(
                        title: m['name'],
                        avatarUrl: m['profilePicture'],
                      ),
                    ),
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}

class _ArchivedMemberCard extends StatelessWidget {
  final dynamic member;
  final VoidCallback onUnarchive;
  final VoidCallback onChat;

  const _ArchivedMemberCard({
    required this.member,
    required this.onUnarchive,
    required this.onChat,
  });

  @override
  Widget build(BuildContext context) {
    final name = member['name']?.toString() ?? '?';
    final role = member['role']?.toString() ?? member['email']?.toString() ?? '';
    final profilePic = AppConfig.formatImageUrl(member['profilePicture'] as String?);

    final avatarColors = [
      AppColors.accent, AppColors.teal, AppColors.orange,
      AppColors.pink, AppColors.purple,
    ];
    final colorIdx = name.codeUnits.fold(0, (a, b) => a + b) % avatarColors.length;
    final avatarColor = avatarColors[colorIdx];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [avatarColor, avatarColor.withAlpha(200)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(50 / 2.4),
            ),
            child: profilePic != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(50 / 2.4),
                    child: CachedNetworkImage(
                      imageUrl: profilePic,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => _fallbackAvatar(name),
                    ),
                  )
                : _fallbackAvatar(name),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.outfit(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.text,
                  ),
                ),
                if (role.isNotEmpty)
                  Text(
                    role,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textMid,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          Row(
            children: [
              GestureDetector(
                onTap: onUnarchive,
                child: Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(LucideIcons.archiveRestore, size: 18, color: AppColors.accent),
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: onChat,
                child: Container(
                  width: 38, height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Icon(LucideIcons.messageCircle, size: 18, color: AppColors.textMid),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _fallbackAvatar(String name) {
    return Center(
      child: Text(
        name[0].toUpperCase(),
        style: GoogleFonts.nunito(
          fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white,
        ),
      ),
    );
  }
}
