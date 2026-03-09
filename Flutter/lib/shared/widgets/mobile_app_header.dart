import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';

class MobileAppHeader extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTabTapped;
  final VoidCallback onProfileTapped;

  const MobileAppHeader({
    super.key,
    required this.currentIndex,
    required this.onTabTapped,
    required this.onProfileTapped,
  });

  @override
  Widget build(BuildContext context) {
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    final String? profileUrl = AppConfig.formatImageUrl(user['profilePicture']);

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 8),
      color: const Color(0xFFF9FAFF),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              GestureDetector(
                onTap: () => onTabTapped(1),
                child: Consumer<BrandingProvider>(
                  builder: (context, branding, _) => Text(
                    branding.appName,
                    style: GoogleFonts.outfit(
                      fontSize: currentIndex == 1 ? 24 : 18,
                      fontWeight: currentIndex == 1 ? FontWeight.w600 : FontWeight.w500,
                      color: currentIndex == 1 ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              GestureDetector(
                onTap: () => onTabTapped(0),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 0.0), // reset bottom padding compared to old
                  child: Text(
                    "Explore",
                    style: GoogleFonts.outfit(
                      fontSize: currentIndex == 0 ? 24 : 18,
                      fontWeight: currentIndex == 0 ? FontWeight.w600 : FontWeight.w500,
                      color: currentIndex == 0 ? const Color(0xFF1E293B) : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
              ),
            ],
          ),
          InkWell(
            onTap: onProfileTapped,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: ClipOval(
                child: profileUrl != null
                    ? CachedNetworkImage(
                        imageUrl: profileUrl,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          color: const Color(0xFFF1F5F9),
                          padding: const EdgeInsets.all(8),
                          child: const CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF64748B)),
                        ),
                        errorWidget: (context, url, error) => 
                            const Icon(LucideIcons.user, size: 20, color: Color(0xFF64748B)),
                      )
                    : const Icon(LucideIcons.user, size: 20, color: Color(0xFF64748B)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
