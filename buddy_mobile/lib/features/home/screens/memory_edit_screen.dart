
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class MemoryEditScreen extends StatefulWidget {
  final Map<String, dynamic> item;

  const MemoryEditScreen({super.key, required this.item});

  @override
  State<MemoryEditScreen> createState() => _MemoryEditScreenState();
}

class _MemoryEditScreenState extends State<MemoryEditScreen> {
  late TextEditingController contentController;
  late TextEditingController patientController;
  late TextEditingController doctorController;
  late TextEditingController notesController;
  late bool isMemory;

  @override
  void initState() {
    super.initState();
    final type = widget.item['type'] ?? 'memory';
    isMemory = type == 'memory';
    
    final dynamic extracted = widget.item['extractedData'];
    contentController = TextEditingController(text: isMemory ? (widget.item['content'] ?? '') : '');
    patientController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['patientName'] ?? '') : '');
    doctorController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['doctorName'] ?? '') : '');
    notesController = TextEditingController(text: (!isMemory && extracted != null) ? (extracted['notes'] ?? '') : '');
  }

  @override
  void dispose() {
    contentController.dispose();
    patientController.dispose();
    doctorController.dispose();
    notesController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final provider = Provider.of<MemoriesProvider>(context, listen: false);
    bool success;
    if (isMemory) {
      success = await provider.updateMemory(widget.item['_id'], contentController.text);
    } else {
      success = await provider.updatePrescription(widget.item['_id'], {
        ...widget.item['extractedData'],
        'patientName': patientController.text,
        'doctorName': doctorController.text,
        'notes': notesController.text,
      });
    }

    if (success && mounted) {
      ToastUtils.showSuccessToast("Updated successfully");
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeColor = isMemory ? const Color(0xFF9333EA) : const Color(0xFF1D4ED8);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isMemory ? "Edit Memory" : "Edit Document",
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
            if (isMemory) ...[
              Text(
                "MEMORY CONTENT",
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: contentController,
                maxLines: 12,
                style: GoogleFonts.outfit(),
                decoration: InputDecoration(
                  hintText: "What do you want Buddy to remember?",
                  filled: true,
                  fillColor: Colors.white,
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
                    borderSide: BorderSide(color: themeColor, width: 2),
                  ),
                ),
              ),
            ] else ...[
              _buildEditField("Patient Name", patientController),
              const SizedBox(height: 20),
              _buildEditField("Doctor Name", doctorController),
              const SizedBox(height: 20),
              _buildEditField("Buddy Notes", notesController, maxLines: 6),
            ],
            const SizedBox(height: 40),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: themeColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: Text(
                  "Save Changes",
                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEditField(String label, TextEditingController controller, {int maxLines = 1}) {
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
          maxLines: maxLines,
          style: GoogleFonts.outfit(fontSize: 15),
          decoration: InputDecoration(
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
              borderSide: BorderSide(color: isMemory ? const Color(0xFF9333EA) : const Color(0xFF1D4ED8), width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
