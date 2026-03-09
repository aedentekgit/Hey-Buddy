import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

/// Central date/time formatting utility.
///
/// • [DateFormatter.formatDate] / [DateFormatter.formatTime] — pure, format
///   string passed in directly.
/// • [DateFormatter.displayDate] / [DateFormatter.displayTime] — reads the
///   user's preference from [UserProvider] via BuildContext automatically.
/// • [DateFormatter.displayDateTime] — combines both.
class DateFormatter {
  // ─── Pure helpers (format passed explicitly) ───────────────────────────────

  static String formatTime(DateTime date, {String format = '12'}) {
    if (format == '24') {
      return DateFormat('HH:mm').format(date);
    }
    return DateFormat('hh:mm a').format(date);
  }

  static String formatDate(DateTime date, {String format = 'DD/MM/YYYY'}) {
    try {
      if (format == 'MM/DD/YYYY') {
        return DateFormat('MM/dd/yyyy').format(date);
      } else if (format == 'YYYY-MM-DD') {
        return DateFormat('yyyy-MM-dd').format(date);
      } else {
        return DateFormat('dd/MM/yyyy').format(date);
      }
    } catch (e) {
      return DateFormat('dd/MM/yyyy').format(date);
    }
  }

  // ─── String-based input helpers ───────────────────────────────────────────

  /// Format a raw ISO date string ("2026-03-15T...") using the given format.
  static String formatDateString(String? dateStr, {String format = 'DD/MM/YYYY'}) {
    if (dateStr == null || dateStr.isEmpty) return 'No date';
    try {
      final date = DateTime.parse(dateStr).toLocal();
      final today = DateTime.now();
      final d = DateTime(date.year, date.month, date.day);
      final t = DateTime(today.year, today.month, today.day);
      if (d == t) return 'Today';
      if (d == t.add(const Duration(days: 1))) return 'Tomorrow';
      if (d == t.subtract(const Duration(days: 1))) return 'Yesterday';
      return formatDate(date, format: format);
    } catch (_) {
      return dateStr;
    }
  }

  /// Format a time string ("15:00", "03:00 PM") using the given format.
  static String formatTimeString(String? timeStr, {String format = '12'}) {
    if (timeStr == null || timeStr.isEmpty) return 'All day';
    try {
      final t = timeStr.trim().toUpperCase();
      int hour;
      int minute;

      if (t.contains('AM') || t.contains('PM')) {
        final isPM = t.contains('PM');
        final clean = t.replaceAll('AM', '').replaceAll('PM', '').trim();
        final parts = clean.split(':');
        hour = int.parse(parts[0]);
        minute = parts.length > 1 ? int.parse(parts[1].substring(0, 2)) : 0;
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour == 12) hour = 0;
      } else if (t.contains(':')) {
        final parts = t.split(':');
        hour = int.parse(parts[0]);
        minute = int.parse(parts[1].substring(0, 2));
      } else {
        return timeStr;
      }

      final dt = DateTime(2000, 1, 1, hour, minute);
      return formatTime(dt, format: format);
    } catch (_) {
      return timeStr;
    }
  }

  // ─── Context-aware helpers (read UserProvider automatically) ──────────────

  /// Display a DateTime using the user's preferred date format.
  static String displayDate(BuildContext context, DateTime date) {
    final fmt = _dateFormat(context);
    return formatDate(date, format: fmt);
  }

  /// Display a raw ISO date string using the user's preferred date format.
  static String displayDateString(BuildContext context, String? dateStr) {
    final fmt = _dateFormat(context);
    return formatDateString(dateStr, format: fmt);
  }

  /// Display a time string using the user's preferred time format.
  static String displayTimeString(BuildContext context, String? timeStr) {
    final fmt = _timeFormat(context);
    return formatTimeString(timeStr, format: fmt);
  }

  /// Display both date and time using user preferences, e.g. "15/03/2026 • 05:30 PM"
  static String displayDateTime(BuildContext context, String? dateStr, String? timeStr) {
    final date = displayDateString(context, dateStr);
    final time = displayTimeString(context, timeStr);
    if (dateStr == null || dateStr.isEmpty) return time;
    if (timeStr == null || timeStr.isEmpty) return date;
    return '$date  •  $time';
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  static String _dateFormat(BuildContext context) {
    try {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      return user['dateFormat'] as String? ?? 'DD/MM/YYYY';
    } catch (_) {
      return 'DD/MM/YYYY';
    }
  }

  static String _timeFormat(BuildContext context) {
    try {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      return user['timeFormat'] as String? ?? '12';
    } catch (_) {
      return '12';
    }
  }
}
