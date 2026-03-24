// ignore_for_file: deprecated_member_use, unused_field
import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/pressable.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';

class CalendarViewScreen extends StatefulWidget {
  const CalendarViewScreen({super.key});

  @override
  State<CalendarViewScreen> createState() => _CalendarViewScreenState();
}

class _CalendarViewScreenState extends State<CalendarViewScreen> {
  DateTime _currentMonth = DateTime.now();
  bool _isLoadingCounts = false;
  bool _isGridView = true;
  final Map<DateTime, GlobalKey> _dateKeys = {};

  @override
  void initState() {
    super.initState();
    _fetchCounts();
  }

  Future<void> _fetchCounts() async {
    setState(() => _isLoadingCounts = true);
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    
    final start = firstDay.toIso8601String().split('T')[0];
    final end = lastDay.toIso8601String().split('T')[0];

    final provider = Provider.of<TasksProvider>(context, listen: false);
    
    // Fetch full tasks for the month range to populate the list and grid
    await provider.loadTasks(silent: true, start: start, end: end);
    
    setState(() {
      _isLoadingCounts = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: _buildAppBar(),
      body: _isLoadingCounts
          ? Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _isGridView
              ? _buildGridView()
              : _buildAgendaView(),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return PreferredSize(
      preferredSize: const Size.fromHeight(80),
      child: SafeArea(
        bottom: false,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(36),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: AppColors.accent.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
            border: Border.all(
              color: AppColors.border.withValues(alpha: 0.8),
              width: 1,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Back Button
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    LucideIcons.arrowLeft,
                    size: 20,
                    color: AppColors.text,
                  ),
                ),
              ),

              // Title / Dropdown
              Theme(
                data: Theme.of(context).copyWith(
                  splashColor: Colors.transparent,
                  highlightColor: Colors.transparent,
                  scrollbarTheme: ScrollbarThemeData(
                    thickness: const WidgetStatePropertyAll(0.0),
                    thumbColor: const WidgetStatePropertyAll(Colors.transparent),
                    trackColor: const WidgetStatePropertyAll(Colors.transparent),
                    trackBorderColor: const WidgetStatePropertyAll(Colors.transparent),
                  ),
                ),
                child: PopupMenuButton<int>(
                  initialValue: _currentMonth.month,
                  constraints: const BoxConstraints(maxHeight: 256), // 5 items * 48 + 16 padding
                  offset: const Offset(0, 48),
                  color: AppColors.surface,
                  elevation: 8,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: BorderSide(color: AppColors.border),
                  ),
                  onSelected: (month) {
                    setState(() {
                      _currentMonth = DateTime(_currentMonth.year, month, 1);
                    });
                    _fetchCounts();
                  },
                  itemBuilder: (context) {
                    return List.generate(12, (index) {
                      int month = index + 1;
                      final isSelected = month == _currentMonth.month;
                      return PopupMenuItem<int>(
                        value: month,
                        child: Text(
                          _getMonthName(month),
                          style: GoogleFonts.nunito(
                            fontSize: 16,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? AppColors.accent : AppColors.text,
                          ),
                        ),
                      );
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: AppColors.accent.withValues(alpha: 0.15),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          _getMonthName(_currentMonth.month),
                          style: GoogleFonts.nunito(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(LucideIcons.chevronDown, color: AppColors.accent, size: 16),
                      ],
                    ),
                  ),
                ),
              ),

              // Toggle View Button
              GestureDetector(
                onTap: () => setState(() => _isGridView = !_isGridView),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.bg,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isGridView ? LucideIcons.list : LucideIcons.layoutGrid,
                    size: 18,
                    color: AppColors.text,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAgendaView() {
    final provider = Provider.of<TasksProvider>(context);
    
    // Group tasks by date
    final Map<DateTime, List<Map<String, dynamic>>> grouped = {};
    for (var t in provider.processedTasks) {
      final ds = t['date'] as String?;
      if (ds != null) {
        final d = DateTime.tryParse(ds);
        if (d != null) {
          final dateKey = DateTime(d.year, d.month, d.day);
          if (dateKey.month == _currentMonth.month && dateKey.year == _currentMonth.year) {
            grouped.putIfAbsent(dateKey, () => []).add(t);
          }
        }
      }
    }

    final sortedKeys = grouped.keys.toList()..sort();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${_getMonthName(_currentMonth.month)} ${_currentMonth.year}',
            style: GoogleFonts.nunito(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.teal,
            ),
          ),
          const SizedBox(height: 16),
          if (sortedKeys.isEmpty)
            Row(
              children: [
                Icon(LucideIcons.calendarX, color: AppColors.textMid, size: 20),
                const SizedBox(width: 12),
                Text(
                  'No events this month',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textMid,
                  ),
                ),
              ],
            )
          else
            ...sortedKeys.map((date) {
              final dayTasks = grouped[date]!;
              final key = _dateKeys.putIfAbsent(date, () => GlobalKey());
              return Padding(
                key: key,
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 44,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _getWeekdayAbbr(date.weekday),
                            style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textMid),
                          ),
                          Text(
                            '${date.day}',
                            style: GoogleFonts.nunito(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.text),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Column(
                        children: dayTasks.map((t) => _buildAgendaCard(t)).toList(),
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _buildAgendaCard(Map<String, dynamic> task) {
    final title = task['title'] ?? 'Untitled';
    final time = task['time'] ?? 'All day';
    
    // Using simple subtitle extraction logic if available
    final intent = task['intent'] ?? '';
    final email = task['contactEmail'] ?? 'User Email'; // or placeholder
    
    final Color taskColor = TaskUtils.getTaskColor(title, intent) as Color;
    
    return Pressable(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SmartDetailsScreen(task: task)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
          boxShadow: AppColors.cardShadow,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.nunito(
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          color: AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        email, // E.g. sabarishthavamani@gmail.com like in the screenshot
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: AppColors.textDim,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    color: taskColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.clock, size: 12, color: taskColor),
                      const SizedBox(width: 4),
                      Text(
                        time,
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: taskColor,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              title, // the footnote in screenshot repeats the title
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.inter(fontSize: 10, color: AppColors.textMid),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGridView() {
    final provider = Provider.of<TasksProvider>(context);
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;
    final firstDayWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday;
    
    // In Dart, Monday is 1, Sunday is 7. We want Mon-Sun layout (0-6 index where 0 is Mon)
    final offset = firstDayWeekday - 1; 

    // Group tasks by day number
    final Map<int, List<Map<String, dynamic>>> gridTasks = {};
    for (var t in provider.processedTasks) {
      final ds = t['date'] as String?;
      if (ds != null) {
        final d = DateTime.tryParse(ds);
        if (d != null && d.month == _currentMonth.month && d.year == _currentMonth.year) {
          gridTasks.putIfAbsent(d.day, () => []).add(t);
        }
      }
    }

    final days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // We can calculate exactly how many weeks we need (5 or 6 typically)
    final totalCells = offset + daysInMonth;
    final rowCount = (totalCells / 7).ceil();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${_getMonthName(_currentMonth.month)} ${_currentMonth.year}',
              style: GoogleFonts.nunito(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: AppColors.teal,
              ),
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: days.map((d) => Expanded(
            child: Center(
              child: Text(
                d,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMid,
                ),
              ),
            ),
          )).toList(),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: Container(
            color: AppColors.cardBorder, // Use the border color for grid lines
            child: GridView.builder(
              padding: EdgeInsets.zero,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: 1,
                crossAxisSpacing: 1,
                childAspectRatio: 0.65, // Taller cells for chips
              ),
              itemCount: rowCount * 7, // exact grid
              itemBuilder: (context, index) {
                if (index < offset || index >= offset + daysInMonth) {
                  return Container(color: AppColors.bg); // Empty cell
                }
                final day = index - offset + 1;
                final dayTasks = gridTasks[day] ?? [];
                
                final isToday = DateTime.now().year == _currentMonth.year &&
                    DateTime.now().month == _currentMonth.month &&
                    DateTime.now().day == day;

                return GestureDetector(
                  onTap: () async {
                    setState(() => _isGridView = false);
                    if (dayTasks.isEmpty) return;
                    await Future.delayed(const Duration(milliseconds: 100));
                    final dateKey = DateTime(_currentMonth.year, _currentMonth.month, day);
                    final key = _dateKeys[dateKey];
                    if (key != null && key.currentContext != null) {
                      Scrollable.ensureVisible(
                        key.currentContext!,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                        alignment: 0.1,
                      );
                    }
                  },
                  child: Container(
                  color: AppColors.surface,
                  padding: const EdgeInsets.all(4),
                  child: Column(
                    children: [
                      Container(
                        alignment: Alignment.center,
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: isToday ? AppColors.accent : Colors.transparent,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '$day',
                          style: GoogleFonts.nunito(
                            fontSize: 12,
                            fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                            color: isToday ? Colors.white : AppColors.text,
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Expanded(
                        child: ListView.builder(
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: dayTasks.take(3).length, // max 3 chips
                          itemBuilder: (ctx, i) {
                            final task = dayTasks[i];
                            final Color taskColor = TaskUtils.getTaskColor(
                                task['title']?.toString(),
                                task['intent']?.toString()) as Color;
                            return Container(
                              margin: const EdgeInsets.only(bottom: 2),
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              decoration: BoxDecoration(
                                color: taskColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                task['title'] ?? 'Event',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ));
              },
            ),
          ),
        ),
      ],
    );
  }

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  String _getWeekdayAbbr(int weekday) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[weekday - 1];
  }
}
