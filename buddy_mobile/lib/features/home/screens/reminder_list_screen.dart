import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_task_card.dart';
import 'package:buddy_mobile/features/home/screens/smart_details_screen.dart';
import 'package:buddy_mobile/features/home/screens/reminder_create_screen.dart';
import 'package:buddy_mobile/shared/utils/task_utils.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';

class ReminderListScreen extends StatefulWidget {
  const ReminderListScreen({super.key});

  @override
  State<ReminderListScreen> createState() => _ReminderListScreenState();
}

class _ReminderListScreenState extends State<ReminderListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => Provider.of<TasksProvider>(context, listen: false).loadTasks());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text("Reminders", style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF1E293B),
        // actions: [
        //   IconButton(
        //     icon: const Icon(LucideIcons.plus),
        //     onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const ReminderCreateScreen())),
        //   ),
        // ],
      ),
      body: SafeArea(
        // Consumer<UserProvider> outer so list rebuilds when format changes
        child: Consumer<UserProvider>(
          builder: (context, userProvider, _) => Consumer<TasksProvider>(
          builder: (context, provider, child) {
            if (provider.isLoading) return const Center(child: CircularProgressIndicator());
            if (provider.tasks.isEmpty) return const Center(child: Text("No reminders found"));


            return RefreshIndicator(
              onRefresh: () => provider.loadTasks(),
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.processedTasks.length,
                itemBuilder: (context, index) {
                  final task = provider.processedTasks[index];
                  final bool isOverdue = task['_isOverdue'] ?? false;
                  final dateStr = task['date'];
            
                  final loc = task['location'];
                  final hasLocation = loc != null && loc.toString().isNotEmpty && loc != 'No Location';

                  return MobileTaskCard(
                    title: task['title'] ?? 'Untitled',
                    status: isOverdue ? 'Risk Alert' : 'ON TRACK',
                    variant: isOverdue ? 'danger' : 'green',
                    date: dateStr != null
                        ? DateFormatter.displayDateString(context, dateStr)
                        : null,
                    time: DateFormatter.displayTimeString(
                      context,
                      task['time'] as String?,
                    ),
                    location: loc ?? 'No Location',
                    distance: hasLocation ? (task['_distanceLabel'] as String?) : null,
                    eta: hasLocation ? (task['_etaLabel'] as String?) : null,
                    headerIcon: TaskUtils.getTaskIcon(task['title'], task['intent']),
                    onView: () => Navigator.push(context, MaterialPageRoute(builder: (context) => SmartDetailsScreen(task: task))),
                    onEdit: () => Navigator.push(context, MaterialPageRoute(builder: (context) => ReminderCreateScreen(task: task))),
                    onDelete: () async {
                      final confirm = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          title: const Text("Delete Reminder"),
                          content: const Text("Are you sure you want to delete this reminder?"),
                          actions: [
                            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
                            TextButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: const Text("Delete", style: TextStyle(color: Colors.red)),
                            ),
                          ],
                        ),
                      );
                      if (confirm == true) {
                        final success = await provider.deleteTask(task['_id']);
                        if (success) ToastUtils.showSuccessToast("Reminder deleted");
                      }
                    },
                  );
                },
              ),
            );
          },
        ),  // Consumer<TasksProvider>
        ),  // Consumer<UserProvider>
      ),
    );

  }
}
