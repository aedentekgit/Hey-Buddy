import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

/// JSX-style reminder card with left-color-border design.
/// Used in [ReminderListScreen] and similar contexts.
class MobileTaskCard extends StatelessWidget {
  final String title;
  final String status;
  final String variant; // 'green', 'orange', 'danger'
  final String? date;
  final String time;
  final String location;
  final String? distance;
  final String? eta;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onView;
  final VoidCallback? onShare;
  final bool earlyWarningActive;
  final IconData? headerIcon;

  const MobileTaskCard({
    super.key,
    required this.title,
    required this.status,
    required this.variant,
    this.date,
    required this.time,
    required this.location,
    this.distance,
    this.eta,
    this.onEdit,
    this.onDelete,
    this.onView,
    this.onShare,
    this.earlyWarningActive = false,
    this.headerIcon,
  });

  Color get _baseColor {
    switch (variant) {
      case 'danger':
        return AppColors.danger;
      case 'orange':
        return AppColors.orange;
      default:
        return AppColors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _baseColor;
    final bool hasLocation =
        location.isNotEmpty && location != 'No Location';

    return GestureDetector(
      onTap: onView,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: AppColors.cardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(15),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left color stripe
                Container(width: 4, color: color),
                // Card content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 16, 14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Icon ──────────────────────────────────────────
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                color.withOpacity(0.18),
                                color.withOpacity(0.08),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: color.withOpacity(0.25)),
                          ),
                          child: Icon(
                              headerIcon ?? LucideIcons.bell, color: color, size: 22),
                        ),
                        const SizedBox(width: 13),

                        // ── Content ─────────────────────────────────────
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Title + chevron
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      title,
                                      style: GoogleFonts.nunito(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 14.5,
                                          color: AppColors.text),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Icon(LucideIcons.chevronRight,
                                      size: 13, color: color),
                                ],
                              ),
                              const SizedBox(height: 3),

                              // Time / date
                              Row(
                                children: [
                                  Icon(LucideIcons.clock,
                                      size: 12, color: AppColors.textDim),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      date != null ? '$time · $date' : time,
                                      style: GoogleFonts.inter(
                                          fontSize: 12, color: AppColors.textMid),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),

                              // Location
                              if (hasLocation) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(LucideIcons.mapPin,
                                        size: 12, color: AppColors.accent),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        location,
                                        style: GoogleFonts.inter(
                                            fontSize: 11.5,
                                            color: AppColors.textMid),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    if (eta != null) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: AppColors.accent.withOpacity(0.12),
                                          borderRadius: BorderRadius.circular(4),
                                          border: Border.all(
                                              color: AppColors.accent.withOpacity(0.2)),
                                        ),
                                        child: Text(
                                          'ETA $eta',
                                          style: GoogleFonts.inter(
                                              fontSize: 9,
                                              fontWeight: FontWeight.w800,
                                              color: AppColors.accent),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ],

                              // Distance / ETA stats row (no location label)
                              if (distance != null && eta != null && !hasLocation) ...[
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 10, horizontal: 14),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(
                                        color: const Color(0xFFF1F5F9)),
                                  ),
                                  child: Row(
                                    children: [
                                      _statItem(
                                          LucideIcons.navigation, 'Distance', distance!),
                                      Container(
                                          width: 1,
                                          height: 28,
                                          color: const Color(0xFFE2E8F0)),
                                      _statItem(LucideIcons.zap, 'ETA', eta!,
                                          iconColor: AppColors.accent),
                                    ],
                                  ),
                                ),
                              ],

                              const SizedBox(height: 9),

                              // Bottom row: status chip + action buttons
                              Row(
                                children: [
                                  _Chip(label: status, color: color, small: true),
                                  const Spacer(),
                                  if (onEdit != null)
                                    _iconBtn(LucideIcons.pencil,
                                        AppColors.textMid, AppColors.bg, onEdit!),
                                  const SizedBox(width: 8),
                                  if (onDelete != null)
                                    _iconBtn(LucideIcons.trash2, AppColors.danger,
                                        AppColors.dangerLight, onDelete!),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statItem(IconData icon, String label, String value,
      {Color? iconColor}) {
    return Expanded(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 14,
                  color: iconColor ?? const Color(0xFF64748B)),
              const SizedBox(width: 6),
              Text(label,
                  style: GoogleFonts.outfit(
                      color: const Color(0xFF64748B),
                      fontSize: 12,
                      fontWeight: FontWeight.w500)),
            ],
          ),
          const SizedBox(height: 4),
          Text(value,
              style: GoogleFonts.outfit(
                  color: const Color(0xFF0F172A),
                  fontSize: 16,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _iconBtn(
      IconData icon, Color iconColor, Color bg, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: iconColor.withOpacity(0.2)),
        ),
        child: Icon(icon, size: 14, color: iconColor),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;
  final bool small;
  const _Chip(
      {required this.label, required this.color, this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
          horizontal: small ? 8 : 11, vertical: small ? 2 : 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: small ? 10 : 11,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
