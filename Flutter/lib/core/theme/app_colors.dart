import 'package:flutter/material.dart';

// Design token colours matching the JSX light design (buddy_ai_light.jsx)
class AppColors {
  static Color bg = Color(0xFFF5F7FA);
  static Color surface = Color(0xFFFFFFFF);
  static Color cardBorder = Color(0xFFE8ECF2);

  // Accent / blue
  static const Color accent = Color(0xFF3B72F6);
  static const Color accentLight = Color(0x1A3B72F6); // ~10 %
  static const Color accentSoft = Color(0x0F3B72F6); // ~6 %

  // Teal
  static const Color teal = Color(0xFF0BBFA3);
  static const Color tealLight = Color(0x1A0BBFA3);

  // Purple
  static const Color purple = AppColors.accent;
  static const Color purpleLight = Color(0x1A7C3AED);

  // Orange
  static const Color orange = Color(0xFFF97316);
  static const Color orangeLight = Color(0x1AF97316);

  // Pink
  static const Color pink = Color(0xFFEC4899);
  static const Color pinkLight = Color(0x1AEC4899);

  // Green
  static const Color green = Color(0xFF10B981);
  static const Color greenLight = Color(0x1A10B981);

  // Text
  static Color text = Color(0xFF111827);
  static Color textMid = Color(0xFF6B7280);
  static Color textDim = Color(0xFF9CA3AF);

  // Misc
  static Color border = Color(0xFFE8ECF2);
  static const Color danger = Color(0xFFEF4444);
  static const Color dangerLight = Color(0x14EF4444);

  static LinearGradient headerGradient = LinearGradient(
    colors: [accent, purple],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  static List<BoxShadow> cardShadow = [
    const BoxShadow(
      color: Color(0x143C5078),
      blurRadius: 16,
      offset: Offset(0, 2),
    ),
  ];

  static void setDarkMode(bool isDark) {
    if (isDark) {
      bg = const Color(0xFF0B101E);             // Solid dark background to prevent route overlap glitch
      surface = const Color(0xFF1F2937);        // Dark gray surface
      cardBorder = const Color(0xFF374151);     // Subdued border
      
      text = const Color(0xFFF9FAFB);           // Almost white text
      textMid = const Color(0xFF9CA3AF);        // Mid gray text
      textDim = const Color(0xFF6B7280);        // Dim gray text
      
      border = const Color(0xFF374151);         // Border matching cardBorder
      cardShadow = [
        const BoxShadow(
          color: Color(0x20000000),             // Darker, heavier shadow for dark mode
          blurRadius: 16,
          offset: Offset(0, 4),
        )
      ];
    } else {
      bg = const Color(0xFFF5F7FA);
      surface = const Color(0xFFFFFFFF);
      cardBorder = const Color(0xFFE8ECF2);
      
      text = const Color(0xFF111827);
      textMid = const Color(0xFF6B7280);
      textDim = const Color(0xFF9CA3AF);
      
      border = const Color(0xFFE8ECF2);
      cardShadow = [
        const BoxShadow(
          color: Color(0x143C5078),
          blurRadius: 16,
          offset: Offset(0, 2),
        )
      ];
    }
  }
}
