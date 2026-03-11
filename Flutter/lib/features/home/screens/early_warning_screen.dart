import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';
import 'package:buddy_mobile/features/home/screens/location_reminder_create_screen.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';

/// Dedicated Early Warning detail screen for location reminders.
/// Shows reminder info, warning level selector, and notification options
/// without relying on the backend (since location reminders are static/demo data).
class EarlyWarningScreen extends StatefulWidget {
  final Map<String, dynamic> reminder;

  const EarlyWarningScreen({super.key, required this.reminder});

  @override
  State<EarlyWarningScreen> createState() => _EarlyWarningScreenState();
}

class _EarlyWarningScreenState extends State<EarlyWarningScreen> {
  bool _earlyWarningSubscribed = true;
  bool _trafficAwareEnabled = true;
  bool _itemExitGuardsEnabled = true;
  bool _notifyEmail = true;
  double _bufferMinutes = 15.0;
  String _warningLevel = 'medium';
  bool _notifyPhone = true;
  bool _notifyFamily = false;
  bool _notifyEmergency = false;

  @override
  void initState() {
    super.initState();
    final r = widget.reminder;
    _bufferMinutes = (r['bufferTime'] ?? 15).toDouble();
    _warningLevel = r['warningLevel'] ?? 'medium';
    _notifyPhone = r['notifyPhone'] ?? true;
    _notifyFamily = r['notifyFamily'] ?? false;
    _notifyEmergency = r['notifyEmergency'] ?? false;
    _notifyEmail = r['notifyEmail'] ?? true;
    _earlyWarningSubscribed = r['earlyWarningSet'] ?? true;
    _trafficAwareEnabled = r['trafficAware'] ?? true;
    _itemExitGuardsEnabled = r['itemExitGuards'] ?? true;
  }

  bool get isDanger => widget.reminder['status'] == 'RISK_ALERT';

  Color get _accentColor =>
      isDanger ? const Color(0xFFE11D48) : const Color(0xFF10B981);

  String get _adjustedTime {
    final rawTime = widget.reminder['time'] ?? '';
    if (rawTime.isEmpty) return 'whenever I arrive';
    try {
      final parts = rawTime.split(':');
      int hour = int.parse(parts[0].trim());
      final minSecPart = parts[1].trim();
      final minStr = minSecPart.substring(0, 2);
      final suffix = minSecPart.length > 2 ? minSecPart.substring(2).trim() : '';
      int minute = int.parse(minStr);

      // Apply buffer
      int totalMin = (hour * 60 + minute) - _bufferMinutes.toInt();
      if (suffix.toUpperCase() == 'PM' && hour != 12) totalMin += 12 * 60;
      if (suffix.toUpperCase() == 'AM' && hour == 12) totalMin -= 12 * 60;
      if (totalMin < 0) totalMin += 24 * 60;

      final adjHour = (totalMin ~/ 60) % 24;
      final adjMin = totalMin % 60;
      return DateFormatter.displayTimeString(
          context, '${adjHour.toString().padLeft(2, '0')}:${adjMin.toString().padLeft(2, '0')}');
    } catch (_) {
      return rawTime;
    }
  }

  @override
  Widget build(BuildContext context) {
    final reminder = widget.reminder;
    final title = reminder['title'] ?? 'Reminder';
    final location = reminder['location'] ?? 'No Location';
    final date = DateFormatter.displayDateString(context, reminder['date']);
    final timeStr = reminder['time'];
    final time = (timeStr != null && timeStr.toString().isNotEmpty)
        ? DateFormatter.displayTimeString(context, timeStr.toString())
        : 'Whenever I arrive';
    final dateTime = '$date  •  $time';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'Smart Details',
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
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header Actions ─────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                   _StatusBadge(label: reminder['status'] == 'completed' ? "Completed" : "On Track"),
                   _EditSettingsButton(onPressed: _onEditReminder),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                title,
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 24),

              // ── Meta Info Rows ─────────────────────────────────────
              _InfoRow(
                icon: LucideIcons.mapPin,
                label: "Location",
                child: Text(location),
              ),
              const SizedBox(height: 12),
              _InfoRow(
                icon: LucideIcons.clock,
                label: "Schedule",
                child: Text(dateTime),
              ),
              const SizedBox(height: 32),

              // ── Smart Features ─────────────────────────────────────
              _DetailCard(
                title: "SMART FEATURES",
                icon: LucideIcons.zap,
                children: [
                  _SmartFeatureTile(
                    icon: LucideIcons.shieldAlert,
                    label: "Early Warning System",
                    sub: "Get proactive alerts when you're at risk of being late based on your current location and traffic conditions",
                    value: _earlyWarningSubscribed,
                    onChanged: (v) {
                      setState(() => _earlyWarningSubscribed = v);
                      _onSave(silent: true);
                    },
                    tag: "AI",
                    tagColor: Theme.of(context).primaryColor,
                  ),
                  _SmartFeatureTile(
                    icon: LucideIcons.car,
                    label: "Traffic-Aware ETA",
                    sub: "Automatically adjust reminder times based on real-time traffic data and route conditions",
                    value: _trafficAwareEnabled,
                    onChanged: (v) {
                      setState(() => _trafficAwareEnabled = v);
                      _onSave(silent: true);
                    },
                    tag: "LIVE",
                    tagColor: const Color(0xFF10B981),
                  ),
                  _SmartFeatureTile(
                    icon: LucideIcons.smartphone,
                    label: "Item Exit Guards",
                    sub: "Get reminded about items you need to bring when leaving a location (e.g., wallet, keys, documents)",
                    value: _itemExitGuardsEnabled,
                    onChanged: (v) {
                      setState(() => _itemExitGuardsEnabled = v);
                      _onSave(silent: true);
                    },
                    tag: "NEW",
                    tagColor: const Color(0xFF8B5CF6),
                  ),
                ],
              ),

              // ── Alert Preferences ──────────────────────────────────
              _DetailCard(
                title: "ALERT PREFERENCES",
                icon: LucideIcons.bellRing,
                children: [
                  _AlertTile(
                    icon: LucideIcons.bell,
                    label: "Push Notifications",
                    sub: "Receive alerts on your device",
                    value: _notifyPhone,
                    onChanged: (v) {
                      setState(() => _notifyPhone = v);
                      _onSave(silent: true);
                    },
                  ),
                  _AlertTile(
                    icon: LucideIcons.mail,
                    label: "Email Alerts",
                    sub: "Detailed reports via email",
                    value: _notifyEmail,
                    onChanged: (v) {
                      setState(() => _notifyEmail = v);
                      _onSave(silent: true);
                    },
                  ),
                  _AlertTile(
                    icon: LucideIcons.users,
                    label: "Family Notifications",
                    sub: "Notify household members",
                    value: _notifyFamily,
                    onChanged: (v) {
                      setState(() => _notifyFamily = v);
                      _onSave(silent: true);
                    },
                  ),
                  _AlertTile(
                    icon: LucideIcons.shieldAlert,
                    label: "Emergency Alerts",
                    sub: "Direct alerts to emergency contacts",
                    value: _notifyEmergency,
                    onChanged: (v) {
                      setState(() => _notifyEmergency = v);
                      _onSave(silent: true);
                    },
                  ),
                ],
              ),

              // ── Time & Buffer Section (Moved down) ──────────────────
              _DetailCard(
                title: "TIME & BUFFER CONFIG",
                icon: LucideIcons.clock,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Safety Buffer Time',
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          '${_bufferMinutes.toInt()} min',
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF6366F1),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: const Color(0xFF6366F1),
                      inactiveTrackColor: const Color(0xFFE2E8F0),
                      thumbColor: const Color(0xFF6366F1),
                      overlayColor: const Color(0xFF6366F1).withOpacity(0.12),
                      trackHeight: 4,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                    ),
                    child: Slider(
                      value: _bufferMinutes,
                      min: 5,
                      max: 120,
                      divisions: 23,
                      onChanged: (v) {
                        setState(() => _bufferMinutes = v);
                        _onSave(silent: true);
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F3FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE0E7FF)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: const Color(0xFF6366F1).withOpacity(0.15),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(LucideIcons.bell, size: 18, color: Color(0xFF6366F1)),
                        ),
                        const SizedBox(width: 14),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'ADJUSTED NOTIFICATION',
                              style: GoogleFonts.outfit(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF6366F1),
                                letterSpacing: 0.8,
                              ),
                            ),
                            Text(
                              _adjustedTime,
                              style: GoogleFonts.outfit(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF1E293B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _onEditReminder() async {
    final updated = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => LocationReminderCreateScreen(reminder: widget.reminder),
      ),
    );
    if (updated == true && mounted) {
      Navigator.pop(context);
    }
  }

  Future<void> _onSave({bool silent = false}) async {
    final id = widget.reminder['_id'];

    await context.read<LocationRemindersProvider>().setEarlyWarning(id, {
      'bufferTime': _bufferMinutes.toInt(),
      'warningLevel': _warningLevel,
      'notifyPhone': _notifyPhone,
      'notifyFamily': _notifyFamily,
      'notifyEmergency': _notifyEmergency,
      'notifyEmail': _notifyEmail,
      'earlyWarningSet': _earlyWarningSubscribed,
      'trafficAware': _trafficAwareEnabled,
      'itemExitGuards': _itemExitGuardsEnabled,
    });

    if (!silent && mounted) {
      Navigator.pop(context);
    }
  }
}

class _EditSettingsButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _EditSettingsButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F3FF),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE0E7FF)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(LucideIcons.pencil, size: 14, color: Color(0xFF7C3AED)),
            const SizedBox(width: 6),
            Text(
              "Edit Settings",
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF7C3AED),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Reusable Component Classes (matching SmartDetailsPanel) ───────────

class _StatusBadge extends StatelessWidget {
  final String label;
  const _StatusBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    final isGreen = label.toLowerCase() == "on track" || label.toLowerCase() == "completed";
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isGreen ? const Color(0xFFDCFCE7) : const Color(0xFFFEF9C3),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label.toUpperCase(),
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
          child: Icon(icon, size: 18, color: const Color(0xFF6366F1)),
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

class _AlertTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sub;
  final bool value;
  final Function(bool) onChanged;

  const _AlertTile({required this.icon, required this.label, required this.sub, required this.value, required this.onChanged});

  @override
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
