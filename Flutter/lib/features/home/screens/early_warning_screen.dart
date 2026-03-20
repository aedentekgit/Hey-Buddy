// ignore_for_file: curly_braces_in_flow_control_structures, unused_local_variable
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';
import 'package:buddy_mobile/features/home/screens/location_reminder_create_screen.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/home/widgets/quick_actions_grid.dart';

class EarlyWarningScreen extends StatefulWidget {
  final Map<String, dynamic> reminder;
  const EarlyWarningScreen({super.key, required this.reminder});

  @override
  State<EarlyWarningScreen> createState() => _EarlyWarningScreenState();
}

class _EarlyWarningScreenState extends State<EarlyWarningScreen> {
  bool _earlyWarningSubscribed = true;
  bool _trafficAwareEnabled = true;
  bool _itemExitGuardsEnabled = true;
  bool _notifyEmail = true;
  double _bufferMinutes = 15.0;
  String _warningLevel = 'medium';
  bool _notifyPhone = true;
  bool _notifyFamily = false;
  bool _notifyEmergency = false;
  late String _priority;
  late String _status;

  @override
  void initState() {
    super.initState();
    final r = widget.reminder;
    _bufferMinutes = (r['bufferTime'] ?? 15).toDouble();
    _warningLevel = r['warningLevel'] ?? 'medium';
    _priority = r['priority'] ?? 'medium';
    _status = r['status'] ?? 'pending';
    _notifyPhone = r['notifyPhone'] ?? true;
    _notifyFamily = r['notifyFamily'] ?? false;
    _notifyEmergency = r['notifyEmergency'] ?? false;
    _notifyEmail = r['notifyEmail'] ?? true;
    _earlyWarningSubscribed = r['earlyWarningSet'] ?? true;
    _trafficAwareEnabled = r['trafficAware'] ?? true;
    _itemExitGuardsEnabled = r['itemExitGuards'] ?? true;
  }

  String get _adjustedTime {
    final rawTime = widget.reminder['time'] ?? '';
    if (rawTime.isEmpty) return 'Whenever I arrive';
    try {
      final parts = rawTime.split(':');
      int hour = int.parse(parts[0].trim());
      final minSecPart = parts[1].trim();
      final minStr = minSecPart.substring(0, 2);
      final suffix = minSecPart.length > 2
          ? minSecPart.substring(2).trim()
          : '';
      int minute = int.parse(minStr);
      int totalMin = (hour * 60 + minute) - _bufferMinutes.toInt();
      if (suffix.toUpperCase() == 'PM' && hour != 12) totalMin += 12 * 60;
      if (suffix.toUpperCase() == 'AM' && hour == 12) totalMin -= 12 * 60;
      if (totalMin < 0) totalMin += 24 * 60;
      final adjHour = (totalMin ~/ 60) % 24;
      final adjMin = totalMin % 60;
      return DateFormatter.displayTimeString(
        context,
        '${adjHour.toString().padLeft(2, '0')}:${adjMin.toString().padLeft(2, '0')}',
      );
    } catch (_) {
      return rawTime;
    }
  }

  @override
  Widget build(BuildContext context) {
    final reminder = widget.reminder;
    final title = reminder['title'] ?? 'Reminder';
    final location = reminder['location'] ?? 'No Location';
    final date = DateFormatter.displayDateString(context, reminder['date']);
    final timeStr = reminder['time'];
    final time = (timeStr != null && timeStr.toString().isNotEmpty)
        ? DateFormatter.displayTimeString(context, timeStr.toString())
        : 'Whenever I arrive';
    final isCompleted =
        (reminder['status'] ?? '').toString().toLowerCase() == 'completed';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          // ── Header ────────────────────────────────────────────────────
          Container(
            color: AppColors.surface,
            child: SafeArea(
              bottom: false,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(
                          LucideIcons.arrowLeft,
                          size: 18,
                          color: AppColors.text,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Smart Details',
                            style: GoogleFonts.nunito(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                            ),
                          ),
                          Text(
                            'Location-based reminder',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.textMid,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Delete button
                    GestureDetector(
                      onTap: _onDelete,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.dangerLight,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.25),
                          ),
                        ),
                        child: const Icon(
                          LucideIcons.trash2,
                          size: 16,
                          color: AppColors.danger,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Edit button
                    GestureDetector(
                      onTap: _onEditReminder,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 7,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.accentLight,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(
                            color: AppColors.accent.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              LucideIcons.pencil,
                              size: 13,
                              color: AppColors.accent,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              'Edit',
                              style: GoogleFonts.nunito(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accent,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Body ───────────────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status badge + title
                  _StatusChip(
                    label: _status == 'completed'
                        ? 'Completed'
                        : (_status == 'snoozed'
                            ? 'Snoozed'
                            : (_status == 'pending'
                                ? 'Pending'
                                : (_status == 'risk_alert'
                                    ? 'Risk Alert'
                                    : 'On Track'))),
                    status: _status,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    title,
                    style: GoogleFonts.nunito(
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Meta info card
                  _InfoCard(
                    children: [
                      _InfoRow(
                        icon: LucideIcons.mapPin,
                        iconColor: AppColors.accent,
                        label: 'Location',
                        value: location,
                        badge: 'GPS',
                      ),
                      Container(height: 1, color: AppColors.border),
                      _InfoRow(
                        icon: LucideIcons.clock,
                        iconColor: AppColors.teal,
                        label: 'Schedule',
                        value: 'Time: $time  •  $date',
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  QuickActionsGrid(
                    actions: [
                      QuickActionItem(
                        label: 'Complete',
                        icon: LucideIcons.checkCircle2,
                        color: AppColors.green,
                        isSelected: _status == 'completed',
                        onTap: _handleComplete,
                      ),
                      QuickActionItem(
                        label: 'Snooze',
                        icon: LucideIcons.alarmClock,
                        color: AppColors.orange,
                        isSelected: _status == 'snoozed',
                        onTap: _handleSnooze,
                      ),
                      if (widget.reminder['isOverdue'] == true)
                        QuickActionItem(
                          label: 'Pending',
                          icon: LucideIcons.clock,
                          color: AppColors.danger,
                          isSelected: _status == 'pending',
                          onTap: _handlePending,
                        )
                      else
                        QuickActionItem(
                          label: 'Reschedule',
                          icon: LucideIcons.clock,
                          color: AppColors.accent,
                          onTap: _handleReschedule,
                        ),
                      QuickActionItem(
                        label: 'Priority',
                        icon: LucideIcons.flag,
                        color: _priority == 'high'
                            ? AppColors.danger
                            : (_priority == 'medium'
                                ? AppColors.orange
                                : AppColors.textMid),
                        isSelected: _priority != 'low',
                        onTap: _handlePriority,
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Smart Features
                  _SectionCard(
                    icon: LucideIcons.zap,
                    title: 'Smart Features',
                    children: [
                      _FeatureRow(
                        icon: LucideIcons.shieldAlert,
                        iconColor: AppColors.accent,
                        label: 'Early Warning System',
                        sub: 'Get alerts when at risk of being late',
                        tag: 'AI',
                        tagColor: AppColors.accent,
                        value: _earlyWarningSubscribed,
                        onChanged: (v) {
                          setState(() => _earlyWarningSubscribed = v);
                          _onSave(silent: true);
                          final msg =
                              "Early Warning System turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                      ),
                      _FeatureRow(
                        icon: LucideIcons.car,
                        iconColor: AppColors.teal,
                        label: 'Traffic-Aware ETA',
                        sub: 'Adjust times based on real-time traffic',
                        tag: 'LIVE',
                        tagColor: AppColors.teal,
                        value: _trafficAwareEnabled,
                        onChanged: (v) {
                          setState(() => _trafficAwareEnabled = v);
                          _onSave(silent: true);
                          final msg =
                              "Traffic-Aware ETA turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                      ),
                      _FeatureRow(
                        icon: LucideIcons.smartphone,
                        iconColor: AppColors.purple,
                        label: 'Item Exit Guards',
                        sub: 'Get reminded about items when leaving',
                        tag: 'NEW',
                        tagColor: AppColors.purple,
                        value: _itemExitGuardsEnabled,
                        onChanged: (v) {
                          setState(() => _itemExitGuardsEnabled = v);
                          _onSave(silent: true);
                          final msg =
                              "Item Exit Guards turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                        isLast: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Alert Preferences
                  _SectionCard(
                    icon: LucideIcons.bellRing,
                    title: 'Alert Preferences',
                    children: [
                      _AlertRow(
                        icon: LucideIcons.bell,
                        iconColor: AppColors.orange,
                        label: 'Push Notifications',
                        sub: 'Receive alerts on your device',
                        value: _notifyPhone,
                        onChanged: (v) {
                          setState(() => _notifyPhone = v);
                          _onSave(silent: true);
                          final msg =
                              "Push Notifications turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                      ),
                      _AlertRow(
                        icon: LucideIcons.mail,
                        iconColor: AppColors.teal,
                        label: 'Email Alerts',
                        sub: 'Detailed reports via email',
                        value: _notifyEmail,
                        onChanged: (v) {
                          setState(() => _notifyEmail = v);
                          _onSave(silent: true);
                          final msg = "Email Alerts turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                      ),
                      _AlertRow(
                        icon: LucideIcons.users,
                        iconColor: AppColors.pink,
                        label: 'Family Notifications',
                        sub: 'Notify household members',
                        value: _notifyFamily,
                        onChanged: (v) {
                          setState(() => _notifyFamily = v);
                          _onSave(silent: true);
                          final msg =
                              "Family Notifications turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                      ),
                      _AlertRow(
                        icon: LucideIcons.shieldAlert,
                        iconColor: AppColors.danger,
                        label: 'Emergency Alerts',
                        sub: 'Alert emergency contacts',
                        value: _notifyEmergency,
                        onChanged: (v) {
                          setState(() => _notifyEmergency = v);
                          _onSave(silent: true);
                          final msg =
                              "Emergency Alerts turned ${v ? 'ON' : 'OFF'}";
                          if (v) {
                            ToastUtils.showSuccessToast(msg);
                          } else {
                            ToastUtils.showErrorToast(msg);
                          }
                        },
                        isLast: true,
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Time & Buffer
                  _SectionCard(
                    icon: LucideIcons.clock,
                    title: 'Time & Buffer Config',
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Safety Buffer Time',
                            style: GoogleFonts.nunito(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppColors.text,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.accentLight,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppColors.accent.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Text(
                              '${_bufferMinutes.toInt()} min',
                              style: GoogleFonts.nunito(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accent,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          activeTrackColor: AppColors.accent,
                          inactiveTrackColor: AppColors.border,
                          thumbColor: AppColors.accent,
                          overlayColor: AppColors.accent.withValues(alpha: 0.12),
                          trackHeight: 4,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 8,
                          ),
                        ),
                        child: Slider(
                          value: _bufferMinutes,
                          min: 5,
                          max: 120,
                          divisions: 23,
                          onChanged: (v) {
                            setState(() => _bufferMinutes = v);
                            _onSave(silent: true);
                          },
                        ),
                      ),
                      Text(
                        'Add extra time before your reminder to ensure you\'re never late.',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.textMid,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 14),
                      // Adjusted notification box
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.accentLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: AppColors.accent.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: AppColors.accent.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(13),
                              ),
                              child: Icon(
                                LucideIcons.bell,
                                size: 20,
                                color: AppColors.accent,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'ADJUSTED NOTIFICATION',
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.accent,
                                    letterSpacing: 0.8,
                                  ),
                                ),
                                Text(
                                  _adjustedTime,
                                  style: GoogleFonts.nunito(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: AppColors.text,
                                  ),
                                ),
                                Text(
                                  'Calculated: Time − (Traffic + Buffer)',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: AppColors.textMid,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _onEditReminder() async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => LocationReminderCreateScreen(reminder: widget.reminder),
      ),
    );
    if (updated == true && mounted) Navigator.pop(context);
  }

  Future<void> _handleComplete() async {
    final oldStatus = _status;
    final targetStatus = oldStatus == 'completed' ? 'on_track' : 'completed';
    setState(() => _status = targetStatus);

    final id = widget.reminder['_id'];
    final success = await context
        .read<LocationRemindersProvider>()
        .updateReminder(id, {'status': targetStatus});

    if (!success && mounted) {
      setState(() => _status = oldStatus);
      ToastUtils.showErrorToast("Failed to update status (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'completed' 
          ? "Reminder marked as completed" 
          : "Reminder returned to on track";
      ToastUtils.showSuccessToast(msg);
    }
  }

  Future<void> _handlePending() async {
    final oldStatus = _status;
    final targetStatus = oldStatus == 'pending' ? 'on_track' : 'pending';
    setState(() => _status = targetStatus);

    final id = widget.reminder['_id'];
    final success = await context
        .read<LocationRemindersProvider>()
        .updateReminder(id, {'status': targetStatus});

    if (!success && mounted) {
      setState(() => _status = oldStatus);
      ToastUtils.showErrorToast("Failed to update status (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'pending' 
          ? "Reminder marked as pending" 
          : "Reminder returned to on track";
      ToastUtils.showSuccessToast(msg);
    }
  }

  Future<void> _handleSnooze() async {
    final oldStatus = _status;
    final targetStatus = oldStatus == 'snoozed' ? 'on_track' : 'snoozed';
    setState(() => _status = targetStatus);

    final id = widget.reminder['_id'];
    final rawTime = widget.reminder['time'] ?? '12:00 PM';
    final snoozed = _snoozeTime(rawTime, 30);
    
    final updateData = {'status': targetStatus};
    if (targetStatus == 'snoozed') {
      updateData['time'] = snoozed;
    }

    final success = await context
        .read<LocationRemindersProvider>()
        .updateReminder(id, updateData);

    if (!success && mounted) {
      setState(() => _status = oldStatus);
      ToastUtils.showErrorToast("Failed to update snooze (Server Busy)");
    } else if (mounted) {
      final msg = targetStatus == 'snoozed'
          ? "Snoozed for 30 minutes ($snoozed)"
          : "Snooze removed";
      ToastUtils.showSuccessToast(msg);
    }
  }

  String _snoozeTime(String timeStr, int minutes) {
    try {
      DateTime baseTime;
      if (timeStr.isEmpty || timeStr == 'Whenever I arrive') {
        baseTime = DateTime.now();
      } else {
        final parts = timeStr.split(':');
        int hour = int.parse(parts[0]);
        final rest = parts[1].trim();
        final minuteStr = rest.substring(0, 2);
        int minute = int.parse(minuteStr);
        bool isPM = timeStr.toUpperCase().contains('PM');
        bool isAM = timeStr.toUpperCase().contains('AM');

        if (isPM && hour < 12) hour += 12;
        if (isAM && hour == 12) hour = 0;
        baseTime = DateTime(2024, 1, 1, hour, minute);
      }

      DateTime dt = baseTime.add(Duration(minutes: minutes));

      int newHour = dt.hour;
      int newMinute = dt.minute;
      String suffix = newHour >= 12 ? 'PM' : 'AM';
      int displayHour = newHour > 12 ? newHour - 12 : (newHour == 0 ? 12 : newHour);

      return "${displayHour.toString().padLeft(2, '0')}:${newMinute.toString().padLeft(2, '0')} $suffix";
    } catch (_) {
      // Fallback if parsing completely fails for any other reason, just start from now
      final dt = DateTime.now().add(Duration(minutes: minutes));
      int newHour = dt.hour;
      int newMinute = dt.minute;
      String suffix = newHour >= 12 ? 'PM' : 'AM';
      int displayHour = newHour > 12 ? newHour - 12 : (newHour == 0 ? 12 : newHour);
      return "${displayHour.toString().padLeft(2, '0')}:${newMinute.toString().padLeft(2, '0')} $suffix";
    }
  }

  Future<void> _handlePriority() async {
    final current = _priority;
    String next = 'low';
    if (current == 'low') {
      next = 'medium';
    } else if (current == 'medium')
      next = 'high';
    else
      next = 'low';

    final oldPriority = _priority;
    setState(() => _priority = next);

    final id = widget.reminder['_id'];
    final success = await context
        .read<LocationRemindersProvider>()
        .updateReminder(id, {'priority': next});

    if (!success && mounted) {
      setState(() => _priority = oldPriority);
      ToastUtils.showErrorToast("Failed to update priority (Server Busy)");
    } else if (mounted) {
      ToastUtils.showSuccessToast("Priority updated to ${next.toUpperCase()}");
    }
  }

  Future<void> _handleReschedule() async {
    _onEditReminder();
  }

  Future<void> _onDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.dangerLight,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  LucideIcons.trash2,
                  size: 22,
                  color: AppColors.danger,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Delete Reminder',
                style: GoogleFonts.nunito(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Are you sure you want to delete this reminder? This cannot be undone.',
                style: GoogleFonts.inter(
                  fontSize: 13.5,
                  color: AppColors.textMid,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context, false),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          'Cancel',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMid,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context, true),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.dangerLight,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppColors.danger.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Text(
                          'Delete',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: AppColors.danger,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (confirm == true && mounted) {
      final id = widget.reminder['_id'];
      final success = await context
          .read<LocationRemindersProvider>()
          .deleteReminder(id);
      if (mounted) {
        if (success) {
          Navigator.pop(context);
        }
      }
    }
  }

  Future<void> _onSave({bool silent = false}) async {
    final id = widget.reminder['_id'];
    await context.read<LocationRemindersProvider>().setEarlyWarning(id, {
      'bufferTime': _bufferMinutes.toInt(),
      'warningLevel': _warningLevel,
      'notifyPhone': _notifyPhone,
      'notifyFamily': _notifyFamily,
      'notifyEmergency': _notifyEmergency,
      'notifyEmail': _notifyEmail,
      'earlyWarningSet': _earlyWarningSubscribed,
      'trafficAware': _trafficAwareEnabled,
      'itemExitGuards': _itemExitGuardsEnabled,
    });
    if (!silent && mounted) Navigator.pop(context);
  }
}

// ── Shared widgets ──────────────────────────────────────────────────────────

class _StatusChip extends StatelessWidget {
  final String status;
  final String label;
  const _StatusChip({required this.status, required this.label});

  @override
  Widget build(BuildContext context) {
    Color color = AppColors.orange;
    if (status == 'completed' || label == 'On Track') {
      color = AppColors.green;
    } else if (status == 'pending' || status == 'risk_alert') {
      color = AppColors.danger;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String value;
  final String? badge;

  const _InfoRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.value,
    this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: iconColor.withValues(alpha: 0.18)),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDim,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: GoogleFonts.nunito(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.text,
                  ),
                ),
              ],
            ),
          ),
          if (badge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: AppColors.accentLight,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    LucideIcons.navigation,
                    size: 10,
                    color: AppColors.accent,
                  ),
                  const SizedBox(width: 3),
                  Text(
                    badge!,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.accent,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final List<Widget> children;
  const _SectionCard({
    required this.icon,
    required this.title,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.bg,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(15),
              ),
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Icon(icon, size: 14, color: AppColors.textDim),
                const SizedBox(width: 7),
                Text(
                  title.toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDim,
                    letterSpacing: 0.7,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String sub;
  final String tag;
  final Color tagColor;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isLast;

  const _FeatureRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.sub,
    required this.tag,
    required this.tagColor,
    required this.value,
    required this.onChanged,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: iconColor.withValues(alpha: 0.2)),
                ),
                child: Icon(icon, size: 17, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          label,
                          style: GoogleFonts.nunito(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: tagColor,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            tag,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 8,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Text(
                      sub,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.textMid,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              _Toggle(value: value, onChanged: onChanged),
            ],
          ),
        ),
        if (!isLast) Container(height: 1, color: AppColors.border),
      ],
    );
  }
}

class _AlertRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String sub;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isLast;

  const _AlertRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.sub,
    required this.value,
    required this.onChanged,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: iconColor.withValues(alpha: 0.2)),
                ),
                child: Icon(icon, size: 17, color: iconColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    Text(
                      sub,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: AppColors.textMid,
                      ),
                    ),
                  ],
                ),
              ),
              _Toggle(value: value, onChanged: onChanged),
            ],
          ),
        ),
        if (!isLast) Container(height: 1, color: AppColors.border),
      ],
    );
  }
}

class _Toggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _Toggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 25,
        decoration: BoxDecoration(
          color: value ? AppColors.accent : const Color(0xFFD1D5DB),
          borderRadius: BorderRadius.circular(13),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 2.5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.15),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
