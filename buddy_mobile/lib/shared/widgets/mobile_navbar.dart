import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';

class MobileNavbar extends StatelessWidget {
  final int currentIndex;
  final Function(int) onTap;

  const MobileNavbar({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 90, // Slightly taller to accommodate labels comfortably
      clipBehavior: Clip.none,
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFF1F5F9), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            offset: const Offset(0, -4),
            blurRadius: 10,
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // Sidebar items with a gap in the middle
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _buildNavItem(context, 0, LucideIcons.home, "Home"),
                _buildNavItem(context, 1, LucideIcons.bell, "Reminder"),
                _buildCenterLabel(context), // Center label "Buddy"
                _buildNavItem(context, 3, LucideIcons.brain, "Memory"),
                _buildNavItem(context, 4, LucideIcons.moreHorizontal, "More"),
              ],
            ),
          ),
          // Floating Center Button
          Positioned(
            top: -24, // Float it above the bar
            child: _buildFloatingButton(context),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, int index, IconData icon, String label) {
    final bool isSelected = currentIndex == index;
    final Color primaryColor = Theme.of(context).primaryColor;
    final Color color = isSelected ? primaryColor : const Color(0xFF94A3B8);

    return InkWell(
      onTap: () => onTap(index),
      child: SizedBox(
        width: 65,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 24, color: color),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterLabel(BuildContext context) {
    final bool isSelected = currentIndex == 2;
    return GestureDetector(
      onTap: () => onTap(2),
      child: SizedBox(
        width: 65,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(height: 30), // Gap for the floating button
            Text(
              "Buddy",
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isSelected ? Theme.of(context).primaryColor : const Color(0xFF475569),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFloatingButton(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;
    return GestureDetector(
      onTap: () => onTap(2),
      child: Container(
        height: 56,
        width: 56,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [primaryColor.withOpacity(0.9), primaryColor],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: primaryColor.withOpacity(0.3),
              offset: const Offset(0, 8),
              blurRadius: 16,
            ),
          ],
          border: Border.all(color: Colors.white, width: 3),
        ),
        child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 26),
      ),
    );
  }
}
