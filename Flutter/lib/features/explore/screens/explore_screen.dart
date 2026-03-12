import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/location_reminders_screen.dart';
import 'package:buddy_mobile/features/explore/screens/family_hub_screen.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';

class ExploreScreen extends StatefulWidget {
  final VoidCallback? onMemoryTap;
  final VoidCallback? onReminderTap;

  const ExploreScreen({
    super.key,
    this.onMemoryTap,
    this.onReminderTap,
  });

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      Provider.of<MemoriesProvider>(context, listen: false)
          .loadMemories(silent: true);
      Provider.of<TasksProvider>(context, listen: false)
          .loadTasks(silent: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    final String userName = (user['name'] as String? ?? 'Alex Johnson');

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Hero greeting card ───────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _HeroCard(userName: userName),
            ),
            const SizedBox(height: 22),

            // ── Quick Actions ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _SectionLabel('Quick Actions'),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _QuickActionsGrid(
                onMemoryTap: widget.onMemoryTap ?? () {},
                onReminderTap: widget.onReminderTap ?? () {},
                onLocationTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const LocationRemindersScreen())),
                onFamilyTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => const FamilyHubScreen())),
              ),
            ),
            const SizedBox(height: 22),

            // ── Memory Cloud ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _SectionLabel('Memory Cloud'),
                  GestureDetector(
                    onTap: widget.onMemoryTap,
                    child: Text(
                      'View all →',
                      style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accent),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            // Marquee is now FULL WIDTH
            _MemoryMarquee(onTap: widget.onMemoryTap),
            const SizedBox(height: 22),

            // ── Today's Reminders ────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _SectionLabel("Today's Reminders"),
                  GestureDetector(
                    onTap: widget.onReminderTap,
                    child: Text(
                      'All tasks →',
                      style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: AppColors.accent),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _TodayReminders(onReminderTap: widget.onReminderTap),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hero card ──────────────────────────────────────────────────────────────
class _HeroCard extends StatelessWidget {
  final String userName;
  const _HeroCard({required this.userName});

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 20),
      decoration: BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Stack(
        fit: StackFit.passthrough,
        children: [
          // Decorative circles
          Positioned(
            top: -20, right: -20,
            child: Container(
              width: 100, height: 100,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x14FFFFFF),
              ),
            ),
          ),
          Positioned(
            bottom: -30, right: 30,
            child: Container(
              width: 80, height: 80,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0x0FFFFFFF),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _greeting,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white.withOpacity(0.75),
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                userName,
                style: GoogleFonts.nunito(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons.sun,
                        size: 16, color: Colors.white),
                    const SizedBox(width: 8),
                    Text(
                      'Mumbai · 29°C, Partly cloudy',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Quick Actions 2×2 grid ─────────────────────────────────────────────────
class _QuickActionsGrid extends StatelessWidget {
  final VoidCallback onMemoryTap;
  final VoidCallback onReminderTap;
  final VoidCallback onLocationTap;
  final VoidCallback onFamilyTap;

  const _QuickActionsGrid({
    required this.onMemoryTap,
    required this.onReminderTap,
    required this.onLocationTap,
    required this.onFamilyTap,
  });

  @override
  Widget build(BuildContext context) {
    final actions = [
      _Action('Memory', LucideIcons.brain, AppColors.accent, 'Store anything',
          onMemoryTap),
      _Action('Reminder', LucideIcons.bell, AppColors.teal, 'Set a task',
          onReminderTap),
      _Action('Location Reminder', LucideIcons.mapPin, AppColors.orange, 'Geo-trigger',
          onLocationTap),
      _Action(
          'Family', LucideIcons.users, AppColors.pink, '3 members online',
          onFamilyTap),
    ];

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.5,
      children: actions.map((a) => _ActionCard(action: a)).toList(),
    );
  }
}

class _Action {
  final String label;
  final IconData icon;
  final Color color;
  final String sub;
  final VoidCallback onTap;
  const _Action(this.label, this.icon, this.color, this.sub, this.onTap);
}

class _ActionCard extends StatelessWidget {
  final _Action action;
  const _ActionCard({required this.action});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: action.onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: AppColors.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: action.color.withOpacity(0.14),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: action.color.withOpacity(0.2)),
              ),
              child: Icon(action.icon, size: 19, color: action.color),
            ),
            const Spacer(),
            Text(
              action.label,
              style: GoogleFonts.nunito(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.text),
            ),
            const SizedBox(height: 2),
            Text(
              action.sub,
              style: GoogleFonts.inter(
                  fontSize: 11, color: AppColors.textMid),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Memory marquee ─────────────────────────────────────────────────────────
class _MemoryMarquee extends StatelessWidget {
  final VoidCallback? onTap;
  const _MemoryMarquee({this.onTap});

  @override
  Widget build(BuildContext context) {
    return Consumer<MemoriesProvider>(
      builder: (context, provider, _) {
        final titles = provider.memories
            .map((m) => (m['content'] as String? ?? 'Memory')
                .split('\n')
                .first
                .trim())
            .toList();

        if (titles.isEmpty) {
          titles.addAll([
            'Paris 2023',
            'Mom\'s Birthday',
            'Meeting Notes',
            'Recipe Ideas',
            'Flight PNR',
            'Dr. Mehta',
            'Office WiFi',
            'Car Service',
            'Gym Routine',
            'Book List',
            'Anniversary',
            'Home Insurance',
          ]);
        }

        return SizedBox(
          height: 38,
          child: _MarqueeRow(items: titles, onTap: onTap),
        );
      },
    );
  }
}

class _MarqueeRow extends StatefulWidget {
  final List<String> items;
  final VoidCallback? onTap;
  const _MarqueeRow({required this.items, this.onTap});

  @override
  State<_MarqueeRow> createState() => _MarqueeRowState();
}

class _MarqueeRowState extends State<_MarqueeRow> {
  late final ScrollController _ctrl;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _ctrl = ScrollController(initialScrollOffset: 2000);
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _start());
  }

  void _start() {
    _timer = Timer.periodic(const Duration(milliseconds: 16), (_) {
      if (_ctrl.hasClients) {
        final next = _ctrl.offset + 0.5;
        if (next >= _ctrl.position.maxScrollExtent) {
          _ctrl.jumpTo(0);
        } else {
          _ctrl.jumpTo(next);
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final repeated = [...widget.items, ...widget.items, ...widget.items];
    return ListView.builder(
      controller: _ctrl,
      scrollDirection: Axis.horizontal,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: repeated.length,
      itemBuilder: (_, i) {
        final label = repeated[i % repeated.length];
        return GestureDetector(
          onTap: widget.onTap,
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 6,
                    offset: const Offset(0, 1))
              ],
            ),
            child: Text(
              label,
              style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textMid),
              maxLines: 1,
            ),
          ),
        );
      },
    );
  }
}

// ── Today's reminders ──────────────────────────────────────────────────────
class _TodayReminders extends StatelessWidget {
  final VoidCallback? onReminderTap;
  const _TodayReminders({this.onReminderTap});

  @override
  Widget build(BuildContext context) {
    return Consumer<TasksProvider>(
      builder: (context, provider, _) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final today = provider.processedTasks
            .where((t) => TaskUtils.formatDate(t['date']) == 'Today')
            .toList();

        if (today.isEmpty) {
          return _EmptyReminders();
        }

        return Column(
          children: today
              .map((t) => _ReminderCard(task: t))
              .toList(),
        );
      },
    );
  }
}

class _EmptyReminders extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
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
            'No reminders today',
            style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.text),
          ),
          const SizedBox(height: 4),
          Text(
            'Tap + to add a new reminder',
            style: GoogleFonts.inter(
                fontSize: 13, color: AppColors.textMid),
          ),
        ],
      ),
    );
  }
}

class _ReminderCard extends StatelessWidget {
  final Map<String, dynamic> task;
  const _ReminderCard({required this.task});

  @override
  Widget build(BuildContext context) {
    final title = task['title'] as String? ?? 'Untitled';
    final bool isOverdue = task['_isOverdue'] as bool? ?? false;
    final intent = task['intent'];
    // Keep original color even if overdue — no red color change
    final Color color = TaskUtils.getTaskColor(title, intent) is Color
        ? TaskUtils.getTaskColor(title, intent) as Color
        : AppColors.green;
    final icon = TaskUtils.getTaskIcon(title, intent);
    final String timeStr =
        DateFormatter.displayTimeString(context, task['time'] as String?);
    final String? location = task['location'] as String?;
    final String? etaLabel = task['_etaLabel'] as String?;

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(builder: (_) => SmartDetailsScreen(task: task)),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 9),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: AppColors.cardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left color stripe
                Container(
                  width: 4,
                  color: color,
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 13, 15, 13),
                    child: Row(
                      children: [
                        // Icon
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(13),
                            border: Border.all(color: color.withOpacity(0.2)),
                          ),
                          child: Icon(icon, color: color, size: 20),
                        ),
                        const SizedBox(width: 12),
                        // Content
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                title,
                                style: GoogleFonts.nunito(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: isOverdue
                                        ? AppColors.textDim
                                        : AppColors.text,
                                    decoration: isOverdue
                                        ? TextDecoration.lineThrough
                                        : null,
                                    decorationColor: AppColors.textDim),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Row(
                                children: [
                                  Icon(LucideIcons.clock,
                                      size: 12, color: AppColors.textDim),
                                  const SizedBox(width: 4),
                                  Text(
                                    timeStr,
                                    style: GoogleFonts.inter(
                                        fontSize: 11, color: AppColors.textMid),
                                  ),
                                ],
                              ),
                              if (location != null &&
                                  location.isNotEmpty &&
                                  location != 'No Location') ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(LucideIcons.mapPin,
                                        size: 10, color: color),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        location,
                                        style: GoogleFonts.inter(
                                            fontSize: 10.5,
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
                                              color:
                                                  AppColors.accent.withOpacity(0.2)),
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
                            ],
                          ),
                        ),
                        // Tag chip
                        _Chip(
                          label: intent?.toString() ?? 'Task',
                          color: color,
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
}

// ── Shared helpers ─────────────────────────────────────────────────────────
class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.nunito(
          fontSize: 15,
          fontWeight: FontWeight.w800,
          color: AppColors.text),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final bool small;
  const _Chip({required this.label, required this.color, this.small = false});

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
