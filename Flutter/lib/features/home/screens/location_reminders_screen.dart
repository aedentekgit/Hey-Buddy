import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/shared/widgets/mobile_task_card.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/features/home/screens/location_reminder_create_screen.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';
import 'package:flutter_slidable/flutter_slidable.dart';
import 'package:flutter/cupertino.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class LocationRemindersScreen extends StatefulWidget {
  const LocationRemindersScreen({super.key});

  @override
  State<LocationRemindersScreen> createState() =>
      _LocationRemindersScreenState();
}

class _LocationRemindersScreenState extends State<LocationRemindersScreen> {
  String _activeFilter = 'All';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';
  DateTime? _tempSnoozeTime;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LocationRemindersProvider>().loadReminders();
    });
    _searchCtrl.addListener(
      () => setState(() => _searchQuery = _searchCtrl.text.toLowerCase()),
    );
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<String> _buildFilters(List reminders) {
    final statusSet = <String>{};
    for (final r in reminders) {
      final s = (r['status'] ?? '').toString().toLowerCase();
      if (s == 'completed')
        statusSet.add('Completed');
      else if (s == 'risk_alert')
        statusSet.add('Risk Alert');
      else
        statusSet.add('Active');
    }
    final sorted = statusSet.toList()..sort();
    return ['All', ...sorted];
  }

  List _applyFilters(List reminders) {
    var list = reminders;
    if (_activeFilter != 'All') {
      list = list.where((r) {
        final s = (r['status'] ?? '').toString().toLowerCase();
        if (_activeFilter == 'Completed') return s == 'completed';
        if (_activeFilter == 'Risk Alert') return s == 'risk_alert';
        return s != 'completed' && s != 'risk_alert'; // Active
      }).toList();
    }
    if (_searchQuery.isNotEmpty) {
      list = list
          .where(
            (r) =>
                (r['title'] ?? '').toString().toLowerCase().contains(
                  _searchQuery,
                ) ||
                (r['location'] ?? '').toString().toLowerCase().contains(
                  _searchQuery,
                ),
          )
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<LocationRemindersProvider>(context);
    final filters = _buildFilters(provider.reminders);
    if (!filters.contains(_activeFilter)) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => setState(() => _activeFilter = 'All'),
      );
    }
    final filtered = _applyFilters(provider.reminders);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(125),
        child: Container(
          color: AppColors.surface,
          child: SafeArea(
            bottom: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Search row
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.maybePop(context),
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
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.bg,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: AppColors.border,
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                LucideIcons.search,
                                size: 16,
                                color: AppColors.textDim,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: _searchCtrl,
                                  style: GoogleFonts.inter(
                                    fontSize: 13.5,
                                    color: AppColors.text,
                                  ),
                                  decoration: InputDecoration.collapsed(
                                    hintText: 'Search location reminders…',
                                    hintStyle: GoogleFonts.inter(
                                      fontSize: 13.5,
                                      color: AppColors.textDim,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Dynamic filter chips
                const SizedBox(height: 10),
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    itemCount: filters.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 7),
                    itemBuilder: (_, i) {
                      final f = filters[i];
                      final active = f == _activeFilter;
                      return GestureDetector(
                        onTap: () => setState(() => _activeFilter = f),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: active ? AppColors.accent : AppColors.bg,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: active
                                  ? AppColors.accent
                                  : AppColors.border,
                              width: 1.5,
                            ),
                          ),
                          child: Text(
                            f,
                            style: GoogleFonts.nunito(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: active ? Colors.white : AppColors.textMid,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
                const Divider(height: 1, color: AppColors.border),
              ],
            ),
          ),
        ),
      ),
      body: provider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : filtered.isEmpty
          ? RefreshIndicator(
              onRefresh: provider.loadReminders,
              child: ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                  _buildEmptyState(),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: provider.loadReminders,
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final reminder = Map<String, dynamic>.from(filtered[index]);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Slidable(
                      key: ValueKey(reminder['_id']),
                      startActionPane: ActionPane(
                        motion: const BehindMotion(),
                        extentRatio: 0.6,
                        children: [
                          _SlidableAction(
                            label: 'Edit',
                            icon: LucideIcons.pencil,
                            color: AppColors.accent,
                            onTap: () => _handleEdit(reminder),
                          ),
                          _SlidableAction(
                            label: 'Snooze',
                            icon: LucideIcons.alarmClock,
                            color: AppColors.orange,
                            onTap: () => _handleSnooze(reminder),
                          ),
                          _SlidableAction(
                            label: 'Done',
                            icon: LucideIcons.checkCircle2,
                            color: AppColors.green,
                            onTap: () => _handleComplete(reminder),
                          ),
                        ],
                      ),
                      endActionPane: ActionPane(
                        motion: const BehindMotion(),
                        extentRatio: 0.25,
                        children: [
                          _SlidableAction(
                            label: 'Delete',
                            icon: LucideIcons.trash2,
                            color: AppColors.danger,
                            onTap: () => _handleDelete(reminder),
                          ),
                        ],
                      ),
                      child: _buildLocationReminderCard(reminder, index),
                    ),
                  );
                },
              ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.mapPin,
              size: 36,
              color: Color(0xFF94A3B8),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No Location Reminders',
            style: GoogleFonts.outfit(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Location-based reminders will appear here',
            style: GoogleFonts.outfit(
              fontSize: 14,
              color: const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLocationReminderCard(Map<String, dynamic> reminder, int index) {
    final String status = (reminder['status'] ?? '').toString().toLowerCase();
    final bool isDanger = status == 'risk_alert';

    // Status text mapping
    String statusText = 'ON TRACK';
    if (isDanger) {
      statusText = 'Risk Alert';
    } else if (status == 'completed') {
      statusText = 'COMPLETED';
    }

    return MobileTaskCard(
      title: reminder['title'] ?? 'Untitled',
      status: statusText,
      variant: isDanger
          ? 'danger'
          : (status == 'completed' ? 'green' : 'orange'),
      date: DateFormatter.displayDateString(context, reminder['date']),
      time: reminder['time'] != null
          ? DateFormatter.displayTimeString(context, reminder['time'])
          : 'Whenever I arrive',
      location: reminder['location'] ?? 'No Location',
      onView: () => _onViewReminder(reminder),
      onShare: () => _onFamilyBackup(reminder),
      earlyWarningActive: reminder['earlyWarningSet'] ?? false,
      isHighPriority: reminder['priority'] == 'high',
    );
  }

  void _handleEdit(Map<String, dynamic> reminder) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LocationReminderCreateScreen(reminder: reminder),
      ),
    );
  }

  Future<void> _handleComplete(Map<String, dynamic> reminder) async {
    final provider = context.read<LocationRemindersProvider>();
    final success = await provider.updateReminder(reminder['_id'], {
      'status': 'completed',
    });
    if (success) ToastUtils.showSuccessToast("Marked as completed");
  }

  Future<void> _handleDelete(Map<String, dynamic> reminder) async {
    final confirmed = await showCupertinoDialog<bool>(
      context: context,
      builder:
          (context) => CupertinoAlertDialog(
            title: const Text('Delete Reminder?'),
            content: const Text(
              'Are you sure you want to delete this reminder? This action cannot be undone.',
            ),
            actions: [
              CupertinoDialogAction(
                child: const Text('Cancel'),
                onPressed: () => Navigator.pop(context, false),
              ),
              CupertinoDialogAction(
                isDestructiveAction: true,
                child: const Text('Delete'),
                onPressed: () => Navigator.pop(context, true),
              ),
            ],
          ),
    );

    if (confirmed == true && mounted) {
      final provider = context.read<LocationRemindersProvider>();
      final success = await provider.deleteReminder(reminder['_id']);
      if (success && mounted) ToastUtils.showSuccessToast("Reminder deleted");
    }
  }

  Future<void> _handleSnooze(Map<String, dynamic> reminder) async {
    final int? picked = await _showSnoozeSelection(
      reminder['status'] == 'snoozed',
    );
    if (picked == null) return;

    String targetStatus = 'snoozed';
    String snoozedTime = "";
    final originalTime = reminder['time'] ?? "";

    if (picked == -1) {
      targetStatus = 'on_track';
      snoozedTime = originalTime;
    } else if (picked == -3 && _tempSnoozeTime != null) {
      snoozedTime = _formatTimeOfDay(TimeOfDay.fromDateTime(_tempSnoozeTime!));
      _tempSnoozeTime = null;
    } else {
      snoozedTime = _snoozeTime(originalTime, picked);
    }

    if (mounted) {
      final success = await context.read<LocationRemindersProvider>().updateReminder(
        reminder['_id'],
        {'status': targetStatus, 'time': snoozedTime},
      );

      if (success && mounted) {
        ToastUtils.showSuccessToast(
          targetStatus == 'snoozed'
              ? "Snoozed until $snoozedTime"
              : "Snooze removed",
        );
      }
    }
  }

  String _formatTimeOfDay(TimeOfDay tod) {
    final hour = tod.hourOfPeriod == 0 ? 12 : tod.hourOfPeriod;
    final min = tod.minute.toString().padLeft(2, '0');
    final period = tod.period == DayPeriod.am ? 'AM' : 'PM';
    return "${hour.toString().padLeft(2, '0')}:$min $period";
  }

  String _snoozeTime(String timeStr, int minutes) {
    try {
      final parts = timeStr.split(':');
      int hour = int.parse(parts[0]);
      final rest = parts[1].trim();
      final minuteStr = rest.substring(0, 2);
      int minute = int.parse(minuteStr);
      bool isPM = timeStr.toUpperCase().contains('PM');
      bool isAM = timeStr.toUpperCase().contains('AM');

      if (isPM && hour < 12) hour += 12;
      if (isAM && hour == 12) hour = 0;

      DateTime dt = DateTime(2024, 1, 1, hour, minute).add(
        Duration(minutes: minutes),
      );

      int newHour = dt.hour;
      int newMinute = dt.minute;
      String suffix = newHour >= 12 ? 'PM' : 'AM';
      int displayHour =
          newHour > 12 ? newHour - 12 : (newHour == 0 ? 12 : newHour);

      return "${displayHour.toString().padLeft(2, '0')}:${newMinute.toString().padLeft(2, '0')} $suffix";
    } catch (_) {
      return timeStr;
    }
  }

  Future<int?> _showSnoozeSelection(bool currentlySnoozed) async {
    DateTime tempTime = DateTime.now();
    bool showingCustom = false;

    return await showModalBottomSheet<int>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder:
          (context) => StatefulBuilder(
            builder:
                (context, setSheetState) => Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(32),
                    ),
                  ),
                  padding: EdgeInsets.fromLTRB(
                    20,
                    16,
                    20,
                    MediaQuery.of(context).padding.bottom + 10,
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const SizedBox(width: 48),
                            Container(
                              width: 40,
                              height: 4,
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(
                                LucideIcons.x,
                                size: 20,
                                color: AppColors.textMid,
                              ),
                              onPressed: () => Navigator.pop(context),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          showingCustom ? 'Custom Snooze' : 'Snooze Reminder',
                          style: GoogleFonts.nunito(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: AppColors.text,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (!showingCustom) ...[
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            crossAxisSpacing: 16,
                            mainAxisSpacing: 16,
                            childAspectRatio: 1.8,
                            children: [
                              _buildSnoozeOption(
                                15,
                                '15 Min',
                                LucideIcons.alarmClock,
                                context,
                              ),
                              _buildSnoozeOption(
                                30,
                                '30 Min',
                                LucideIcons.alarmClock,
                                context,
                              ),
                              _buildSnoozeOption(
                                60,
                                '1 Hour',
                                LucideIcons.hourglass,
                                context,
                              ),
                              _buildSnoozeOption(
                                120,
                                '2 Hours',
                                LucideIcons.timer,
                                context,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          GestureDetector(
                            onTap:
                                () => setSheetState(() => showingCustom = true),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                vertical: 18,
                                horizontal: 24,
                              ),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [
                                    AppColors.accent,
                                    Color(0xFF6366F1),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: const Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Row(
                                    children: [
                                      Icon(
                                        LucideIcons.calendarClock,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                      SizedBox(width: 12),
                                      Text(
                                        'Set Custom Time',
                                        style: TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Icon(
                                    LucideIcons.chevronRight,
                                    color: Colors.white70,
                                    size: 18,
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ] else ...[
                          SizedBox(
                            height: 200,
                            child: CupertinoDatePicker(
                              mode: CupertinoDatePickerMode.time,
                              initialDateTime: DateTime.now().add(
                                const Duration(minutes: 5),
                              ),
                              onDateTimeChanged: (DateTime dt) => tempTime = dt,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Expanded(
                                child: TextButton(
                                  onPressed:
                                      () => setSheetState(
                                        () => showingCustom = false,
                                      ),
                                  child: Text(
                                    'Back',
                                    style: GoogleFonts.nunito(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.textMid,
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => Navigator.pop(context, -3),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.accent,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    child: Text(
                                      'Confirm',
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.nunito(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                        if (currentlySnoozed && !showingCustom) ...[
                          const SizedBox(height: 24),
                          GestureDetector(
                            onTap: () => Navigator.pop(context, -1),
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppColors.danger.withValues(alpha: 0.2),
                                ),
                              ),
                              child: Center(
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      LucideIcons.alarmClockOff,
                                      color: AppColors.danger,
                                      size: 18,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      'TURN OFF SNOOZE',
                                      style: GoogleFonts.nunito(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w900,
                                        color: AppColors.danger,
                                        letterSpacing: 1.1,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
          ),
    ).then((val) {
      if (val == -3) {
        _tempSnoozeTime = tempTime;
      }
      return val;
    });
  }

  Widget _buildSnoozeOption(
    int mins,
    String label,
    IconData icon,
    BuildContext context,
  ) {
    return GestureDetector(
      onTap: () => Navigator.pop(context, mins),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: AppColors.accent, size: 24),
            const SizedBox(height: 6),
            Text(
              label,
              style: GoogleFonts.nunito(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _onViewReminder(Map<String, dynamic> reminder) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => SmartDetailsScreen(task: reminder),
      ),
    );
  }

  Future<void> _onFamilyBackup(Map<String, dynamic> reminder) async {
    final success = await context
        .read<LocationRemindersProvider>()
        .setFamilyBackup(reminder['_id']);
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Family Backup activated for "${reminder['title']}"'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF2563EB),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to activate Family Backup'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Color(0xFFEF4444),
          ),
        );
      }
    }
  }
}

class _SlidableAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _SlidableAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: GestureDetector(
          onTap: () {
            Slidable.of(context)?.close();
            onTap();
          },
          child: Container(
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: Colors.white, size: 22),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: GoogleFonts.nunito(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
