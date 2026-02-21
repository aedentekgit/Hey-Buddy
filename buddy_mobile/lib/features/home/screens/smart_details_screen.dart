
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/features/home/widgets/smart_details_panel.dart';

class SmartDetailsScreen extends StatelessWidget {
  final Map<String, dynamic> task;
  final bool isEditMode;

  const SmartDetailsScreen({super.key, required this.task, this.isEditMode = false});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isEditMode ? "Edit Settings" : "Smart Details", 
          style: GoogleFonts.outfit(
            fontWeight: FontWeight.bold, 
            fontSize: 18, 
            color: const Color(0xFF1E293B)
          )
        ),
        centerTitle: false,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Color(0xFF1E293B), size: 22),
          onPressed: () => Navigator.pop(context),
        ),
        shape: Border(bottom: BorderSide(color: Colors.grey[200]!, width: 1)),
      ),
      body: SafeArea(
        child: SmartDetailsPanel(
          reminder: task,
          initialEditMode: isEditMode,
        ),
      ),
    );
  }
}
