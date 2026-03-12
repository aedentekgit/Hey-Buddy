import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/reminder_create_screen.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/shared/widgets/pressable.dart';

class ReminderListScreen extends StatefulWidget {
  const ReminderListScreen({super.key});

  @override
  State<ReminderListScreen> createState() => _ReminderListScreenState();
}

class _ReminderListScreenState extends State<ReminderListScreen> {
  String _activeFilter = 'All';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';
  DateTime? _selectedDate; // null = show all (default: current+upcoming)

  List<String> _buildFilters(List<Map<String, dynamic>> tasks) {
    final intentSet = <String>{};
    for (final t in tasks) {
      final intent = t['intent'] as String?;
      if (intent != null && intent.trim().isNotEmpty) {
        // Replace underscores with spaces and title-case each word
        final words = intent.trim().toLowerCase().split(RegExp(r'[_\s]+'));
        final formatted = words
            .map((w) => w.isEmpty ? '' : w[0].toUpperCase() + w.substring(1))
            .join(' ');
        if (formatted.isNotEmpty) intentSet.add(formatted);
      }
    }
    final sorted = intentSet.toList()..sort();
    return ['All', 'Today', ...sorted];
  }

  @override
  void initState() {
    super.initState();
    Future.microtask(
        () => Provider.of<TasksProvider>(context, listen: false).loadTasks());
    _searchCtrl.addListener(
        () => setState(() => _searchQuery = _searchCtrl.text.toLowerCase()));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _apply(List<Map<String, dynamic>> tasks) {
    var list = tasks;
    // Date picker filter takes priority
    if (_selectedDate != null) {
      final d = _selectedDate!;
      list = list.where((t) {
        final raw = t['date'] as String?;
        if (raw == null) return false;
        try {
          final td = DateTime.parse(raw);
          return td.year == d.year && td.month == d.month && td.day == d.day;
        } catch (_) { return false; }
      }).toList();
    } else if (_activeFilter == 'Today') {
      list = list
          .where((t) => TaskUtils.formatDate(t['date']) == 'Today')
          .toList();
    } else if (_activeFilter != 'All') {
      list = list
          .where((t) =>
              (t['intent'] as String? ?? '')
                  .toLowerCase()
                  .replaceAll('_', ' ')
                  .contains(_activeFilter.toLowerCase()))
          .toList();
    }
    if (_searchQuery.isNotEmpty) {
      list = list
          .where((t) =>
              (t['title'] as String? ?? '')
                  .toLowerCase()
                  .contains(_searchQuery))
          .toList();
    }
    return list;
  }

  /// Opens the calendar bottom sheet.
  void _openDatePicker(List<Map<String, dynamic>> allTasks) {
    // Build a set of dates that have reminders
    final dotDates = <String>{};
    for (final t in allTasks) {
      final raw = t['date'] as String?;
      if (raw != null) {
        try {
          final d = DateTime.parse(raw);
          dotDates.add('${d.year}-${d.month}-${d.day}');
        } catch (_) {}
      }
    }
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _CalendarSheet(
        selected: _selectedDate,
        dotDates: dotDates,
        onSelect: (date) {
          setState(() {
            _selectedDate = date;
            _activeFilter = 'All';
          });
          Navigator.pop(context);
        },
        onClear: () {
          setState(() => _selectedDate = null);
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<TasksProvider>(context);
    final allTasks = provider.processedTasks;
    final filters = _buildFilters(allTasks);
    if (!filters.contains(_activeFilter)) {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => setState(() => _activeFilter = 'All'));
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      // ── search + filter header ──────────────────────────────────
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
                  padding:
                      const EdgeInsets.fromLTRB(18, 12, 18, 0),
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
                          child: const Icon(LucideIcons.arrowLeft,
                              size: 18, color: AppColors.text),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.bg,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: AppColors.border, width: 1.5),
                          ),
                          child: Row(
                            children: [
                              const Icon(LucideIcons.search,
                                  size: 16, color: AppColors.textDim),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextField(
                                  controller: _searchCtrl,
                                  style: GoogleFonts.inter(
                                      fontSize: 13.5,
                                      color: AppColors.text),
                                  decoration: InputDecoration.collapsed(
                                    hintText: 'Search reminders…',
                                    hintStyle: GoogleFonts.inter(
                                        fontSize: 13.5,
                                        color: AppColors.textDim),
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
                    itemCount: filters.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(width: 7),
                    itemBuilder: (_, i) {
                      // First item = Date picker chip
                      if (i == 0) {
                        final dateActive = _selectedDate != null;
                        return GestureDetector(
                          onTap: () => _openDatePicker(allTasks),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: dateActive
                                  ? AppColors.accent
                                  : AppColors.bg,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: dateActive
                                    ? AppColors.accent
                                    : AppColors.border,
                                width: 1.5,
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  LucideIcons.calendarDays,
                                  size: 13,
                                  color: dateActive
                                      ? Colors.white
                                      : AppColors.textMid,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  dateActive
                                      ? '${_selectedDate!.day}/${_selectedDate!.month}'
                                      : 'Date',
                                  style: GoogleFonts.nunito(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: dateActive
                                        ? Colors.white
                                        : AppColors.textMid,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }
                      final f = filters[i - 1];
                      final active = f == _activeFilter && _selectedDate == null;
                      return GestureDetector(
                        onTap: () => setState(() {
                          _activeFilter = f;
                          _selectedDate = null;
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: active
                                ? AppColors.accent
                                : AppColors.bg,
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
                              color: active
                                  ? Colors.white
                                  : AppColors.textMid,
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
      body: Builder(builder: (context) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

          final filtered = _apply(allTasks);

          if (filtered.isEmpty) {
            return _buildEmpty();
          }

          // Group by date bucket
          final now = DateTime.now();
          final todayDate = DateTime(now.year, now.month, now.day);
          final tomorrowDate = todayDate.add(const Duration(days: 1));

          DateTime? _parseDate(Map<String, dynamic> t) {
            final raw = t['date'] as String?;
            if (raw == null) return null;
            try {
              final d = DateTime.parse(raw);
              return DateTime(d.year, d.month, d.day);
            } catch (_) { return null; }
          }

          final today = filtered
              .where((t) => TaskUtils.formatDate(t['date']) == 'Today')
              .toList();
          final tomorrow = filtered
              .where((t) => TaskUtils.formatDate(t['date']) == 'Tomorrow')
              .toList();
          final upcoming = filtered.where((t) {
            final d = _parseDate(t);
            return d != null && d.isAfter(tomorrowDate);
          }).toList();
          final past = filtered.where((t) {
            final d = _parseDate(t);
            return d != null && d.isBefore(todayDate);
          }).toList();

          return RefreshIndicator(
            onRefresh: () => provider.loadTasks(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
              children: [
                if (today.isNotEmpty) ...[
                  _GroupLabel('Today', count: today.length),
                  ...today.map((t) => _buildCard(context, t, provider)),
                  const SizedBox(height: 12),
                ],
                if (tomorrow.isNotEmpty) ...[
                  _GroupLabel('Tomorrow', count: tomorrow.length),
                  ...tomorrow.map((t) => _buildCard(context, t, provider)),
                  const SizedBox(height: 12),
                ],
                if (upcoming.isNotEmpty) ...[
                  _GroupLabel('Upcoming', count: upcoming.length),
                  ...upcoming.map((t) => _buildCard(context, t, provider)),
                  const SizedBox(height: 12),
                ],
                if (past.isNotEmpty) ...[
                  _GroupLabel('Past', count: past.length),
                  ...past.map((t) => _buildCard(context, t, provider, isPast: true)),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCard(
      BuildContext context,
      Map<String, dynamic> task,
      TasksProvider provider,
      {bool isPast = false}) {
    final title = task['title'] as String? ?? 'Untitled';
    final intent = task['intent'];

    // Compute real-time overdue: past date OR (today + time already passed)
    bool shouldStrike = isPast;
    if (!isPast) {
      try {
        final rawDate = task['date'] as String?;
        final rawTime = task['time'] as String?;
        if (rawDate != null) {
          final d = DateTime.parse(rawDate);
          final now = DateTime.now();
          final todayMidnight =
              DateTime(now.year, now.month, now.day);
          final itemDate = DateTime(d.year, d.month, d.day);
          if (itemDate.isBefore(todayMidnight)) {
            shouldStrike = true;
          } else if (itemDate == todayMidnight && rawTime != null) {
            final parts = rawTime.split(':');
            if (parts.length >= 2) {
              final h = int.tryParse(parts[0]) ?? 0;
              final m = int.tryParse(parts[1]) ?? 0;
              final reminderDt = DateTime(
                  now.year, now.month, now.day, h, m);
              if (now.isAfter(reminderDt)) shouldStrike = true;
            }
          }
        }
      } catch (_) {}
    }
    final Color color = isPast
        ? const Color(0xFFB0B7C3)
        : (TaskUtils.getTaskColor(title, intent) is Color
            ? TaskUtils.getTaskColor(title, intent) as Color
            : AppColors.green);
    final icon = TaskUtils.getTaskIcon(title, intent);
    final String timeStr =
        DateFormatter.displayTimeString(context, task['time'] as String?);
    final String dateStr =
        DateFormatter.displayDateString(context, task['date'] as String?);
    final String? location = task['location'] as String?;
    final String? etaLabel = task['_etaLabel'] as String?;
    final bool hasLocation = location != null &&
        location.isNotEmpty &&
        location != 'No Location';

    return Pressable(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => SmartDetailsScreen(task: task)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: AppColors.cardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left color stripe
                Container(width: 4, color: color),
                // Card content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Icon container
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                color.withOpacity(0.18),
                                color.withOpacity(0.08),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: color.withOpacity(0.25)),
                          ),
                          child: Icon(icon, color: color, size: 22),
                        ),
                        const SizedBox(width: 13),
                        // Content
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      title,
                                      style: GoogleFonts.nunito(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 14.5,
                                          color: shouldStrike
                                              ? AppColors.textDim
                                              : AppColors.text,
                                          decoration: shouldStrike
                                              ? TextDecoration.lineThrough
                                              : null,
                                          decorationColor: AppColors.textDim),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Icon(LucideIcons.chevronRight,
                                      size: 13, color: color),
                                ],
                              ),
                              const SizedBox(height: 3),
                              Row(
                                children: [
                                  Icon(LucideIcons.clock,
                                      size: 12, color: AppColors.textDim),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      '$timeStr · $dateStr',
                                      style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: shouldStrike
                                              ? AppColors.textDim
                                              : AppColors.textMid),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                              if (hasLocation) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(LucideIcons.mapPin,
                                        size: 12, color: AppColors.accent),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        location!,
                                        style: GoogleFonts.inter(
                                            fontSize: 11.5,
                                            color: AppColors.textMid),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    if (etaLabel != null) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: AppColors.accent.withOpacity(0.12),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(
                                              color: AppColors.accent.withOpacity(0.2)),
                                        ),
                                        child: Text(
                                          'ETA $etaLabel',
                                          style: GoogleFonts.inter(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.accent),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                              const SizedBox(height: 9),
                              Row(
                                children: [
                                  _Chip(
                                    label: intent?.toString() ?? 'Task',
                                    color: color,
                                    small: true,
                                  ),
                                ],
                              ),
                            ],
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
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.accentLight,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(LucideIcons.bell,
                size: 28, color: AppColors.accent),
          ),
          const SizedBox(height: 12),
          Text(
            'No reminders here',
            style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            'Tap + to add a new reminder',
            style:
                GoogleFonts.inter(fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }
}

class _GroupLabel extends StatelessWidget {
  final String text;
  final int count;
  const _GroupLabel(this.text, {this.count = 0});

  Color get _dotColor {
    if (text == 'Today') return AppColors.accent;
    if (text == 'Tomorrow') return AppColors.green;
    if (text == 'Past') return const Color(0xFFB0B7C3);
    return AppColors.orange;
  }

  Color get _badgeColor {
    if (text == 'Today') return AppColors.accent;
    if (text == 'Tomorrow') return AppColors.green;
    if (text == 'Past') return const Color(0xFFB0B7C3);
    return AppColors.orange;
  }

  String get _label {
    final now = DateTime.now();
    if (text == 'Today') {
      return 'Today, ${_monthName(now.month)} ${now.day}';
    }
    if (text == 'Tomorrow') {
      final tomorrow = now.add(const Duration(days: 1));
      return 'Tomorrow, ${_monthName(tomorrow.month)} ${tomorrow.day}';
    }
    if (text == 'Past') return 'Past & Completed';
    return text;
  }

  String _monthName(int m) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[m - 1];
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = _dotColor;
    final badgeColor = _badgeColor;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, top: 6),
      child: Row(
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            _label,
            style: GoogleFonts.nunito(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: AppColors.text,
            ),
          ),
          const Spacer(),
          if (count > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: badgeColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: badgeColor.withOpacity(0.25)),
              ),
              child: Text(
                text == 'Past' ? '$count completed' : '$count pending',
                style: GoogleFonts.nunito(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: badgeColor,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Calendar bottom sheet ────────────────────────────────────────────────────
class _CalendarSheet extends StatefulWidget {
  final DateTime? selected;
  final Set<String> dotDates;
  final ValueChanged<DateTime> onSelect;
  final VoidCallback onClear;

  const _CalendarSheet({
    required this.selected,
    required this.dotDates,
    required this.onSelect,
    required this.onClear,
  });

  @override
  State<_CalendarSheet> createState() => _CalendarSheetState();
}

class _CalendarSheetState extends State<_CalendarSheet> {
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    _month = DateTime(
      (widget.selected ?? DateTime.now()).year,
      (widget.selected ?? DateTime.now()).month,
    );
  }

  static const _weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  static const _months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];

  bool _hasDot(int day) {
    final key = '${_month.year}-${_month.month}-$day';
    return widget.dotDates.contains(key);
  }

  bool _isSelected(int day) {
    final s = widget.selected;
    if (s == null) return false;
    return s.year == _month.year && s.month == _month.month && s.day == day;
  }

  bool _isToday(int day) {
    final now = DateTime.now();
    return now.year == _month.year && now.month == _month.month && now.day == day;
  }

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(_month.year, _month.month, 1);
    final daysInMonth = DateUtils.getDaysInMonth(_month.year, _month.month);
    final startOffset = firstDay.weekday % 7; // Sunday=0

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Month header with gradient ───────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            decoration: const BoxDecoration(
              gradient: AppColors.headerGradient,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Row(
              children: [
                GestureDetector(
                  onTap: () => setState(() =>
                      _month = DateTime(_month.year, _month.month - 1)),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.chevronLeft,
                        color: Colors.white, size: 18),
                  ),
                ),
                Expanded(
                  child: Text(
                    '${_months[_month.month - 1]} ${_month.year}',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunito(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() =>
                      _month = DateTime(_month.year, _month.month + 1)),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(LucideIcons.chevronRight,
                        color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              children: [
                // ── Weekday headers ──────────────────────────────
                Row(
                  children: _weekdays
                      .map((d) => Expanded(
                            child: Text(
                              d,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textDim,
                              ),
                            ),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 8),

                // ── Day grid ──────────────────────────────────────
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 0,
                  ),
                  itemCount: startOffset + daysInMonth,
                  itemBuilder: (_, idx) {
                    if (idx < startOffset) return const SizedBox();
                    final day = idx - startOffset + 1;
                    final isToday = _isToday(day);
                    final isSel = _isSelected(day);
                    final hasDot = _hasDot(day);

                    return GestureDetector(
                      onTap: () => widget
                          .onSelect(DateTime(_month.year, _month.month, day)),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: isSel
                                  ? AppColors.accent
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              border: isToday && !isSel
                                  ? Border.all(
                                      color: AppColors.accent, width: 1.5)
                                  : null,
                            ),
                            child: Center(
                              child: Text(
                                '$day',
                                style: GoogleFonts.nunito(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: isSel
                                      ? Colors.white
                                      : isToday
                                          ? AppColors.accent
                                          : AppColors.text,
                                ),
                              ),
                            ),
                          ),
                          if (hasDot)
                            Container(
                              width: 4,
                              height: 4,
                              margin: const EdgeInsets.only(top: 2),
                              decoration: BoxDecoration(
                                color: isSel
                                    ? Colors.white
                                    : AppColors.accent,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),

          // ── Footer ───────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              children: [
                Text(
                  widget.selected == null
                      ? 'Showing all dates'
                      : 'Selected: ${widget.selected!.day} ${_months[widget.selected!.month - 1]} ${widget.selected!.year}',
                  style: GoogleFonts.inter(
                      fontSize: 13, color: AppColors.textMid),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: widget.onClear,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: AppColors.bg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Text(
                      'Clear',
                      style: GoogleFonts.nunito(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textMid,
                      ),
                    ),
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

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final bool small;
  const _Chip(
      {required this.label, required this.color, this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: small ? 8 : 11, vertical: small ? 2 : 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: small ? 10 : 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
