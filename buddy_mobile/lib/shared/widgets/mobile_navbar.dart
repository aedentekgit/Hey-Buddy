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
      height: 80,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, -4),
            blurRadius: 20,
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _buildNavItem(context, 0, LucideIcons.home, "Home"),
          _buildNavItem(context, 1, LucideIcons.listTodo, "Tasks"),
          _buildCenterItem(context),
          _buildNavItem(context, 3, LucideIcons.brain, "Memory"),
          _buildNavItem(context, 4, LucideIcons.settings, "Settings"),
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 24, color: color),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCenterItem(BuildContext context) {
    final primaryColor = Theme.of(context).primaryColor;
    return GestureDetector(
      onTap: () => onTap(2), // Buddy index
      child: Container(
        height: 60,
        width: 60,
        margin: const EdgeInsets.only(bottom: 20), // Floating effect
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [primaryColor.withOpacity(0.8), primaryColor], // Dynamic gradient
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          boxShadow: [
            BoxShadow(
              color: primaryColor.withOpacity(0.4),
              offset: const Offset(0, 8),
              blurRadius: 15,
            ),
          ],
          border: Border.all(color: Colors.white, width: 4),
        ),
        child: const Icon(LucideIcons.sparkles, color: Colors.white, size: 24),
      ),
    );
  }
}
