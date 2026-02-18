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
import 'package:buddy_mobile/features/home/widgets/smart_details_panel.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

import 'package:buddy_mobile/features/account/screens/account_settings_screen.dart';

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
    const BuddyAssistantPage(), // Index 2 is always Buddy
    const MemoryScreenPlaceholder(),
    const AccountSettingsScreen(), // Index 4: Account Settings
  ];

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      // If we are on Buddy page, we might want full screen without standard app bar?
      // But user likely wants persistent nav.
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

// Dynamic Memory Screen
class MemoryScreenPlaceholder extends StatefulWidget {
  const MemoryScreenPlaceholder({super.key});

  @override
  State<MemoryScreenPlaceholder> createState() => _MemoryScreenPlaceholderState();
}

class _MemoryScreenPlaceholderState extends State<MemoryScreenPlaceholder> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        Provider.of<MemoriesProvider>(context, listen: false).loadMemories());
  }

  String _getFileUrl(String? path) {
    if (path == null) return '';
    if (path.startsWith('http')) return path;
    final String host = Platform.isAndroid ? '10.0.2.2' : 'localhost';
    return 'http://$host:5001/${path.replaceAll('\\', '/')}';
  }

  Future<void> _showRightSlideOver({
    required BuildContext context,
    required String title,
    required Widget child,
    Widget? actionButton,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "SlideOver",
      barrierColor: Colors.black.withOpacity(0.5),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) => const SizedBox.shrink(),
      transitionBuilder: (context, anim1, anim2, _) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(
            CurvedAnimation(parent: anim1, curve: Curves.easeOutCubic),
          ),
          child: Align(
            alignment: Alignment.centerRight,
            child: Material(
              elevation: 16,
              child: Container(
                width: MediaQuery.of(context).size.width * 0.85,
                height: double.infinity,
                color: const Color(0xFFF8FAFC),
                child: SafeArea(
                  child: Column(
                    children: [
                      // Header
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
                        ),
                        child: Row(
                          children: [
                            Expanded(child: Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold))),
                            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(LucideIcons.x, size: 20)),
                          ],
                        ),
                      ),
                      // Content
                      Expanded(child: child),
                      // Action Button (Sticky Bottom)
                      if (actionButton != null)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))],
                          ),
                          child: actionButton,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showDeleteDialog(BuildContext context, Map<String, dynamic> item) {
    final type = item['type'] ?? 'memory';
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(type == 'memory' ? "Forget Memory" : "Delete Document",
            style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text(
          type == 'memory'
              ? "Are you sure you want Buddy to forget this?"
              : "This will permanently delete the document and extracted data.",
          style: GoogleFonts.outfit(),
        ),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Cancel"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Provider.of<MemoriesProvider>(context, listen: false)
                        .deleteItem(item['_id'], type);
                    Navigator.pop(context);
                    ToastUtils.showSuccessToast(type == 'memory' ? "Memory forgotten" : "Document deleted");
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.withOpacity(0.05),
                    foregroundColor: Colors.red,
                    side: BorderSide(color: Colors.red.withOpacity(0.2), width: 1.5),
                  ),
                  child: const Text("Delete"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showViewDialog(BuildContext context, Map<String, dynamic> item) {
    final type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';
    final themeColor = isMemory ? const Color(0xFF9333EA) : const Color(0xFF059669);

    _showRightSlideOver(
      context: context,
      title: isMemory ? "Memory Details" : "Document Details",
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            if (isMemory) ...[
              _DetailCard(
                title: "Insight",
                icon: LucideIcons.brain,
                color: themeColor,
                child: Text(item['content'] ?? '',
                    style: GoogleFonts.outfit(fontSize: 16, height: 1.5, color: const Color(0xFF1E293B))),
              ),
            ] else ...[
              _DetailCard(
                title: "Information",
                icon: LucideIcons.fileText,
                color: themeColor,
                child: Column(
                  children: [
                    _InfoRow(label: "Patient", value: item['extractedData']?['patientName'] ?? 'Unknown'),
                    _InfoRow(label: "Doctor", value: "Dr. ${item['extractedData']?['doctorName'] ?? 'Unspecified'}"),
                    _InfoRow(label: "Uploaded", value: item['createdAt']?.toString().split('T')[0] ?? ''),
                  ],
                ),
              ),
              if (item['extractedData']?['medicines'] != null)
                _DetailCard(
                  title: "Medicines",
                  icon: LucideIcons.pill,
                  color: themeColor,
                  child: Column(
                    children: ((item['extractedData']?['medicines'] ?? []) as List).map<Widget>((med) => 
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          border: Border(bottom: BorderSide(color: Colors.grey[100]!)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(med['name'] ?? '', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                                  Text("${med['dosage'] ?? ''} • ${med['timing'] ?? ''}", 
                                      style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    ).toList(),
                  ),
                ),
              if (item['fileUrl'] != null)
                _DetailCard(
                  title: "Document Preview",
                  icon: LucideIcons.image,
                  color: themeColor,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: CachedNetworkImage(
                      imageUrl: _getFileUrl(item['fileUrl']),
                      placeholder: (context, url) => Container(height: 200, color: Colors.grey[100], child: const Center(child: CircularProgressIndicator())),
                      errorWidget: (context, url, error) => Container(height: 100, color: Colors.grey[100], child: const Icon(LucideIcons.imageOff)),
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  void _showEditDialog(BuildContext context, Map<String, dynamic> item) {
    final type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';
    final themeColor = isMemory ? const Color(0xFF9333EA) : const Color(0xFF1D4ED8);
    
    final dynamic extracted = item['extractedData'];
    final TextEditingController contentController = TextEditingController(text: isMemory ? (item['content'] ?? '') : '');
    final TextEditingController patientController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['patientName'] ?? '') : '');
    final TextEditingController doctorController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['doctorName'] ?? '') : '');
    final TextEditingController notesController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['notes'] ?? '') : '');

    _showRightSlideOver(
      context: context,
      title: isMemory ? "Edit Memory" : "Edit Document",
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            if (isMemory) ...[
              TextField(
                controller: contentController,
                maxLines: 12,
                style: GoogleFonts.outfit(),
                decoration: InputDecoration(
                  hintText: "What do you want Buddy to remember?",
                  filled: true,
                  fillColor: const Color(0xFFF8FAFC),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ] else ...[
              _EditRow(label: "Patient Name", controller: patientController),
              const SizedBox(height: 16),
              _EditRow(label: "Doctor Name", controller: doctorController),
              const SizedBox(height: 16),
              _EditRow(label: "Buddy Notes", controller: notesController, maxLines: 6),
            ],
          ],
        ),
      ),
      actionButton: SizedBox(
        width: double.infinity,
        height: 50,
        child: ElevatedButton(
          onPressed: () async {
            final provider = Provider.of<MemoriesProvider>(context, listen: false);
            bool success;
            if (isMemory) {
              success = await provider.updateMemory(item['_id'], contentController.text);
            } else {
              success = await provider.updatePrescription(item['_id'], {
                ...item['extractedData'],
                'patientName': patientController.text,
                'doctorName': doctorController.text,
                'notes': notesController.text,
              });
            }
            if (success) {
              Navigator.pop(context);
              ToastUtils.showSuccessToast("Updated successfully");
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: themeColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 0,
          ),
          child: Text("Save Changes", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        ),
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
                  if (provider.isLoading) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (provider.memories.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.brain, size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text(
                            "No memories yet",
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              color: Colors.grey[500],
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
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

class _DetailCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final Widget child;

  const _DetailCard({required this.title, required this.icon, required this.color, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 10),
              Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          SizedBox(
            width: 100,
            child: Text(label.toUpperCase(), 
                style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey[400])),
          ),
          Expanded(
            child: Text(value, style: GoogleFonts.outfit(fontWeight: FontWeight.w600, color: const Color(0xFF1E293B))),
          ),
        ],
      ),
    );
  }
}

class _EditRow extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final int maxLines;

  const _EditRow({required this.label, required this.controller, this.maxLines = 1});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            label.toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
              color: const Color(0xFF64748B),
            ),
          ),
        ),
        TextField(
          controller: controller,
          maxLines: maxLines,
          style: GoogleFonts.outfit(fontSize: 15, color: const Color(0xFF1E293B)),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Theme.of(context).primaryColor, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

// Task Screen Implementation
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

  String _formatDate(String? dateStr) {
    if (dateStr == null) return 'No date';
    try {
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final d = DateTime(date.year, date.month, date.day);

      final diff = d.difference(today).inDays;
      if (diff == 0) return 'Today';
      if (diff == 1) return 'Tomorrow';
      if (diff == -1) return 'Yesterday';
      
      return DateFormat('EEE, d MMM').format(date);
    } catch (e) {
      return dateStr;
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return 'All day';
    return timeStr;
  }

  DateTime? _parseTime(DateTime baseDate, String? timeStr) {
    if (timeStr == null || timeStr.isEmpty) return null;
    try {
      timeStr = timeStr.trim().toUpperCase();
      int hour = 0;
      int minute = 0;

      if (timeStr.contains('AM') || timeStr.contains('PM')) {
        final isPM = timeStr.contains('PM');
        final cleanTime = timeStr.replaceAll('AM', '').replaceAll('PM', '').trim();
        final parts = cleanTime.split(':');
        hour = int.parse(parts[0]);
        if (parts.length > 1) minute = int.parse(parts[1]);
        
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour == 12) hour = 0;
      } else if (timeStr.contains(':')) {
        final parts = timeStr.split(':');
        hour = int.parse(parts[0]);
        minute = int.parse(parts[1]);
      } else {
        hour = int.parse(timeStr);
      }
      
      return DateTime(baseDate.year, baseDate.month, baseDate.day, hour, minute);
    } catch (e) {
      return null;
    }
  }

  void _showDeleteDialog(BuildContext context, String id) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text("Delete Reminder", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text("Are you sure you want to delete this reminder?", style: GoogleFonts.outfit()),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Cancel"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Provider.of<TasksProvider>(context, listen: false).deleteTask(id);
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.withOpacity(0.05),
                    foregroundColor: Colors.red,
                    side: BorderSide(color: Colors.red.withOpacity(0.2), width: 1.5),
                  ),
                  child: const Text("Delete"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showShareDialog(BuildContext context, Map<String, dynamic> task) {
    final emailController = TextEditingController();
    String permissions = 'view';
    final primaryColor = Theme.of(context).primaryColor;

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "ShareDialog",
      barrierColor: Colors.black.withOpacity(0.4),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) => const SizedBox.shrink(),
      transitionBuilder: (context, anim1, anim2, child) {
        return ScaleTransition(
          scale: CurvedAnimation(parent: anim1, curve: Curves.easeOutBack),
          child: FadeTransition(
            opacity: anim1,
            child: Dialog(
              backgroundColor: Colors.transparent,
              child: Container(
                constraints: const BoxConstraints(maxWidth: 400),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    )
                  ],
                ),
                padding: const EdgeInsets.all(24),
                child: StatefulBuilder(
                  builder: (context, setState) => SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(LucideIcons.users, color: primaryColor, size: 24),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Share Reminder",
                                    style: GoogleFonts.outfit(
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF1E293B),
                                    ),
                                  ),
                                  Text(
                                    "Invite collaborators to this task",
                                    style: GoogleFonts.outfit(
                                      fontSize: 14,
                                      color: Colors.grey[500],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          "COLLABORATOR EMAIL",
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: emailController,
                          style: GoogleFonts.outfit(fontSize: 15),
                          decoration: InputDecoration(
                            hintText: "Enter email address...",
                            prefixIcon: Icon(LucideIcons.mail, size: 18, color: primaryColor),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Text(
                          "ACCESS PERMISSION",
                          style: GoogleFonts.outfit(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 8),
                        DropdownMenu<String>(
                        initialSelection: permissions,
                        expandedInsets: EdgeInsets.zero,
                        dropdownMenuEntries: const [
                          DropdownMenuEntry(
                            value: 'view',
                            label: "View Only",
                          ),
                          DropdownMenuEntry(
                            value: 'edit',
                            label: "Can Edit",
                          ),
                        ],
                        onSelected: (val) => setState(() => permissions = val!),
                        textStyle: GoogleFonts.outfit(fontSize: 15, color: const Color(0xFF1E293B)),
                        inputDecorationTheme: Theme.of(context).inputDecorationTheme.copyWith(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                        ),
                      ),
                        const SizedBox(height: 32),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => Navigator.pop(context),
                                child: const Text("Cancel"),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton(
                                onPressed: () {
                                  Navigator.pop(context);
                                  ToastUtils.showSuccessToast("Shared successfully with ${emailController.text}");
                                },
                                child: const Text("Send Invite"),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  void _showEditSlideOver(BuildContext context, Map<String, dynamic> task, {bool isEditMode = false}) {
    _showRightSlideOver(
      context: context,
      title: isEditMode ? "Edit Settings" : "Smart Details",
      child: SmartDetailsPanel(
        reminder: task,
        initialEditMode: isEditMode,
      ),
    );
  }

  void _showCreateSlideOver(BuildContext context) {
    final TextEditingController titleController = TextEditingController();
    final TextEditingController dateController = TextEditingController(text: DateTime.now().toString().split('T')[0]);
    final TextEditingController timeController = TextEditingController(text: "10:00");
    final TextEditingController locationController = TextEditingController();

    _showRightSlideOver(
      context: context,
      title: "New Reminder",
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            _EditRow(label: "Title", controller: titleController),
            const SizedBox(height: 16),
            _EditRow(label: "Date", controller: dateController),
            const SizedBox(height: 16),
            _EditRow(label: "Time", controller: timeController),
            const SizedBox(height: 16),
            _EditRow(label: "Location", controller: locationController),
          ],
        ),
      ),
      actionButton: SizedBox(
        width: double.infinity,
        child: ElevatedButton(
          onPressed: () async {
            if (titleController.text.isEmpty) {
              ToastUtils.showErrorToast("Title is required");
              return;
            }
            final success = await Provider.of<TasksProvider>(context, listen: false).createTask({
              'title': titleController.text,
              'date': dateController.text,
              'time': timeController.text,
              'location': locationController.text,
            });
            if (success) {
              Navigator.pop(context);
              ToastUtils.showSuccessToast("Reminder created");
            }
          },
          child: const Text("Create Reminder"),
        ),
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
              child: Consumer<TasksProvider>(
                builder: (context, provider, child) {
                  if (provider.isLoading) return const Center(child: CircularProgressIndicator());
                  if (provider.tasks.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.calendar, size: 64, color: Colors.grey[300]),
                          const SizedBox(height: 16),
                          Text("No reminders found", style: GoogleFonts.outfit(color: Colors.grey[500])),
                        ],
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.all(20),
                    itemCount: provider.tasks.length,
                    itemBuilder: (context, index) {
                      final task = provider.tasks[index];
                      
                      // Logic for status/variant
                      final dateStr = task['date'];
                      bool isOverdue = false;
                      String timeDiff = '';

                      if (dateStr != null && task['status'] != 'completed') {
                        try {
                          final reminderDate = DateTime.parse(dateStr);
                          final parsedTime = _parseTime(reminderDate, task['time']);
                          final finalDate = parsedTime ?? DateTime(reminderDate.year, reminderDate.month, reminderDate.day, 23, 59);
                          
                          final now = DateTime.now();
                          isOverdue = now.isAfter(finalDate);
                          if (isOverdue) {
                            final diff = now.difference(finalDate);
                            if (diff.inDays > 0) timeDiff = "${diff.inDays} days overdue";
                            else if (diff.inHours > 0) timeDiff = "${diff.inHours} hours overdue";
                            else timeDiff = "${diff.inMinutes} mins overdue";
                          }
                        } catch (e) {}
                      }

                      final bool isTask = task['intent'] == 'task';
                      final String variant = isOverdue ? 'danger' : (isTask ? 'orange' : 'green');
                      final String status = isOverdue ? 'Risk Alert' : (isTask ? 'PENDING' : 'ON TRACK');
                      final String displayTime = isOverdue 
                          ? "Due ${_formatDate(task['date'])} ($timeDiff)"
                          : _formatTime(task['time']);

                      final bool earlyWarningActive = (task['smartFeatures']?['earlyWarning'] == true);

                      return MobileTaskCard(
                        title: task['title'] ?? 'Untitled',
                        status: status,
                        variant: variant,
                        time: displayTime,
                        location: task['location'] ?? 'No Location Set',
                        distance: task['distance'],
                        eta: task['eta'],
                        earlyWarningActive: earlyWarningActive,
                        onDelete: () => _showDeleteDialog(context, task['_id']),
                        onEdit: () => _showEditSlideOver(context, task, isEditMode: true),
                        onView: () => _showEditSlideOver(context, task, isEditMode: false),
                        onShare: () => _showShareDialog(context, task),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Slide-over helper duplicated here for now (should be shared)
  Future<void> _showRightSlideOver({
    required BuildContext context,
    required String title,
    required Widget child,
    Widget? actionButton,
  }) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: "SlideOver",
      barrierColor: Colors.black.withOpacity(0.5),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) => const SizedBox.shrink(),
      transitionBuilder: (context, anim1, anim2, _) {
        return SlideTransition(
          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero).animate(
            CurvedAnimation(parent: anim1, curve: Curves.easeOutCubic),
          ),
          child: Align(
            alignment: Alignment.centerRight,
            child: Material(
              elevation: 16,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                bottomLeft: Radius.circular(16),
              ),
              child: Container(
                width: MediaQuery.of(context).size.width * 0.85,
                height: double.infinity,
                decoration: const BoxDecoration(
                  color: Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(16),
                    bottomLeft: Radius.circular(16),
                  ),
                ),
                child: SafeArea(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
                        ),
                        child: Row(
                          children: [
                            Expanded(child: Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold))),
                            IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(LucideIcons.x, size: 20)),
                          ],
                        ),
                      ),
                      Expanded(child: child),
                      if (actionButton != null)
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))],
                          ),
                          child: actionButton,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
