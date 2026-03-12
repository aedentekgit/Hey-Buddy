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

class LocationRemindersScreen extends StatefulWidget {
  const LocationRemindersScreen({super.key});

  @override
  State<LocationRemindersScreen> createState() => _LocationRemindersScreenState();
}

class _LocationRemindersScreenState extends State<LocationRemindersScreen> {
  String _activeFilter = 'All';
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LocationRemindersProvider>().loadReminders();
    });
    _searchCtrl.addListener(
        () => setState(() => _searchQuery = _searchCtrl.text.toLowerCase()));
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
      if (s == 'completed') statusSet.add('Completed');
      else if (s == 'risk_alert') statusSet.add('Risk Alert');
      else statusSet.add('Active');
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
          .where((r) =>
              (r['title'] ?? '').toString().toLowerCase().contains(_searchQuery) ||
              (r['location'] ?? '').toString().toLowerCase().contains(_searchQuery))
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
          (_) => setState(() => _activeFilter = 'All'));
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
                                      fontSize: 13.5, color: AppColors.text),
                                  decoration: InputDecoration.collapsed(
                                    hintText: 'Search location reminders…',
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
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: active ? AppColors.accent : AppColors.bg,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: active ? AppColors.accent : AppColors.border,
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
                  child: ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                    _buildEmptyState(),
                  ]),
                )
              : RefreshIndicator(
                  onRefresh: provider.loadReminders,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                    itemCount: filtered.length,
                    itemBuilder: (context, index) {
                      final reminder =
                          Map<String, dynamic>.from(filtered[index]);
                      return _buildLocationReminderCard(reminder, index);
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
      variant: isDanger ? 'danger' : (status == 'completed' ? 'green' : 'orange'),
      date: DateFormatter.displayDateString(context, reminder['date']),
      time: reminder['time'] != null 
          ? DateFormatter.displayTimeString(context, reminder['time'])
          : 'Whenever I arrive',
      location: reminder['location'] ?? 'No Location',
      onView: () => _onViewReminder(reminder),
      onShare: () => _onFamilyBackup(reminder),
      earlyWarningActive: reminder['earlyWarningSet'] ?? false,
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
