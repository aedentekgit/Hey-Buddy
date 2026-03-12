import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

class QuickActionItem {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  QuickActionItem({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });
}

class QuickActionsGrid extends StatelessWidget {
  final List<QuickActionItem> actions;

  const QuickActionsGrid({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: GoogleFonts.nunito(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.7,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            return _ActionCard(action: action);
          },
        ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  final QuickActionItem action;

  const _ActionCard({required this.action});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: action.onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: action.color.withOpacity(0.35), width: 1.5),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: action.color.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                action.icon,
                color: action.color,
                size: 20,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              action.label,
              style: GoogleFonts.nunito(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: action.color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
