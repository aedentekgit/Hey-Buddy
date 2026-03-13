import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

/// Top navigation header — matches the JSX TopNav gradient design.
/// Index mapping: 0 = Buddy, 1 = Explore, 2 = Settings
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

  bool get _buddyActive => currentIndex == 0;
  bool get _exploreActive => currentIndex == 1;
  bool get _settingsActive => currentIndex == 2;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 60,
      decoration: const BoxDecoration(gradient: AppColors.headerGradient),
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: Row(
        children: [
          if (_settingsActive)
            GestureDetector(
              onTap: () => Navigator.maybePop(context),
              child: Container(
                width: 38,
                height: 38,
                margin: const EdgeInsets.only(right: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  LucideIcons.chevronLeft,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          // ── Left tabs ────────────────────────────────────────────
          _NavTab(
            icon: LucideIcons.user,
            label: 'Buddy',
            active: _buddyActive,
            onTap: () => onTabTapped(0),
          ),
          const SizedBox(width: 20),
          _NavTab(
            icon: LucideIcons.compass,
            label: 'Explore',
            active: _exploreActive,
            onTap: () => onTabTapped(1),
          ),
          const Spacer(),
          // ── Settings button ───────────────────────────────────────
          GestureDetector(
            onTap: onProfileTapped,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(13),
                color: _settingsActive
                    ? Colors.white.withOpacity(0.95)
                    : Colors.white.withOpacity(0.15),
                boxShadow: _settingsActive
                    ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.18),
                          blurRadius: 12,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : null,
              ),
              child: Icon(
                LucideIcons.settings,
                size: 17,
                color: _settingsActive
                    ? AppColors.accent
                    : Colors.white.withOpacity(0.9),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavTab extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _NavTab({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedSize(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeInOut,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: active ? 24 : 18,
              color: active ? Colors.white : Colors.white.withOpacity(0.45),
            ),
            if (active) ...[
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.nunito(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
