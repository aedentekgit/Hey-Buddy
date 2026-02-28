import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';

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
    // Load tasks if not already loaded to show in "Explore More"
    Future.microtask(() => Provider.of<TasksProvider>(context, listen: false).loadTasks());
  }

  @override
  Widget build(BuildContext context) {
    super.build(context); // Required for KeepAlive
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF), // Corrected background
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Engaging Content Section
            Text(
              "Engaging Content",
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
              childAspectRatio: 2.2, // Reduced height for professional look
              children: [
                _buildEngagingCard(
                  title: "Memory",
                  icon: LucideIcons.brain,
                  bgColor: const Color(0xFFBAE6FD), // Increased tone (Sky 200)
                  iconColor: const Color(0xFF0284C7), // Darker icon for contrast
                  onTap: widget.onMemoryTap ?? () {},
                ),
                _buildEngagingCard(
                  title: "Reminder",
                  icon: LucideIcons.clock,
                  bgColor: const Color(0xFFFEE2E2), // Increased tone (Red 100)
                  iconColor: const Color(0xFFDC2626), // Darker icon for contrast
                  onTap: widget.onReminderTap ?? () {},
                ),
              ],
            ),


            
            const SizedBox(height: 32),
            
            // Explore More Section
            Text(
              "Explore More",
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),
            
            // Infinitely scrolling cloud of suggestion chips (Marquee style)
            Consumer<TasksProvider>(
              builder: (context, provider, child) {
                final List<Map<String, dynamic>> reminders = provider.tasks.map((t) => {
                  'title': t['title'] ?? 'Task',
                  'icon': TaskUtils.getTaskIcon(t['title'], t['intent']),
                  'color': Colors.indigo,
                  'task': t,
                }).toList();

                // Add placeholders if no real reminders
                if (reminders.isEmpty) {
                  reminders.addAll([
                    {'title': 'Meeting with the team', 'icon': LucideIcons.briefcase, 'color': Colors.indigo},
                    {'title': 'Pickup girlfriend', 'icon': LucideIcons.heart, 'color': Colors.pinkAccent},
                    {'title': 'Doctor appointment', 'icon': LucideIcons.activity, 'color': Colors.red},
                    {'title': 'Go to the gym', 'icon': LucideIcons.dumbbell, 'color': Colors.orange},
                    {'title': 'Read a book', 'icon': LucideIcons.book, 'color': Colors.brown},
                  ]);
                }

                // Create variations of the reminders list so the rows don't look identical
                final row1 = reminders.reversed.toList();
                final row2 = reminders;
                final row3 = [...reminders.skip(reminders.length ~/ 2), ...reminders.take(reminders.length ~/ 2)];

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



            
            const SizedBox(height: 32),
            
            // Skills List Section
            Text(
              "Skills List",
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),
            _buildSkillsCard(),
            
            const SizedBox(height: 40),
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
        } else if (item['title'] != null) {
          // If it's a general suggestion, switch to Dialogue and send it
          final buddyProvider = Provider.of<BuddyProvider>(context, listen: false);
          
          // Switch to dialogue tab first (assuming you have access to the parent controller, or we just rely on the existing integration)
          // For now, we'll just send the message. Note: the user might need to switch tabs manually if we don't handle it here.
          buddyProvider.addMessage('user', item['title']);
          buddyProvider.sendMessage(item['title'], language: 'en-US');
          
          // Show a brief toast or indication
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


  Widget _buildSkillsCard() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
            child: Row(
              children: [
                Text(
                  "New",
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF991B1B),
                  ),
                ),
                const Spacer(),
                const Icon(LucideIcons.arrowUpRight, color: Color(0xFF991B1B), size: 18),
              ],
            ),
          ),
          _buildSkillItem("1", "Screen off"),
          _buildSkillItem("2", "Turn on Eye care"),
          _buildSkillItem("3", "Turn up the brightness"),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildSkillItem(String number, String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: const Color(0xFFF97316).withOpacity(0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Center(
              child: Text(
                number,
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFFF97316),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF334155),
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              "Try",
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF475569),
              ),
            ),
          ),
        ],
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



