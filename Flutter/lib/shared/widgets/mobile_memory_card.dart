import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class MobileMemoryCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onView;
  final VoidCallback onEdit;
  final VoidCallback? onDelete;
  final int index;

  const MobileMemoryCard({
    super.key,
    required this.item,
    required this.onView,
    required this.onEdit,
    this.onDelete,
    this.index = 0,
  });

  @override
  Widget build(BuildContext context) {
    final String type = item['type'] ?? 'memory';
    final bool isMemory = type == 'memory';

    // 6-color rotating palette for memory cards
    const List<List<Color>> memoryPalettes = [
      // 0 - Purple
      [
        Color(0xFFF3E8FF),
        Color(0xFFD8B4FE),
        Color(0xFFE9D5FF),
        Color(0xFF9333EA),
      ],
      // 1 - Rose
      [
        Color(0xFFFFF1F2),
        Color(0xFFFECACC),
        Color(0xFFFFE4E6),
        Color(0xFFE11D48),
      ],
      // 2 - Amber
      [
        Color(0xFFFFFBEB),
        Color(0xFFFDE68A),
        Color(0xFFFEF3C7),
        Color(0xFFD97706),
      ],
      // 3 - Teal
      [
        Color(0xFFEFFAF6),
        Color(0xFFACE0D6),
        Color(0xFFCAECE1),
        Color(0xFF0D9488),
      ],
      // 4 - Indigo
      [
        Color(0xFFEEF2FF),
        Color(0xFFC7D2FE),
        Color(0xFFE0E7FF),
        Color(0xFF4F46E5),
      ],
      // 5 - Emerald
      [
        Color(0xFFECFDF5),
        Color(0xFF6EE7B7),
        Color(0xFFD1FAE5),
        Color(0xFF059669),
      ],
    ];

    final palette = isMemory
        ? memoryPalettes[index % memoryPalettes.length]
        : [
            const Color(0xFFEFFAF6),
            const Color(0xFFACE0D6),
            const Color(0xFFCAECE1),
            const Color(0xFF88B5A8),
          ];

    final Color activeBg = palette[0];
    final Color activeBorder = palette[1];
    final Color activeIconBg = palette[2];
    final Color activePrimary = palette[3];
    final IconData icon = isMemory ? LucideIcons.database : LucideIcons.fileText;

    // Button Styles - match the palette primary color
    final Color viewBtnBg = activeBg;
    final Color viewBtnBorder = activeIconBg;
    final Color viewBtnText = activePrimary;

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
        return DateFormatter.formatDate(
          DateTime.parse(dateStr),
          format: dateFormat,
        );
      } catch (e) {
        return dateStr;
      }
    }

    final String date = formatDate(item['createdAt']);
    final dynamic extracted = item['extractedData'];
    final String? patientName = (!isMemory && extracted != null)
        ? extracted['patientName']
        : null;
    final String? doctorName = (!isMemory && extracted != null)
        ? extracted['doctorName']
        : null;
    final String? contentTeaser =
        isMemory && (item['content']?.length ?? 0) > 80
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
            color: Colors.black.withValues(alpha: 0.05),
            offset: const Offset(0, 1),
            blurRadius: 2,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(
          16.5,
        ), // Slightly inset to stay inside border
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
                    width: 36,
                      height: 36,
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
                            Icon(
                              LucideIcons.calendar,
                              size: 10,
                              color: const Color(0xFF64748B),
                            ),
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
                          child: Icon(
                            LucideIcons.trash2,
                            size: 16,
                            color: Color(0xFFEF4444),
                          ),
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
                        // Attachment thumbnail strip
                        if (item['fileUrl'] != null &&
                            (item['fileUrl'] as String).isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(10),
                                child: CachedNetworkImage(
                                  imageUrl:
                                      AppConfig.formatImageUrl(
                                        item['fileUrl'] as String?,
                                      ) ??
                                      '',
                                  height: 90,
                                  width: double.infinity,
                                  fit: BoxFit.cover,
                                  placeholder: (ctx, url) => Container(
                                    height: 90,
                                    decoration: BoxDecoration(
                                      color: Colors.grey[100],
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Center(
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  ),
                                  errorWidget: (ctx, url, err) => Container(
                                    height: 60,
                                    decoration: BoxDecoration(
                                      color: Colors.grey[100],
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        Icon(
                                          LucideIcons.fileText,
                                          size: 16,
                                          color: Colors.grey[400],
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Attachment',
                                          style: GoogleFonts.outfit(
                                            fontSize: 11,
                                            color: Colors.grey[400],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 6,
                                right: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.6),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        LucideIcons.paperclip,
                                        size: 9,
                                        color: Colors.white,
                                      ),
                                      const SizedBox(width: 3),
                                      Text(
                                        'Attachment',
                                        style: GoogleFonts.outfit(
                                          fontSize: 9,
                                          color: Colors.white,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
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
