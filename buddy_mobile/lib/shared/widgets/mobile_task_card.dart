import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';

class MobileTaskCard extends StatelessWidget {
  final String title;
  final String status;
  final String variant; // 'green', 'orange', 'danger'
  final String time;
  final String location;
  final String? distance;
  final String? eta;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final VoidCallback? onView;
  final VoidCallback? onShare;
  final bool earlyWarningActive;

  const MobileTaskCard({
    super.key,
    required this.title,
    required this.status,
    required this.variant,
    required this.time,
    required this.location,
    this.distance,
    this.eta,
    this.onEdit,
    this.onDelete,
    this.onView,
    this.onShare,
    this.earlyWarningActive = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primaryColor = theme.primaryColor;

    final bool isGreen = variant == 'green';
    final bool isDanger = variant == 'danger';
    final bool isOrange = variant == 'orange';

    // Base colors for variants
    Color baseColor;
    if (isDanger) {
      baseColor = const Color(0xFFE11D48);
    } else if (isOrange) {
      baseColor = const Color(0xFFEA580C);
    } else {
      // Use branding primary color for green variant
      baseColor = primaryColor;
    }

    // Dynamic color variations
    final Color bgColor = isGreen 
        ? baseColor.withOpacity(0.06) // Very light version of primary
        : isDanger 
            ? const Color(0xFFFFE4E6) 
            : const Color(0xFFFFF9F0);
            
    final Color borderColor = isGreen 
        ? baseColor.withOpacity(0.2) // Subtle border of primary
        : isDanger 
            ? const Color(0xFFFECDD3) 
            : const Color(0xFFFEE2A0);

    final Color iconBgColor = isGreen 
        ? baseColor.withOpacity(0.12) 
        : isDanger 
            ? const Color(0xFFFECDD3).withOpacity(0.5)
            : const Color(0xFFFBE7C6);

    final Color iconColor = isGreen 
        ? baseColor
        : isDanger 
            ? const Color(0xFFE11D48) 
            : const Color(0xFFD6B08A);

    final Color badgeColor = isGreen 
        ? baseColor
        : isDanger 
            ? const Color(0xFFE11D48) 
            : const Color(0xFFEA580C);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header Section
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(LucideIcons.helpCircle, size: 20, color: iconColor),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: GoogleFonts.outfit(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFF1E293B),
                          height: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                            decoration: BoxDecoration(
                              color: badgeColor,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              status,
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          if (earlyWarningActive) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF6366F1).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.2)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(LucideIcons.shieldAlert, size: 10, color: Color(0xFF6366F1)),
                                  const SizedBox(width: 4),
                                  Text(
                                    "PROACTIVE",
                                    style: GoogleFonts.outfit(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF6366F1),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          if (isDanger) ...[
                            const SizedBox(width: 8),
                            const Text(
                              "!",
                              style: TextStyle(
                                color: Color(0xFFE11D48),
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onDelete,
                  icon: const Icon(LucideIcons.trash2, size: 16, color: Color(0xFFEF4444)),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
          ),

          // Main Content Area (White background section)
          Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(18), bottom: Radius.circular(18)),
            ),
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(LucideIcons.clock, size: 18, color: Color(0xFF1E293B)),
                          const SizedBox(width: 12),
                          Text(
                            time,
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: const Color(0xFF1E293B),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Icon(LucideIcons.mapPin, size: 18, color: Color(0xFF1E293B)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              location,
                              style: GoogleFonts.outfit(
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF1E293B),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Stats Box (Distance & ETA)
                if (distance != null && eta != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFDBEAFE)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              children: [
                                Icon(LucideIcons.helpCircle, size: 14, color: Colors.blueGrey[200]),
                                Text(
                                  "DISTANCE",
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF64748B),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                Text(
                                  distance!,
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF1E293B),
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            width: 1,
                            height: 32,
                            color: const Color(0xFFCBD5E1),
                            margin: const EdgeInsets.symmetric(horizontal: 8),
                          ),
                          Expanded(
                            child: Column(
                              children: [
                                const Icon(LucideIcons.car, size: 16, color: Color(0xFF3B82F6)),
                                Text(
                                  "ETA",
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF64748B),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                Text(
                                  eta!,
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF1E293B),
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                const Divider(height: 1, color: Color(0xFFF1F5F9)),

                // Action Buttons
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: onView,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFF7ED),
                              border: Border.all(color: const Color(0xFFFED7AA)),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(LucideIcons.alertTriangle, size: 14, color: Color(0xFFEA580C)),
                                const SizedBox(width: 8),
                                Text(
                                  "Early Warning",
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFFC2410C),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: InkWell(
                          onTap: onShare,
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6FF),
                              border: Border.all(color: const Color(0xFFBFDBFE)),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(LucideIcons.users, size: 14, color: Color(0xFF2563EB)),
                                const SizedBox(width: 8),
                                Text(
                                  "Family Backup",
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF1D4ED8),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
