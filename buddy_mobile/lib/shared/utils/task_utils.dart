
import 'package:intl/intl.dart';

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
}
