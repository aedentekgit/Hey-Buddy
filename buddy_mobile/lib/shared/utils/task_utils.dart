import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

class TaskUtils {
  static String formatDate(String? dateStr, {String format = 'DD/MM/YYYY'}) {
    if (dateStr == null) return 'No date';
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final d = DateTime(date.year, date.month, date.day);

      final diff = d.difference(today).inDays;
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Tomorrow';
      if (diff == -1) return 'Yesterday';
      
      // Simple format conversion if needed or use intl
      return DateFormat('dd/MM/yyyy').format(date);
    } catch (e) {
      return dateStr;
    }
  }

  static DateTime? parseTime(DateTime baseDate, String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return null;
    try {
      timeStr = timeStr.trim().toUpperCase();
      int hour = 0;
      int minute = 0;

      if (timeStr.contains('AM') || timeStr.contains('PM')) {
        final isPM = timeStr.contains('PM');
        final cleanTime = timeStr.replaceAll('AM', '').replaceAll('PM', '').trim();
        final parts = cleanTime.split(':');
        hour = int.parse(parts[0]);
        if (parts.length > 1) minute = int.parse(parts[1]);
        
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour == 12) hour = 0;
      } else if (timeStr.contains(':')) {
        final parts = timeStr.split(':');
        hour = int.parse(parts[0]);
        minute = int.parse(parts[1]);
      } else {
        hour = int.parse(timeStr);
      }
      
      return DateTime(baseDate.year, baseDate.month, baseDate.day, hour, minute);
    } catch (e) {
      return null;
    }
  }

  static dynamic getTaskIcon(String? title, String? intent) {
    // Priority 1: Intent based
    if (intent != null) {
      switch (intent.toLowerCase()) {
        case 'work': return LucideIcons.briefcase;
        case 'health': return LucideIcons.heartPulse;
        case 'fitness': return LucideIcons.dumbbell;
        case 'personal': return LucideIcons.user;
        case 'education': return LucideIcons.book;
        case 'travel': return LucideIcons.plane;
        case 'shopping': return LucideIcons.shoppingBag;
        case 'finance': return LucideIcons.banknote;
      }
    }

    // Priority 2: Keyword based on title
    if (title != null) {
      final t = title.toLowerCase();
      if (t.contains('gym') || t.contains('workout') || t.contains('exercise')) return LucideIcons.dumbbell;
      if (t.contains('school') || t.contains('class') || t.contains('study') || t.contains('college')) return LucideIcons.book;
      if (t.contains('shop') || t.contains('buy') || t.contains('grocery')) return LucideIcons.shoppingCart;
      if (t.contains('work') || t.contains('office') || t.contains('meeting')) return LucideIcons.briefcase;
      if (t.contains('doctor') || t.contains('health') || t.contains('medicine') || t.contains('dentist')) return LucideIcons.activity;
      if (t.contains('food') || t.contains('dinner') || t.contains('lunch') || t.contains('eat')) return LucideIcons.utensils;
      if (t.contains('bank') || t.contains('pay') || t.contains('bill') || t.contains('money')) return LucideIcons.creditCard;
      if (t.contains('call') || t.contains('phone')) return LucideIcons.phone;
    }

    return LucideIcons.bell; // Default
  }
}
