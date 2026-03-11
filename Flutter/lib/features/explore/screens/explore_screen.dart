import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';

import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/memory_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/location_reminders_screen.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';
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

class _ExploreScreenState extends State<ExploreScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    // Load memories and tasks if not already loaded to show in "Explore More"
    Future.microtask(() {
      Provider.of<MemoriesProvider>(context, listen: false).loadMemories(silent: true);
      Provider.of<TasksProvider>(context, listen: false).loadTasks(silent: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for KeepAlive
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Engaging Content Section
            Text(
              'Engaging Content',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),

            // Grid of Cards
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 2.2,
              children: [
                _buildEngagingCard(
                  title: 'Memory',
                  icon: LucideIcons.brain,
                  bgColor: const Color(0xFFBAE6FD),
                  iconColor: const Color(0xFF0284C7),
                  onTap: widget.onMemoryTap ?? () {},
                ),
                _buildEngagingCard(
                  title: 'Reminder',
                  icon: LucideIcons.clock,
                  bgColor: const Color(0xFFFEE2E2),
                  iconColor: const Color(0xFFDC2626),
                  onTap: widget.onReminderTap ?? () {},
                ),
              ],
            ),

            const SizedBox(height: 20),

            // Location Reminders (right after Memory & Reminder cards)
            _buildLocationRemindersBanner(),

            const SizedBox(height: 28),

            // ── Explore More Section ─────────────────────────────────
            Text(
              'Explore More',
              style: GoogleFonts.outfit(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 14),

            Consumer<MemoriesProvider>(
              builder: (context, provider, child) {
                final List<Map<String, dynamic>> memories = provider.memories.map((m) {
                  String title = m['content'] ?? 'Memory';
                  if (m['type'] == 'prescription' && m['extractedData'] != null) {
                    title = 'Prescription Details';
                  }
                  return {
                    'title': title,
                    'icon': LucideIcons.brain,
                    'color': const Color(0xFF0284C7),
                    'task': null,
                    'memory': m,
                  };
                }).toList();

                if (memories.isEmpty) {
                  const placeholders = [
                    'My wifi password is...',
                    'I prefer my coffee black',
                    'Anniversary is on June 12th',
                    "Mom's favorite color is blue",
                    'Doctor appointment details',
                  ];
                  memories.addAll(placeholders.map((title) => {
                    'title': title,
                    'icon': LucideIcons.brain,
                    'color': const Color(0xFF0284C7),
                    'task': null,
                    'memory': null,
                  }));
                }

                final row1 = memories.reversed.toList();
                final row2 = memories;
                final row3 = [
                  ...memories.skip(memories.length ~/ 2),
                  ...memories.take(memories.length ~/ 2)
                ];

                return Column(
                  children: [
                    _buildMarqueeRow(row1, speed: 0.4, direction: 1),
                    const SizedBox(height: 12),
                    _buildMarqueeRow(row2, speed: 0.5, direction: -1),
                    const SizedBox(height: 12),
                    _buildMarqueeRow(row3, speed: 0.4, direction: 1),
                  ],
                );
              },
            ),

            const SizedBox(height: 28),

            // ── Today's Reminders Section ──────────────────────────────
            Text(
              "Today's Reminders",
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),
            _buildTodayReminders(),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildTodayReminders() {
    return Consumer<TasksProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        final todayTasks = provider.processedTasks.where((t) {
          final dateStr = t['date'];
          return dateStr != null && TaskUtils.formatDate(dateStr) == 'Today';
        }).toList();

        if (todayTasks.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 32),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                const Icon(LucideIcons.calendarCheck, size: 48, color: Color(0xFF94A3B8)),
                const SizedBox(height: 12),
                Text(
                  'No reminders for today',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          );
        }

        return Column(
          children: todayTasks.map((task) => _buildReminderItem(task)).toList(),
        );
      },
    );
  }

  Widget _buildReminderItem(Map<String, dynamic> task) {
    final title = task['title'] ?? 'Untitled';
    final bool isOverdue = task['_isOverdue'] ?? false;
    final intent = task['intent'];
    final bool isDanger = isOverdue;

    final dynamic fetchedColor = TaskUtils.getTaskColor(title, intent);
    final Color baseColor = isDanger
        ? const Color(0xFFE11D48)
        : (fetchedColor is Color && fetchedColor != const Color(0xFF64748B)
            ? fetchedColor
            : const Color(0xFF10B981));
    final headerIcon = TaskUtils.getTaskIcon(title, intent) as IconData;

    final Color bgColor = isDanger ? const Color(0xFFFFE4E6) : baseColor.withOpacity(0.06);
    final Color borderColor = isDanger ? const Color(0xFFFECDD3) : baseColor.withOpacity(0.2);
    final Color iconBgColor = isDanger ? const Color(0xFFFECDD3).withOpacity(0.5) : baseColor.withOpacity(0.12);
    final Color iconColor = isDanger ? const Color(0xFFE11D48) : baseColor;
    final String statusText = isDanger ? 'Risk Alert' : 'ON TRACK';

    return InkWell(
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (context) => SmartDetailsScreen(task: task)));
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor, width: 1.5),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: iconBgColor,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(headerIcon, size: 22, color: iconColor),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: const Color(0xFF1E293B),
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: (isDanger ? const Color(0xFFE11D48) : const Color(0xFF10B981)).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: (isDanger ? const Color(0xFFE11D48) : const Color(0xFF10B981)).withOpacity(0.3),
                          ),
                        ),
                        child: Text(
                          statusText,
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: isDanger ? const Color(0xFFE11D48) : const Color(0xFF10B981),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      if (isDanger) ...[
                        const SizedBox(width: 8),
                        const Text(
                          '!',
                          style: TextStyle(
                            color: Color(0xFFE11D48),
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            height: 1.0,
                          ),
                        ),
                      ],
                    ],
                  ),
                  Builder(
                    builder: (ctx) {
                      final rawTime = (task['time'] ?? '').toString();
                      final rawDate = (task['date'] ?? '').toString();
                      if (rawTime.isEmpty) return const SizedBox.shrink();
                      final displayedTime = DateFormatter.displayTimeString(ctx, rawTime);
                      final displayedDate = rawDate.isNotEmpty
                          ? DateFormatter.displayDateString(ctx, rawDate)
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Icon(LucideIcons.clock, size: 12, color: iconColor.withOpacity(0.75)),
                              const SizedBox(width: 4),
                              Text(
                                displayedDate.isNotEmpty
                                    ? '$displayedDate  •  $displayedTime'
                                    : displayedTime,
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: iconColor.withOpacity(0.8),
                                ),
                              ),
                            ],
                          ),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Icon(LucideIcons.chevronRight, size: 22, color: iconColor.withOpacity(0.7)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationRemindersBanner() {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => const LocationRemindersScreen(),
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF0EA5E9), Color(0xFF6366F1)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0EA5E9).withOpacity(0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(LucideIcons.mapPin, size: 24, color: Colors.white),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Location Reminders',
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'View reminders tied to specific places',
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      color: Colors.white.withOpacity(0.85),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight, color: Colors.white, size: 22),
          ],
        ),
      ),
    );
  }

  Widget _buildEngagingCard({
    required String title,
    required IconData icon,
    required Color bgColor,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF334155),
                  height: 1.2,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.8),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMarqueeRow(List<Map<String, dynamic>> items, {required double direction, double height = 44, double speed = 1.0}) {
    if (items.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: height + 8, // extra space for shadow
      child: _MarqueeLayout(
        // Use a much larger cycle for truly infinite feel
        items: List.generate(50, (index) => items).expand((i) => i).toList(), 
        direction: direction,
        speed: speed,
        child: (item) => _buildCloudChip(item),
      ),
    );
  }


  Widget _buildCloudChip(Map<String, dynamic> item) {
    return InkWell(
      onTap: () {
        if (item['task'] != null) {
          Navigator.push(context, MaterialPageRoute(builder: (context) => SmartDetailsScreen(task: item['task'])));
        } else if (item['memory'] != null) {
          Navigator.push(context, MaterialPageRoute(builder: (context) => MemoryDetailsScreen(item: item['memory'])));
        } else if (item['title'] != null) {
          // If it's a general suggestion, switch to Dialogue and send it
          final buddyProvider = Provider.of<BuddyProvider>(context, listen: false);
          
          buddyProvider.addMessage('user', item['title']);
          buddyProvider.sendMessage(item['title'], language: 'en-US');
          
          ScaffoldMessenger.of(context).showSnackBar(
             SnackBar(
               content: Text('Asking Buddy: "${item['title']}"...'),
               duration: const Duration(seconds: 2),
               behavior: SnackBarBehavior.floating,
             ),
          );
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        margin: const EdgeInsets.only(right: 12, bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
          border: Border.all(color: Colors.black.withOpacity(0.02)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(item['icon'], size: 16, color: item['color'] ?? const Color(0xFF64748B)),
            const SizedBox(width: 10),
            Text(
              item['title'],
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF334155),
              ),
            ),
          ],
        ),
      ),
    );
  }


}


class _MarqueeLayout extends StatefulWidget {
  final List<Map<String, dynamic>> items;
  final double direction; // 1 for visual right move, -1 for visual left move
  final double speed;
  final Widget Function(Map<String, dynamic>) child;

  const _MarqueeLayout({
    required this.items,
    required this.direction,
    this.speed = 1.0,
    required this.child,
  });

  @override
  State<_MarqueeLayout> createState() => _MarqueeLayoutState();
}

class _MarqueeLayoutState extends State<_MarqueeLayout> {
  late ScrollController _scrollController;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Start at a very high offset to avoid hitting bounds at 0
    // Visual Right (+1) = Offset Decreases
    // Visual Left (-1) = Offset Increases
    _scrollController = ScrollController(initialScrollOffset: 10000.0);
    WidgetsBinding.instance.addPostFrameCallback((_) => _startScrolling());
  }

  void _startScrolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 16), (timer) {
      if (_scrollController.hasClients) {
        // Visual movement direction:
        // direction 1 -> moves right -> offset decreases
        // direction -1 -> moves left -> offset increases
        final double offsetDelta = (widget.direction * widget.speed);
        final double newOffset = _scrollController.offset - offsetDelta;
        
        // Loop back if we get too far from the safety zone
        if (newOffset < 5000.0) {
          _scrollController.jumpTo(newOffset + 20000.0);
        } else if (newOffset > 30000.0) {
          _scrollController.jumpTo(newOffset - 20000.0);
        } else {
          _scrollController.jumpTo(newOffset);
        }
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: _scrollController,
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      itemBuilder: (context, index) {
        final item = widget.items[index % widget.items.length];
        return widget.child(item);
      },
    );
  }
}



