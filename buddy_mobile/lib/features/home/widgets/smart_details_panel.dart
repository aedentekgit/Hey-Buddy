import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/tasks_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';

class SmartDetailsPanel extends StatefulWidget {
  final Map<String, dynamic> reminder;
  final bool initialEditMode;

  const SmartDetailsPanel({
    super.key,
    required this.reminder,
    this.initialEditMode = false,
  });

  @override
  State<SmartDetailsPanel> createState() => _SmartDetailsPanelState();
}

class _SmartDetailsPanelState extends State<SmartDetailsPanel> {
  late bool isEditing;
  late TextEditingController titleController;
  late TextEditingController dateController;
  late TextEditingController timeController;
  late TextEditingController locationController;

  late double bufferTime;
  late double geofenceRadius;
  late Map<String, bool> alerts;
  late String priority;
  late List<dynamic> backupContacts;
  late int escalationTime;
  late Map<String, bool> smartFeatures;
  late List<dynamic> timeline;
  late String status;

  @override
  void initState() {
    super.initState();
    isEditing = widget.initialEditMode;
    final r = widget.reminder;
    titleController = TextEditingController(text: r['title'] ?? '');
    dateController = TextEditingController(text: r['date'] ?? '');
    timeController = TextEditingController(text: r['time'] ?? '');
    locationController = TextEditingController(text: r['location'] ?? '');

    bufferTime = (r['bufferTime'] ?? 15).toDouble();
    geofenceRadius = (r['geofenceRadius'] ?? 500).toDouble();
    
    final al = r['alerts'] ?? {};
    alerts = {
      'push': al['push'] ?? true,
      'sms': al['sms'] ?? false,
      'email': al['email'] ?? false,
    };

    priority = r['priority'] ?? 'medium';
    backupContacts = List.from(r['backupContacts'] ?? []);
    escalationTime = r['escalationTime'] ?? 0;

    final sf = r['smartFeatures'] ?? {};
    smartFeatures = {
      'earlyWarning': sf['earlyWarning'] ?? false,
      'trafficAware': sf['trafficAware'] ?? false,
      'itemExitGuards': sf['itemExitGuards'] ?? false,
    };

    timeline = List.from(r['timeline'] ?? []);
    status = r['status'] ?? 'pending';
  }

  @override
  void dispose() {
    titleController.dispose();
    dateController.dispose();
    timeController.dispose();
    locationController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final updatedData = {
      'title': titleController.text,
      'date': dateController.text,
      'time': timeController.text,
      'location': locationController.text,
      'bufferTime': bufferTime.toInt(),
      'geofenceRadius': geofenceRadius.toInt(),
      'alerts': alerts,
      'priority': priority,
      'backupContacts': backupContacts,
      'escalationTime': escalationTime,
      'smartFeatures': smartFeatures,
      'status': status,
    };

    final success = await Provider.of<TasksProvider>(context, listen: false)
        .updateTask(widget.reminder['_id'], updatedData);

    if (success) {
      if (mounted) {
        setState(() => isEditing = false);
        ToastUtils.showSuccessToast("Settings updated");
      }
    } else {
      if (mounted) {
        ToastUtils.showErrorToast("Failed to update settings");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _StatusBadge(label: status == 'completed' ? "Completed" : "On Track"),
              InkWell(
                onTap: () {
                  if (isEditing) {
                    setState(() => isEditing = false);
                  } else {
                    setState(() => isEditing = true);
                  }
                },
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: isEditing ? const Color(0xFFFEE2E2) : const Color(0xFFEEF2FF),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: isEditing ? const Color(0xFFFECACA) : const Color(0xFFE0E7FF),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isEditing ? LucideIcons.x : LucideIcons.pencil,
                        size: 14,
                        color: isEditing ? const Color(0xFFEF4444) : Theme.of(context).primaryColor,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isEditing ? "Cancel" : "Edit Settings",
                        style: GoogleFonts.outfit(
                          color: isEditing ? const Color(0xFFEF4444) : Theme.of(context).primaryColor,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Title
          if (isEditing)
            TextField(
              controller: titleController,
              style: GoogleFonts.outfit(fontSize: 24, fontWeight: FontWeight.w800),
              decoration: InputDecoration(
                filled: true,
                fillColor: const Color(0xFFF1F5F9),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.all(16),
              ),
            )
          else
            Text(
              titleController.text,
              style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w800, height: 1.2),
            ),
          const SizedBox(height: 24),

          // Meta Info Rows
          _InfoRow(
            icon: LucideIcons.mapPin,
            label: "Location",
            child: isEditing
                ? TextField(
                    controller: locationController,
                    decoration: const InputDecoration(hintText: "Add location...", border: InputBorder.none),
                    style: GoogleFonts.outfit(fontSize: 14),
                  )
                : Text(locationController.text.isEmpty ? "No location set" : locationController.text),
          ),
          const SizedBox(height: 12),
          _InfoRow(
            icon: LucideIcons.clock,
            label: "Schedule",
            child: isEditing
                ? Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: dateController,
                          decoration: const InputDecoration(border: InputBorder.none),
                          style: GoogleFonts.outfit(fontSize: 14),
                        ),
                      ),
                      Expanded(
                        child: TextField(
                          controller: timeController,
                          decoration: const InputDecoration(border: InputBorder.none),
                          style: GoogleFonts.outfit(fontSize: 14),
                        ),
                      ),
                    ],
                  )
                : Text("Time: ${timeController.text} • ${dateController.text}"),
          ),
          const SizedBox(height: 32),

          // Time Settings
          _DetailCard(
            title: "TIME & BUFFER CONFIG",
            icon: LucideIcons.clock,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      "Safety Buffer Time",
                      style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text("${bufferTime.toInt()} min", style: GoogleFonts.outfit(color: Theme.of(context).primaryColor, fontWeight: FontWeight.w800, fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  trackHeight: 6,
                  activeTrackColor: Theme.of(context).primaryColor,
                  inactiveTrackColor: const Color(0xFFE2E8F0),
                  thumbColor: Colors.white,
                  overlayColor: Theme.of(context).primaryColor.withOpacity(0.12),
                  thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10, elevation: 3),
                ),
                child: Slider(
                  value: bufferTime,
                  min: 5,
                  max: 120,
                  divisions: 23,
                  onChanged: isEditing ? (v) => setState(() => bufferTime = v) : null,
                ),
              ),
              Text(
                "Add extra time before your reminder to ensure you're never late.",
                style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[500], height: 1.4),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Theme.of(context).primaryColor.withOpacity(0.1), Theme.of(context).primaryColor.withOpacity(0.15)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Theme.of(context).primaryColor.withOpacity(0.1)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
                      ),
                      child: Icon(LucideIcons.bell, color: Theme.of(context).primaryColor, size: 18),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("ADJUSTED NOTIFICATION", style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w800, color: Theme.of(context).primaryColor, letterSpacing: 1)),
                          const SizedBox(height: 2),
                          Text(_getAdjustedTime(), style: GoogleFonts.outfit(fontSize: 22, fontWeight: FontWeight.w900, color: const Color(0xFF1E293B))),
                        ],
                      ),
                    )
                  ],
                ),
              )
            ],
          ),

          // Location Settings
          _DetailCard(
            title: "LOCATION SETTINGS",
            icon: LucideIcons.navigation,
            children: [
              Container(
                height: 150,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(child: Icon(LucideIcons.mapPin, size: 32, color: Color(0xFF6366F1))),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text("Geofence Radius", style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                  ),
                  Text("${geofenceRadius.toInt()}m", style: GoogleFonts.outfit(color: const Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                ],
              ),
              Slider(
                value: geofenceRadius,
                min: 100,
                max: 2000,
                divisions: 19,
                activeColor: Theme.of(context).primaryColor,
                onChanged: isEditing ? (v) => setState(() => geofenceRadius = v) : null,
              ),
            ],
          ),

          // Family Backup
          _DetailCard(
            title: "FAMILY BACKUP",
            icon: LucideIcons.users,
            children: [
              Text(
                "Select backup contacts who will be notified if you don't respond",
                style: GoogleFonts.outfit(fontSize: 13, color: Colors.grey[600]),
              ),
              const SizedBox(height: 16),
              if (backupContacts.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    border: Border.all(color: Colors.grey[200]!, style: BorderStyle.solid),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Icon(LucideIcons.smartphone, color: Colors.grey[400]),
                      const SizedBox(height: 8),
                      Text("No backup contacts added", style: GoogleFonts.outfit(color: Colors.grey[500])),
                    ],
                  ),
                )
              else
                ...backupContacts.map((c) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey[200]!)),
                      child: Row(
                        children: [
                          CircleAvatar(backgroundColor: const Color(0xFF6366F1), radius: 16, child: Text(c['name']?[0] ?? '?', style: const TextStyle(color: Colors.white, fontSize: 12))),
                          const SizedBox(width: 12),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(c['name'] ?? '', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)), Text(c['phone'] ?? '', style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[500]))])),
                          if (isEditing) IconButton(icon: const Icon(LucideIcons.trash2, size: 16, color: Colors.red), onPressed: () => setState(() => backupContacts.remove(c))),
                        ],
                      ),
                    )),
              if (isEditing) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _addContact,
                  icon: const Icon(LucideIcons.plus, size: 16),
                  label: const Text("Add Backup Contact"),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 45),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              Text("Escalation Timeline", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text("When should backup contacts be notified?", style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600])),
              const SizedBox(height: 16),
              ...[
                {'val': 0, 'label': 'Immediately', 'sub': 'Notify contacts right away'},
                {'val': 15, 'label': '15 Minutes', 'sub': 'Wait 15 minutes before notifying'},
                {'val': 30, 'label': '30 Minutes', 'sub': 'Wait 30 minutes before notifying'},
              ].map((opt) => RadioListTile<int>(
                    value: opt['val'] as int,
                    groupValue: escalationTime,
                    title: Text(opt['label'] as String, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                    subtitle: Text(opt['sub'] as String, style: GoogleFonts.outfit(fontSize: 12)),
                    activeColor: const Color(0xFF6366F1),
                    onChanged: isEditing ? (v) => setState(() => escalationTime = v!) : null,
                  )),
            ],
          ),

          // Smart Features
          _DetailCard(
            title: "SMART FEATURES",
            icon: LucideIcons.zap,
            children: [
              _SmartFeatureTile(
                icon: LucideIcons.shieldAlert,
                label: "Early Warning System",
                sub: "Get proactive alerts when you're at risk of being late based on your current location and traffic conditions",
                value: smartFeatures['earlyWarning']!,
                onChanged: (v) => isEditing ? setState(() => smartFeatures['earlyWarning'] = v) : null,
                tag: "AI",
                tagColor: Theme.of(context).primaryColor,
              ),
              _SmartFeatureTile(
                icon: LucideIcons.car,
                label: "Traffic-Aware ETA",
                sub: "Automatically adjust reminder times based on real-time traffic data and route conditions",
                value: smartFeatures['trafficAware']!,
                onChanged: (v) => isEditing ? setState(() => smartFeatures['trafficAware'] = v) : null,
                tag: "LIVE",
                tagColor: const Color(0xFF10B981),
              ),
              _SmartFeatureTile(
                icon: LucideIcons.smartphone,
                label: "Item Exit Guards",
                sub: "Get reminded about items you need to bring when leaving a location (e.g., wallet, keys, documents)",
                value: smartFeatures['itemExitGuards']!,
                onChanged: (v) => isEditing ? setState(() => smartFeatures['itemExitGuards'] = v) : null,
                tag: "NEW",
                tagColor: const Color(0xFF8B5CF6),
              ),
            ],
          ),

          // Quick Actions
          _DetailCard(
            title: "QUICK ACTIONS",
            icon: LucideIcons.zap,
            children: [
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.2,
                children: [
                  _QuickActionButton(
                    icon: LucideIcons.checkCircle2,
                    label: "Complete",
                    color: Colors.green,
                    onTap: () {
                      setState(() => status = 'completed');
                      _handleSave();
                    },
                  ),
                  _QuickActionButton(
                    icon: LucideIcons.clock,
                    label: "Snooze 15m",
                    color: Colors.orange,
                    onTap: () {
                       // Logic for snooze could be more complex, but for parity:
                       setState(() => status = 'snoozed');
                       _handleSave();
                    },
                  ),
                  _QuickActionButton(
                    icon: LucideIcons.calendarDays,
                    label: "Reschedule",
                    color: Colors.blue,
                    onTap: () {},
                  ),
                  _QuickActionButton(
                    icon: LucideIcons.alertCircle,
                    label: "Priority: ${priority.toUpperCase()}",
                    color: priority == 'high' ? Colors.red : Colors.grey,
                    onTap: isEditing ? () {
                      final priorities = ['low', 'medium', 'high'];
                      setState(() => priority = priorities[(priorities.indexOf(priority) + 1) % 3]);
                    } : null,
                  ),
                ],
              )
            ],
          ),

          // Alert Preferences
          _DetailCard(
            title: "ALERT PREFERENCES",
            icon: LucideIcons.bellRing,
            children: [
              _AlertTile(
                icon: LucideIcons.bell,
                label: "Push Notifications",
                sub: "Receive alerts on your device",
                value: alerts['push']!,
                onChanged: (v) => isEditing ? setState(() => alerts['push'] = v) : null,
              ),
              _AlertTile(
                icon: LucideIcons.messageSquare,
                label: "SMS Backup",
                sub: "Text message for critical alerts",
                value: alerts['sms']!,
                onChanged: (v) => isEditing ? setState(() => alerts['sms'] = v) : null,
              ),
            ],
          ),

          // Timeline
          const Padding(
            padding: EdgeInsets.only(left: 4, bottom: 16),
            child: Text("Timeline", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 16),
            child: Container(
              padding: const EdgeInsets.only(left: 20, bottom: 20),
              decoration: const BoxDecoration(
                border: Border(left: BorderSide(color: Color(0xFFE2E8F0), width: 2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (timeline.isEmpty)
                    _TimelineItem(
                      title: "Reminder Created",
                      time: widget.reminder['createdAt'] != null 
                          ? _formatFullDateTime(widget.reminder['createdAt'])
                          : "Just now",
                      isFirst: true,
                    )
                  else
                    ...timeline.asMap().entries.map((e) => _TimelineItem(
                          title: e.value['action'] ?? '',
                          time: e.value['timestamp'] != null 
                              ? _formatFullDateTime(e.value['timestamp'])
                              : "",
                          isFirst: e.key == 0,
                        )),
                ],
              ),
            ),
          ),

          // Save Button (Sticky/Bottom)
          if (isEditing)
             Container(
               width: double.infinity,
               margin: const EdgeInsets.only(top: 24),
               child: ElevatedButton(
                 onPressed: _handleSave,
                 child: const Text("Save Settings"),
               ),
             ),

          const SizedBox(height: 100), // Padding for bottom
        ],
      ),
    );
  }

  String _formatFullDateTime(String dateStr) {
      try {
          final date = DateTime.parse(dateStr);
          final user = Provider.of<UserProvider>(context, listen: false).user;
          final dFormat = user['dateFormat'] ?? 'DD/MM/YYYY';
          final tFormat = user['timeFormat'] ?? '12';
          return "${DateFormatter.formatDate(date, format: dFormat)} • ${DateFormatter.formatTime(date, format: tFormat)}";
      } catch (e) {
          return dateStr;
      }
  }

  String _getAdjustedTime() {
    if (timeController.text.isEmpty || !timeController.text.contains(':')) return "--:--";
    try {
      final parts = timeController.text.split(':');
      final now = DateTime.now();
      // Parsing logic assumes HH:mm input from timeController (standard TimeOfDay format usually)
      // But if timeController contains AM/PM, int.parse might fail.
      // Let's assume standard HH:mm for simplicity or try to parse flexibly.
      int hour = int.parse(parts[0].trim());
      int minute = int.parse(parts[1].split(' ')[0].trim()); // handle potential " PM"
      
      if (timeController.text.toLowerCase().contains('pm') && hour < 12) hour += 12;
      
      final target = DateTime(now.year, now.month, now.day, hour, minute);
      final adjusted = target.subtract(Duration(minutes: bufferTime.toInt()));
      
      final user = Provider.of<UserProvider>(context, listen: false).user;
      return DateFormatter.formatTime(adjusted, format: user['timeFormat'] ?? '12');
    } catch (e) {
      return "--:--";
    }
  }

  void _addContact() {
    showDialog(
      context: context,
      builder: (ctx) {
        final nameC = TextEditingController();
        final phoneC = TextEditingController();
        return AlertDialog(
          title: const Text("New Contact"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameC, decoration: const InputDecoration(labelText: "Name")),
              TextField(controller: phoneC, decoration: const InputDecoration(labelText: "Phone")),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
            TextButton(
              onPressed: () {
                if (nameC.text.isNotEmpty && phoneC.text.isNotEmpty) {
                  setState(() => backupContacts.add({'name': nameC.text, 'phone': phoneC.text}));
                  Navigator.pop(ctx);
                }
              },
              child: const Text("Add"),
            ),
          ],
        );
      },
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  const _StatusBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    final isGreen = label == "On Track" || label == "Completed";
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isGreen ? const Color(0xFFDCFCE7) : const Color(0xFFFEF9C3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          color: isGreen ? const Color(0xFF16A34A) : const Color(0xFFCA8A04),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Widget child;

  const _InfoRow({required this.icon, required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 18, color: Theme.of(context).primaryColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey[800])),
              DefaultTextStyle(
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[600]),
                child: child,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DetailCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;

  const _DetailCard({required this.title, required this.icon, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: Row(
                children: [
                  Icon(icon, size: 16, color: const Color(0xFF1E293B)),
                  const SizedBox(width: 10),
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SmartFeatureTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Function(bool) onChanged;
  final String tag;
  final Color tagColor;

  const _SmartFeatureTile({
    required this.icon,
    required this.label,
    required this.sub,
    required this.value,
    required this.onChanged,
    required this.tag,
    required this.tagColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: tagColor.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 20, color: tagColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Row(
                        children: [
                          Flexible(
                            child: Text(
                              label,
                              style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: tagColor, borderRadius: BorderRadius.circular(6)),
                            child: Text(tag, style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800)),
                          ),
                        ],
                      ),
                    ),
                    Transform.scale(
                      scale: 0.8,
                      child: Switch.adaptive(
                        value: value,
                        onChanged: onChanged,
                      ),
                    ),
                  ],
                ),
                Text(sub, style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey[600], height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  const _QuickActionButton({required this.icon, required this.label, required this.color, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          border: Border.all(color: color.withOpacity(0.2)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(label, style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w700, color: color), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Function(bool) onChanged;

  const _AlertTile({required this.icon, required this.label, required this.sub, required this.value, required this.onChanged});

  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: const Color(0xFF3B82F6), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                Text(
                  sub,
                  style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[500]),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Transform.scale(
            scale: 0.8,
            child: Switch.adaptive(
              value: value,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineItem extends StatelessWidget {
  final String title;
  final String time;
  final bool isFirst;

  const _TimelineItem({required this.title, required this.time, this.isFirst = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            left: -26,
            top: 4,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: Theme.of(context).primaryColor, width: 2),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 14)),
              Text(time, style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey[500])),
            ],
          ),
        ],
      ),
    );
  }
}
