import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/shared/widgets/pressable.dart';

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
  final bool isHighPriority;
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
    this.isHighPriority = false,
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
    final bool hasLocation = location.isNotEmpty && location != 'No Location';

    return Pressable(
      onTap: onView,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: AppColors.cardShadow,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left color stripe
                Container(width: 5, color: color),
                // Card content
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 16, 16, 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Icon ──────────────────────────────────────────
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                color.withOpacity(0.15),
                                color.withOpacity(0.05),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(15),
                            border: Border.all(color: color.withOpacity(0.2)),
                          ),
                          child: Icon(
                            headerIcon ?? LucideIcons.bell,
                            color: color,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 14),

                        // ── Content ─────────────────────────────────────
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Top Row: Title + Status Chip
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Text(
                                      title,
                                      style: GoogleFonts.nunito(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                        color: AppColors.text,
                                        height: 1.2,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  if (isHighPriority) ...[
                                    _badgeIcon(
                                      LucideIcons.flag,
                                      AppColors.danger,
                                    ),
                                    const SizedBox(width: 6),
                                  ],
                                  _Chip(
                                    label: status,
                                    color: color,
                                    small: true,
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),

                              // Time / date
                              Row(
                                children: [
                                  Icon(
                                    LucideIcons.clock,
                                    size: 13,
                                    color: AppColors.textDim,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    date != null ? '$time · $date' : time,
                                    style: GoogleFonts.inter(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: AppColors.textMid,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),

                              // Location + distance/eta
                              if (hasLocation) ...[
                                Row(
                                  children: [
                                    Icon(
                                      LucideIcons.mapPin,
                                      size: 12,
                                      color: AppColors.accent.withOpacity(0.8),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        location,
                                        style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: AppColors.textMid,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    if (eta != null) ...[
                                      const SizedBox(width: 10),
                                      _badge('ETA $eta', AppColors.accent),
                                    ],
                                  ],
                                ),
                              ] else if (distance != null && eta != null) ...[
                                Row(
                                  children: [
                                    _badge(distance!, AppColors.textMid),
                                    const SizedBox(width: 8),
                                    _badge('ETA $eta', AppColors.accent),
                                  ],
                                ),
                              ],

                              const SizedBox(height: 12),

                              // Action row
                              Row(
                                children: [
                                  if (onShare != null)
                                    _actionBtn(
                                      LucideIcons.share2,
                                      "Share",
                                      onShare!,
                                    ),
                                  const Spacer(),
                                  if (onEdit != null)
                                    _iconBtn(
                                      LucideIcons.pencil,
                                      AppColors.textMid,
                                      AppColors.bg,
                                      onEdit!,
                                    ),
                                  if (onEdit != null && onDelete != null)
                                    const SizedBox(width: 10),
                                  if (onDelete != null)
                                    _iconBtn(
                                      LucideIcons.trash2,
                                      AppColors.danger,
                                      AppColors.dangerLight,
                                      onDelete!,
                                    ),
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

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }

  Widget _badgeIcon(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: color),
          const SizedBox(width: 3),
          Text(
            'HIGH',
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(IconData icon, String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: AppColors.textMid),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.textMid,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statItem(
    IconData icon,
    String label,
    String value, {
    Color? iconColor,
  }) {
    return Expanded(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: iconColor ?? const Color(0xFF64748B)),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.outfit(
                  color: const Color(0xFF64748B),
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.outfit(
              color: const Color(0xFF0F172A),
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _iconBtn(
    IconData icon,
    Color iconColor,
    Color bg,
    VoidCallback onTap,
  ) {
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
  const _Chip({required this.label, required this.color, this.small = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: small ? 8 : 11,
        vertical: small ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label.replaceAll('_', ' ').toUpperCase(),
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
