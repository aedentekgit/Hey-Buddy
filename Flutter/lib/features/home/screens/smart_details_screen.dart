import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/widgets/smart_details_panel.dart';

class SmartDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> task;
  final bool isEditMode;

  const SmartDetailsScreen({
    super.key,
    required this.task,
    this.isEditMode = false,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          Container(
            color: AppColors.surface,
            child: SafeArea(
              bottom: false,
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border(bottom: BorderSide(color: AppColors.border)),
                ),
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(
                          LucideIcons.arrowLeft,
                          size: 18,
                          color: AppColors.text,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isEditMode ? 'Edit Settings' : 'Smart Details',
                            style: GoogleFonts.nunito(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                            ),
                          ),
                          Text(
                            'Location-based reminder',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.textMid,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: SmartDetailsPanel(
              reminder: task,
              initialEditMode: isEditMode,
            ),
          ),
        ],
      ),
    );
  }
}
