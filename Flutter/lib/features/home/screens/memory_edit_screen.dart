
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:cached_network_image/cached_network_image.dart';

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
  File? _selectedFile;
  final ImagePicker _picker = ImagePicker();

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
      success = await provider.updateMemory(
        widget.item['_id'], 
        contentController.text,
        file: _selectedFile,
      );
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
            if (isMemory) ...[
              const SizedBox(height: 20),
              _buildFileUploadSection(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFileUploadSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "ATTACHMENT",
          style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              if (_selectedFile != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(_selectedFile!, height: 150, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: () => setState(() => _selectedFile = null),
                  icon: const Icon(LucideIcons.x, size: 16, color: Colors.red),
                  label: Text("Remove", style: GoogleFonts.outfit(color: Colors.red)),
                ),
              ] else if (widget.item['fileUrl'] != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: CachedNetworkImage(
                    imageUrl: AppConfig.formatImageUrl(widget.item['fileUrl'] as String?) ?? '',
                    height: 150,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    placeholder: (ctx, url) => Container(
                      height: 150,
                      color: Colors.grey[100],
                      child: const Center(child: CircularProgressIndicator()),
                    ),
                    errorWidget: (ctx, url, err) => Container(
                      height: 80,
                      color: Colors.grey[100],
                      child: const Center(child: Icon(Icons.broken_image, color: Colors.grey)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: _pickImage,
                  icon: const Icon(LucideIcons.upload, size: 16),
                  label: Text("Change Attachment", style: GoogleFonts.outfit()),
                ),
              ] else ...[
                InkWell(
                  onTap: _pickImage,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Column(
                      children: [
                        const Icon(LucideIcons.upload, size: 32, color: Color(0xFF9333EA)),
                        const SizedBox(height: 8),
                        Text("Upload Image", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
                        Text("Supports Images & PDFs", style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey)),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedFile = File(image.path);
      });
    }
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
