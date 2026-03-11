import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_task_card.dart';
import 'package:buddy_mobile/features/home/screens/early_warning_screen.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:buddy_mobile/features/home/screens/location_reminder_create_screen.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';

class LocationRemindersScreen extends StatefulWidget {
  const LocationRemindersScreen({super.key});

  @override
  State<LocationRemindersScreen> createState() => _LocationRemindersScreenState();
}

class _LocationRemindersScreenState extends State<LocationRemindersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LocationRemindersProvider>().loadReminders();
    });
  }
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'Location Reminders',
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.w700,
            fontSize: 20,
            color: const Color(0xFF1E293B),
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF1E293B),
        surfaceTintColor: Colors.white,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFE2E8F0)),
        ),
      ),
      body: SafeArea(
        child: Consumer<LocationRemindersProvider>(
          builder: (context, provider, _) {
            if (provider.isLoading) {
              return const Center(child: CircularProgressIndicator());
            }

            if (provider.reminders.isEmpty) {
              return RefreshIndicator(
                onRefresh: provider.loadReminders,
                child: ListView(
                  children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                    _buildEmptyState(),
                  ],
                ),
              );
            }

            return RefreshIndicator(
              onRefresh: provider.loadReminders,
              child: ListView.builder(
                padding: const EdgeInsets.all(20),
                itemCount: provider.reminders.length,
                itemBuilder: (context, index) {
                  final reminder = Map<String, dynamic>.from(provider.reminders[index]);
                  return _buildLocationReminderCard(reminder, index);
                },
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
            child: const Icon(LucideIcons.mapPin, size: 36, color: Color(0xFF94A3B8)),
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
    if (isDanger) statusText = 'Risk Alert';
    else if (status == 'completed') statusText = 'COMPLETED';

    return MobileTaskCard(
      title: reminder['title'] ?? 'Untitled',
      status: statusText,
      variant: isDanger ? 'danger' : (status == 'completed' ? 'green' : 'green'),
      date: DateFormatter.displayDateString(context, reminder['date']),
      time: reminder['time'] != null 
          ? DateFormatter.displayTimeString(context, reminder['time'])
          : 'Whenever I arrive',
      location: reminder['location'] ?? 'No Location',
      onView: () => _onEarlyWarning(reminder),
      onShare: () => _onFamilyBackup(reminder),
      onDelete: () => _confirmDelete(reminder['_id']),
      earlyWarningActive: reminder['earlyWarningSet'] ?? false,
    );
  }

  void _onEarlyWarning(Map<String, dynamic> reminder) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => EarlyWarningScreen(reminder: reminder),
      ),
    );
  }

  Future<void> _onFamilyBackup(Map<String, dynamic> reminder) async {
    final success = await context.read<LocationRemindersProvider>().setFamilyBackup(reminder['_id']);
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Family Backup activated for "${reminder['title']}"'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: const Color(0xFF2563EB),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
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

  Future<void> _confirmDelete(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Reminder'),
        content: const Text('Are you sure you want to delete this reminder?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await context.read<LocationRemindersProvider>().deleteReminder(id);
      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Location reminder deleted'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: const Color(0xFF10B981),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Failed to delete reminder'),
              behavior: SnackBarBehavior.floating,
              backgroundColor: const Color(0xFFEF4444),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      }
    }
  }
}
