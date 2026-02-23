
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:buddy_mobile/shared/widgets/mobile_navbar.dart';
import 'package:buddy_mobile/features/voice_assistant/screens/buddy_assistant_page.dart';
import 'package:buddy_mobile/shared/widgets/mobile_memory_card.dart';
import 'package:buddy_mobile/shared/widgets/mobile_header.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_task_card.dart';
import 'package:intl/intl.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/home/screens/reminder_create_screen.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';
import 'package:buddy_mobile/features/home/screens/memory_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/memory_edit_screen.dart';
import 'package:buddy_mobile/features/account/screens/account_settings_screen.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 3; // Default to Memory Screen

  final List<Widget> _pages = [
    const Center(child: Text("Home Page Placeholder")),
    const TaskScreen(),
    const SizedBox.shrink(), // Placeholder for BuddyAssistant (now pushed as route)
    const MemoryScreenPlaceholder(),
    const AccountSettingsScreen(),
  ];

  void _onTabTapped(int index) {
    if (index == 2) {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const BuddyAssistantPage()),
      );
      return;
    }
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: MobileNavbar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
      ),
    );
  }
}

class MemoryScreenPlaceholder extends StatefulWidget {
  const MemoryScreenPlaceholder({super.key});

  @override
  State<MemoryScreenPlaceholder> createState() => _MemoryScreenPlaceholderState();
}

class _MemoryScreenPlaceholderState extends State<MemoryScreenPlaceholder> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => Provider.of<MemoriesProvider>(context, listen: false).loadMemories());
  }

  void _showViewDialog(BuildContext context, Map<String, dynamic> item) {
    Navigator.of(context).push(MaterialPageRoute(builder: (context) => MemoryDetailsScreen(item: item)));
  }

  void _showEditDialog(BuildContext context, Map<String, dynamic> item) {
    Navigator.of(context).push(MaterialPageRoute(builder: (context) => MemoryEditScreen(item: item)));
  }

  void _showDeleteDialog(BuildContext context, Map<String, dynamic> item) {
    final type = item['type'] ?? 'memory';
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(type == 'memory' ? "Forget Memory" : "Delete Document"),
        content: Text(type == 'memory' ? "Are you sure you want Buddy to forget this?" : "Are you sure?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
          TextButton(
            onPressed: () {
              Provider.of<MemoriesProvider>(context, listen: false).deleteItem(item['_id'], type);
              Navigator.pop(context);
              ToastUtils.showSuccessToast(type == 'memory' ? "Memory forgotten" : "Document deleted");
            },
            child: const Text("Delete", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            const MobileHeader(),
            Expanded(
              child: Consumer<MemoriesProvider>(
                builder: (context, provider, child) {
                  if (provider.isLoading) return const Center(child: CircularProgressIndicator());
                  if (provider.memories.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.brain, size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text("No memories found", style: GoogleFonts.outfit(color: Colors.grey[500])),
                        ],
                      ),
                    );
                  }

                  return RefreshIndicator(
                    onRefresh: () => provider.loadMemories(),
                    child: ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: provider.memories.length,
                      itemBuilder: (context, index) {
                        final memory = provider.memories[index];
                        return MobileMemoryCard(
                          item: memory,
                          onView: () => _showViewDialog(context, memory),
                          onEdit: () => _showEditDialog(context, memory),
                          onDelete: () => _showDeleteDialog(context, memory),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key});

  @override
  State<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => Provider.of<TasksProvider>(context, listen: false).loadTasks());
  }

  void _navigateToCreate(BuildContext context) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => const ReminderCreateScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          children: [
            const MobileHeader(),
            Expanded(
              child: Consumer<TasksProvider>(
                builder: (context, provider, child) {
                  if (provider.isLoading) return const Center(child: CircularProgressIndicator());
                  if (provider.tasks.isEmpty) return const Center(child: Text("No reminders found"));

                  return RefreshIndicator(
                    onRefresh: () => provider.loadTasks(),
                    child: ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: provider.tasks.length,
                      itemBuilder: (context, index) {
                        final task = provider.tasks[index];
                        final dateStr = task['date'];
                        bool isOverdue = false;
                        
                        if (dateStr != null && task['status'] != 'completed') {
                          final reminderDate = DateTime.parse(dateStr);
                          final parsedTime = TaskUtils.parseTime(reminderDate, task['time']);
                          final finalDate = parsedTime ?? DateTime(reminderDate.year, reminderDate.month, reminderDate.day, 23, 59);
                          isOverdue = DateTime.now().isAfter(finalDate);
                        }
                  
                        return MobileTaskCard(
                          title: task['title'] ?? 'Untitled',
                          status: isOverdue ? 'Risk Alert' : 'ON TRACK',
                          variant: isOverdue ? 'danger' : 'green',
                          time: task['time'] ?? 'All day',
                          location: task['location'] ?? 'No Location',
                          onView: () => Navigator.push(context, MaterialPageRoute(builder: (context) => SmartDetailsScreen(task: task))),
                          onEdit: () => Navigator.push(context, MaterialPageRoute(builder: (context) => ReminderCreateScreen(task: task))),
                          onDelete: () async {
                            final success = await provider.deleteTask(task['_id']);
                            if (success) ToastUtils.showSuccessToast("Reminder deleted");
                          },
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
