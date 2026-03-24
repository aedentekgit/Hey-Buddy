import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

/// Top navigation header — redesigned as a modern floating pill.
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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(36),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
          BoxShadow(
            color: AppColors.accent.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(
          color: AppColors.border.withValues(alpha: 0.8),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          if (_settingsActive)
            GestureDetector(
              onTap: () => Navigator.maybePop(context),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 38,
                height: 38,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: AppColors.text.withValues(alpha: 0.04),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  LucideIcons.chevronLeft,
                  color: AppColors.text,
                  size: 18,
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
          const SizedBox(width: 8),
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
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _settingsActive
                    ? AppColors.purple.withValues(alpha: 0.1)
                    : AppColors.text.withValues(alpha: 0.03),
                border: _settingsActive
                    ? Border.all(color: AppColors.purple.withValues(alpha: 0.3), width: 1.5)
                    : Border.all(color: Colors.transparent, width: 1.5),
              ),
              child: Icon(
                LucideIcons.settings,
                size: 18,
                color: _settingsActive ? AppColors.purple : AppColors.textMid,
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: active ? 14 : 10,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: active ? AppColors.accent : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: AppColors.accent.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  )
                ]
              : [],
        ),
        child: AnimatedSize(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 18,
                color: active ? Colors.white : AppColors.textMid,
              ),
              if (active) ...[
                const SizedBox(width: 8),
                Text(
                  label,
                  style: GoogleFonts.nunito(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
