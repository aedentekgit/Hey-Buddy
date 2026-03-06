import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
class MobileMemoryCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback? onDelete;

  const MobileMemoryCard({
    super.key,
    required this.item,
    required this.onView,
    required this.onEdit,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final String type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';

    // Exact HEX colors from Web MobileMemoryCard.jsx
    final Color purpleBg = const Color(0xFFF3E8FF);
    final Color purpleBorder = const Color(0xFFD8B4FE);
    final Color purpleIconBg = const Color(0xFFE9D5FF);
    final Color purpleIconColor = const Color(0xFF9333EA);

    final Color greenBg = const Color(0xFFEFFAF6);
    final Color greenBorder = const Color(0xFFACE0D6);
    final Color greenIconBg = const Color(0xFFCAECE1);
    final Color greenIconColor = const Color(0xFF88B5A8);

    // Active Styles
    final Color activeBg = isMemory ? purpleBg : greenBg;
    final Color activeBorder = isMemory ? purpleBorder : greenBorder;
    final Color activeIconBg = isMemory ? purpleIconBg : greenIconBg;
    final Color activePrimary = isMemory ? purpleIconColor : greenIconColor;
    final IconData icon = isMemory ? LucideIcons.brain : LucideIcons.fileText;

    // Button Styles
    final Color viewBtnBg = isMemory ? const Color(0xFFFAF5FF) : const Color(0xFFF0FDF4);
    final Color viewBtnBorder = isMemory ? const Color(0xFFE9D5FF) : const Color(0xFFBBF7D0);
    final Color viewBtnText = isMemory ? const Color(0xFF9333EA) : const Color(0xFF16A34A);

    final Color editBtnBg = const Color(0xFFEFF6FF);
    final Color editBtnBorder = const Color(0xFFBFDBFE);
    final Color editBtnText = const Color(0xFF1D4ED8);

    // Data Preparation
    final String title = isMemory
        ? (item['content'] ?? 'No Content')
        : (item['fileName'] ?? 'Medical Document');



    final user = Provider.of<UserProvider>(context, listen: false).user;
    final dateFormat = user['dateFormat'] ?? 'DD/MM/YYYY';

    String formatDate(String? dateStr) {
       if (dateStr == null) return '';
       try {
         return DateFormatter.formatDate(DateTime.parse(dateStr), format: dateFormat);
       } catch (e) {
         return dateStr;
       }
    }

    final String date = formatDate(item['createdAt']);
    final dynamic extracted = item['extractedData'];
    final String? patientName = (!isMemory && extracted != null) ? extracted['patientName'] : null;
    final String? doctorName = (!isMemory && extracted != null) ? extracted['doctorName'] : null;
    final String? contentTeaser = isMemory && (item['content']?.length ?? 0) > 80
        ? "${(item['content'] as String).substring(0, 120)}..."
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: activeBg,
        border: Border.all(color: activeBorder, width: 1.5),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16.5), // Slightly inset to stay inside border
        child: Column(
          children: [
            // Header Section (Tinted Background)
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Icon Box
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: activeIconBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: activePrimary, size: 20),
                  ),
                  const SizedBox(width: 14),

                  // Title & Subtitles
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 2),
                        Text(
                          title,
                          maxLines: isMemory ? 2 : 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFF1E293B),
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            if (patientName != null) ...[
                              Text(
                                patientName,
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Icon(LucideIcons.calendar, size: 10, color: const Color(0xFF64748B)),
                            const SizedBox(width: 4),
                            Text(
                              date,
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Delete Button
                  if (onDelete != null)
                    Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onDelete,
                        borderRadius: BorderRadius.circular(20),
                        child: const Padding(
                          padding: EdgeInsets.all(4.0),
                          child: Icon(LucideIcons.trash2, size: 16, color: Color(0xFFEF4444)),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Content Body (White Background)
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(18),
                  topRight: Radius.circular(18),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Extra Details
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (doctorName != null)
                          Row(
                            children: [
                              Text(
                                "DOCTOR: ",
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF64748B),
                                ),
                              ),
                              Text(
                                doctorName,
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  color: const Color(0xFF1E293B),
                                ),
                              ),
                            ],
                          )
                        else if (contentTeaser != null)
                          Text(
                            contentTeaser,
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              color: const Color(0xFF475569),
                              height: 1.5,
                            ),
                          )
                        else if (!isMemory)
                          Text(
                            "Tap view to see document details",
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              color: const Color(0xFF94A3B8),
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                      ],
                    ),
                  ),

                  // Divider
                  Container(height: 1, color: const Color(0xFFF1F5F9)),

                  // Action Buttons
                  Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Expanded(
                          child: _ActionButton(
                            text: "View",
                            icon: LucideIcons.eye,
                            color: viewBtnText,
                            bgColor: viewBtnBg,
                            borderColor: viewBtnBorder,
                            onTap: onView,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _ActionButton(
                            text: "Edit",
                            icon: LucideIcons.edit2,
                            color: editBtnText,
                            bgColor: editBtnBg,
                            borderColor: editBtnBorder,
                            onTap: onEdit,
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
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color color;
  final Color bgColor;
  final Color borderColor;
  final VoidCallback onTap;

  const _ActionButton({
    required this.text,
    required this.icon,
    required this.color,
    required this.bgColor,
    required this.borderColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 8),
              Text(
                text,
                style: GoogleFonts.outfit(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
