import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/pressable.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';

class CalendarViewScreen extends StatefulWidget {
  const CalendarViewScreen({super.key});

  @override
  State<CalendarViewScreen> createState() => _CalendarViewScreenState();
}

class _CalendarViewScreenState extends State<CalendarViewScreen> {
  DateTime _currentMonth = DateTime.now();
  DateTime? _selectedDate;
  Map<String, dynamic> _dailyCounts = {};
  bool _isLoadingCounts = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _fetchCounts();
  }

  Future<void> _fetchCounts() async {
    setState(() => _isLoadingCounts = true);
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    
    final start = firstDay.toIso8601String().split('T')[0];
    final end = lastDay.toIso8601String().split('T')[0];

    final provider = Provider.of<TasksProvider>(context, listen: false);
    
    // 1. Fetch statistics (counts)
    final counts = await provider.getCalendarStats(start: start, end: end);
    
    // 2. Fetch full tasks for the month range to populate the list
    await provider.loadTasks(silent: true, start: start, end: end);
    
    setState(() {
      _dailyCounts = counts;
      _isLoadingCounts = false;
    });
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
    _fetchCounts();
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
    _fetchCounts();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildCalendarSection(),
          const Divider(height: 1, color: AppColors.border),
          Expanded(child: _buildRemindersList()),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.surface,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(LucideIcons.arrowLeft, color: AppColors.text),
        onPressed: () => Navigator.pop(context),
      ),
      title: Text(
        'Calendar',
        style: GoogleFonts.nunito(
          fontWeight: FontWeight.w900,
          color: AppColors.text,
          fontSize: 18,
        ),
      ),
      centerTitle: true,
    );
  }

  Widget _buildCalendarSection() {
    final monthName = _getMonthName(_currentMonth.month);
    final year = _currentMonth.year;

    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 20),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$monthName $year',
                style: GoogleFonts.nunito(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.text,
                ),
              ),
              Row(
                children: [
                  _NavBtn(icon: LucideIcons.chevronLeft, onTap: _prevMonth),
                  const SizedBox(width: 8),
                  _NavBtn(icon: LucideIcons.chevronRight, onTap: _nextMonth),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildDayHeaders(),
          const SizedBox(height: 10),
          _buildCalendarGrid(),
        ],
      ),
    );
  }

  Widget _buildDayHeaders() {
    final days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: days.map((d) => Text(
        d,
        style: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: AppColors.textDim,
        ),
      )).toList(),
    );
  }

  Widget _buildCalendarGrid() {
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday % 7;
    final daysInMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0).day;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        mainAxisSpacing: 8,
        crossAxisSpacing: 0,
      ),
      itemCount: firstDay + daysInMonth,
      itemBuilder: (context, index) {
        if (index < firstDay) return const SizedBox();
        final day = index - firstDay + 1;
        final date = DateTime(_currentMonth.year, _currentMonth.month, day);
        final dateStr = date.toIso8601String().split('T')[0];
        final count = _dailyCounts[dateStr] ?? 0;
        final isSelected = _selectedDate?.year == date.year &&
            _selectedDate?.month == date.month &&
            _selectedDate?.day == date.day;
        final isToday = DateTime.now().year == date.year &&
            DateTime.now().month == date.month &&
            DateTime.now().day == date.day;

        return Pressable(
          onTap: () => setState(() => _selectedDate = date),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                  border: isToday && !isSelected
                      ? Border.all(color: AppColors.accent, width: 1.5)
                      : null,
                ),
                child: Center(
                  child: Text(
                    '$day',
                    style: GoogleFonts.nunito(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isSelected
                          ? Colors.white
                          : isToday
                              ? AppColors.accent
                              : AppColors.text,
                    ),
                  ),
                ),
              ),
              if (count > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    '+$count',
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: isSelected ? AppColors.accent : AppColors.teal,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildRemindersList() {
    if (_selectedDate == null) return const SizedBox();

    return Consumer<TasksProvider>(
      builder: (context, provider, _) {
        final selectedDateStr = _selectedDate?.toIso8601String().split('T')[0];
        
        final tasks = provider.processedTasks.where((t) {
          final dStr = t['date'] as String?;
          if (dStr == null || selectedDateStr == null) return false;
          
          // Compare YYYY-MM-DD strings exactly
          // Backend date is usually stored/returned as ISO string or YYYY-MM-DD
          final taskDate = dStr.split('T')[0];
          return taskDate == selectedDateStr;
        }).toList();

        if (tasks.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.calendarX, size: 48, color: AppColors.textDim.withOpacity(0.3)),
                const SizedBox(height: 12),
                Text(
                  'No reminders for this day',
                  style: GoogleFonts.nunito(
                    color: AppColors.textDim,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(18),
          itemCount: tasks.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) => _ReminderCard(task: tasks[index]),
        );
      },
    );
  }

  String _getMonthName(int month) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }
}

class _NavBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _NavBtn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Pressable(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: AppColors.bg,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.border),
        ),
        child: Icon(icon, size: 16, color: AppColors.text),
      ),
    );
  }
}

class _ReminderCard extends StatelessWidget {
  final Map<String, dynamic> task;
  const _ReminderCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final color = _getIntentColor(task['intent']);
    return Pressable(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SmartDetailsScreen(task: task)),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: AppColors.cardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_getIntentIcon(task['intent']), color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task['title'] ?? 'Untitled',
                    style: GoogleFonts.nunito(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppColors.text,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    task['time'] ?? '--:--',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.textDim,
                    ),
                  ),
                ],
              ),
            ),
            Icon(LucideIcons.chevronRight, size: 16, color: AppColors.textDim.withOpacity(0.5)),
          ],
        ),
      ),
    );
  }

  Color _getIntentColor(String? intent) {
    switch (intent?.toLowerCase()) {
      case 'meeting': return AppColors.accent;
      case 'medicine': return AppColors.teal;
      case 'pickup': return AppColors.orange;
      case 'bill': return AppColors.pink;
      default: return AppColors.accent;
    }
  }

  IconData _getIntentIcon(String? intent) {
    switch (intent?.toLowerCase()) {
      case 'meeting': return LucideIcons.video;
      case 'medicine': return LucideIcons.pill;
      case 'pickup': return LucideIcons.truck;
      case 'bill': return LucideIcons.creditCard;
      default: return LucideIcons.bell;
    }
  }
}
