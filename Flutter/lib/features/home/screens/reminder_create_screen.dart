import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/widgets/mobile_map_picker.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class ReminderCreateScreen extends StatefulWidget {
  final Map<String, dynamic>? task;
  const ReminderCreateScreen({super.key, this.task});

  @override
  State<ReminderCreateScreen> createState() => _ReminderCreateScreenState();
}

class _ReminderCreateScreenState extends State<ReminderCreateScreen> {
  late TextEditingController titleController;
  late TextEditingController dateController;
  late TextEditingController timeController;
  late TextEditingController locationController;
  Map<String, dynamic>? selectedCoordinates;

  // Smart Features state
  bool earlyWarning = true;
  bool trafficAware = true;
  bool itemExitGuards = true;
  bool pushEnabled = true;

  int bufferTime = 15;

  @override
  void initState() {
    super.initState();
    titleController = TextEditingController(text: widget.task?['title'] ?? '');

    String initialDate = DateTime.now().toString().split(' ')[0];
    if (widget.task?['date'] != null) {
      initialDate = widget.task!['date'].toString().split('T')[0];
    }
    dateController = TextEditingController(text: initialDate);

    timeController = TextEditingController(
      text: widget.task?['time'] ?? "10:00",
    );
    locationController = TextEditingController(
      text: widget.task?['location'] ?? '',
    );
    if (widget.task?['coordinates'] != null) {
      selectedCoordinates = Map<String, dynamic>.from(
        widget.task!['coordinates'],
      );
    }

    // Initialize Smart Features from task if editing
    final sf = widget.task?['smartFeatures'] ?? {};
    earlyWarning = sf['earlyWarning'] ?? true;
    trafficAware = sf['trafficAware'] ?? true;
    itemExitGuards = sf['itemExitGuards'] ?? true;

    final al = widget.task?['alerts'] ?? {};
    pushEnabled = al['push'] ?? true;

    bufferTime = widget.task?['bufferTime'] ?? 15;
  }

  Future<void> _handleSave() async {
    if (titleController.text.isEmpty) {
      ToastUtils.showErrorToast("Please enter a title");
      return;
    }

    final data = {
      'title': titleController.text,
      'date': dateController.text,
      'time': timeController.text,
      'location': locationController.text,
      'coordinates': selectedCoordinates,
      'smartFeatures': {
        'earlyWarning': earlyWarning,
        'trafficAware': trafficAware,
        'itemExitGuards': itemExitGuards,
      },
      'alerts': {'push': pushEnabled, 'email': true},
      'bufferTime': bufferTime,
    };

    final provider = Provider.of<TasksProvider>(context, listen: false);
    bool success;

    if (widget.task != null) {
      success = await provider.updateTask(widget.task!['_id'], data);
    } else {
      success = await provider.createTask(data);
    }

    if (success && mounted) {
      ToastUtils.showSuccessToast(
        widget.task != null ? "Reminder updated" : "Reminder created",
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          widget.task != null ? "Edit Reminder" : "New Reminder",
          style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        shape: Border(bottom: BorderSide(color: Colors.grey[200]!, width: 1)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildField(
              "Title",
              titleController,
              hint: "What do you need to do?",
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildField(
                    "Date",
                    dateController,
                    icon: LucideIcons.calendar,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildField(
                    "Time",
                    timeController,
                    icon: LucideIcons.clock,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            MobileMapPicker(
              initialCoordinates: selectedCoordinates,
              onLocationSelected: (coords, addr) {
                setState(() {
                  selectedCoordinates = coords;
                  if (locationController.text.isEmpty) {
                    locationController.text = addr;
                  }
                });
              },
            ),
            _buildField(
              "Location",
              locationController,
              icon: LucideIcons.mapPin,
              hint: "Where? (Optional)",
            ),

            const SizedBox(height: 32),
            Text(
              "SMART FEATURES",
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 16),
            _buildSmartToggle(
              "Early Warning System",
              "AI-powered proactive alerts",
              LucideIcons.shieldAlert,
              const Color(0xFF6366F1),
              earlyWarning,
              (v) => setState(() => earlyWarning = v),
            ),
            _buildSmartToggle(
              "Traffic-Aware ETA",
              "Real-time traffic adjustments",
              LucideIcons.car,
              const Color(0xFF10B981),
              trafficAware,
              (v) => setState(() => trafficAware = v),
            ),
            _buildSmartToggle(
              "Item Exit Guards",
              "Don't leave without your items",
              LucideIcons.smartphone,
              const Color(0xFF8B5CF6),
              itemExitGuards,
              (v) => setState(() => itemExitGuards = v),
            ),

            const SizedBox(height: 24),
            Text(
              "NOTIFICATION CHANNELS",
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 16),
            _buildChannelToggle(
              "Push Notifications",
              LucideIcons.bell,
              pushEnabled,
              (v) => setState(() => pushEnabled = v),
            ),

            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _handleSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  widget.task != null ? "Save Changes" : "Create Reminder",
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(
    String label,
    TextEditingController controller, {
    IconData? icon,
    String? hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            label.toUpperCase(),
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
              color: const Color(0xFF64748B),
            ),
          ),
        ),
        TextField(
          controller: controller,
          style: GoogleFonts.outfit(fontSize: 15),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: icon != null
                ? Icon(icon, size: 18, color: Theme.of(context).primaryColor)
                : null,
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.all(16),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(
                color: Theme.of(context).primaryColor,
                width: 2,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSmartToggle(
    String title,
    String sub,
    IconData icon,
    Color color,
    bool value,
    Function(bool) onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: SwitchListTile.adaptive(
        value: value,
        onChanged: onChanged,
        secondary: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(
          title,
          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          sub,
          style: GoogleFonts.outfit(
            fontSize: 11,
            color: const Color(0xFF64748B),
          ),
        ),
        activeThumbColor: Colors.white,
        activeTrackColor: color,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
    );
  }

  Widget _buildChannelToggle(
    String title,
    IconData icon,
    bool value,
    Function(bool) onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: SwitchListTile.adaptive(
        value: value,
        onChanged: onChanged,
        secondary: Icon(icon, color: Theme.of(context).primaryColor, size: 20),
        title: Text(
          title,
          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        activeThumbColor: Colors.white,
        activeTrackColor: Theme.of(context).primaryColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
      ),
    );
  }
}
