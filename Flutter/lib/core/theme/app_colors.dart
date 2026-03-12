import 'package:flutter/material.dart';

// Design token colours matching the JSX light design (buddy_ai_light.jsx)
class AppColors {
  static const Color bg          = Color(0xFFF5F7FA);
  static const Color surface     = Color(0xFFFFFFFF);
  static const Color cardBorder  = Color(0xFFE8ECF2);

  // Accent / blue
  static const Color accent      = Color(0xFF3B72F6);
  static const Color accentLight = Color(0x1A3B72F6); // ~10 %
  static const Color accentSoft  = Color(0x0F3B72F6); // ~6 %

  // Teal
  static const Color teal        = Color(0xFF0BBFA3);
  static const Color tealLight   = Color(0x1A0BBFA3);

  // Purple
  static const Color purple      = Color(0xFF7C3AED);
  static const Color purpleLight = Color(0x1A7C3AED);

  // Orange
  static const Color orange      = Color(0xFFF97316);
  static const Color orangeLight = Color(0x1AF97316);

  // Pink
  static const Color pink        = Color(0xFFEC4899);
  static const Color pinkLight   = Color(0x1AEC4899);

  // Green
  static const Color green       = Color(0xFF10B981);
  static const Color greenLight  = Color(0x1A10B981);

  // Text
  static const Color text        = Color(0xFF111827);
  static const Color textMid     = Color(0xFF6B7280);
  static const Color textDim     = Color(0xFF9CA3AF);

  // Misc
  static const Color border      = Color(0xFFE8ECF2);
  static const Color danger      = Color(0xFFEF4444);
  static const Color dangerLight = Color(0x14EF4444);

  // Header gradient
  static const LinearGradient headerGradient = LinearGradient(
    colors: [accent, purple],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // Card shadow
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: const Color(0x143C5078),
      blurRadius: 16,
      offset: const Offset(0, 2),
    ),
  ];
}
