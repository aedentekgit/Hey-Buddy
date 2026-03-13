import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
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
  bool _isSaving = false;
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    final type = widget.item['type'] ?? 'memory';
    isMemory = type == 'memory';

    final dynamic extracted = widget.item['extractedData'];
    contentController = TextEditingController(
      text: isMemory ? (widget.item['content'] ?? '') : '',
    );
    patientController = TextEditingController(
      text: (!isMemory && extracted != null)
          ? (extracted['patientName'] ?? '')
          : '',
    );
    doctorController = TextEditingController(
      text: (!isMemory && extracted != null)
          ? (extracted['doctorName'] ?? '')
          : '',
    );
    notesController = TextEditingController(
      text: (!isMemory && extracted != null) ? (extracted['notes'] ?? '') : '',
    );
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
    setState(() => _isSaving = true);
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
    if (mounted) setState(() => _isSaving = false);
    if (success && mounted) {
      ToastUtils.showSuccessToast('Updated successfully');
      Navigator.pop(context);
    }
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
    if (image != null) setState(() => _selectedFile = File(image.path));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          // ── Header ──────────────────────────────────────────────────
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
                            isMemory ? 'Edit Memory' : 'Edit Document',
                            style: GoogleFonts.nunito(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                            ),
                          ),
                          Text(
                            'Make changes and save',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.textMid,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Save button in header
                    GestureDetector(
                      onTap: _isSaving ? null : _save,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: _isSaving
                              ? AppColors.accent.withOpacity(0.5)
                              : AppColors.accent,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: _isSaving
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                'Save',
                                style: GoogleFonts.nunito(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Body ────────────────────────────────────────────────────
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (isMemory) ...[
                    _SectionLabel('Memory Content'),
                    _buildTextArea(
                      contentController,
                      hint: 'What do you want Buddy to remember?',
                      maxLines: 12,
                    ),
                  ] else ...[
                    _SectionLabel('Patient Name'),
                    _buildTextArea(patientController, hint: 'Patient name'),
                    const SizedBox(height: 16),
                    _SectionLabel('Doctor Name'),
                    _buildTextArea(doctorController, hint: 'Doctor name'),
                    const SizedBox(height: 16),
                    _SectionLabel('Notes'),
                    _buildTextArea(
                      notesController,
                      hint: 'Additional notes',
                      maxLines: 6,
                    ),
                  ],
                  if (isMemory) ...[
                    const SizedBox(height: 24),
                    _SectionLabel('Attachment'),
                    _buildAttachmentSection(),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _SectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.nunito(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: AppColors.textDim,
          letterSpacing: 0.7,
        ),
      ),
    );
  }

  Widget _buildTextArea(
    TextEditingController ctrl, {
    String hint = '',
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: TextField(
        controller: ctrl,
        maxLines: maxLines,
        style: GoogleFonts.inter(fontSize: 14, color: AppColors.text),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(fontSize: 14, color: AppColors.textDim),
          contentPadding: const EdgeInsets.all(16),
          border: InputBorder.none,
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(
              color: AppColors.accent.withOpacity(0.5),
              width: 1.5,
            ),
          ),
          enabledBorder: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildAttachmentSection() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        children: [
          if (_selectedFile != null) ...[
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(13),
              ),
              child: Image.file(
                _selectedFile!,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() => _selectedFile = null),
              icon: const Icon(
                LucideIcons.x,
                size: 15,
                color: AppColors.danger,
              ),
              label: Text(
                'Remove',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.danger),
              ),
            ),
          ] else if (widget.item['fileUrl'] != null) ...[
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(13),
              ),
              child: CachedNetworkImage(
                imageUrl:
                    AppConfig.formatImageUrl(
                      widget.item['fileUrl'] as String?,
                    ) ??
                    '',
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  height: 160,
                  color: AppColors.bg,
                  child: const Center(child: CircularProgressIndicator()),
                ),
                errorWidget: (_, __, ___) => Container(
                  height: 80,
                  color: AppColors.bg,
                  child: Center(
                    child: Icon(
                      LucideIcons.imageOff,
                      color: AppColors.textDim,
                      size: 28,
                    ),
                  ),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: _pickImage,
              icon: Icon(LucideIcons.upload, size: 15, color: AppColors.accent),
              label: Text(
                'Change Attachment',
                style: GoogleFonts.inter(fontSize: 13, color: AppColors.accent),
              ),
            ),
          ] else ...[
            GestureDetector(
              onTap: _pickImage,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 28),
                child: Column(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.accentLight,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        LucideIcons.upload,
                        size: 24,
                        color: AppColors.accent,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Upload Image or PDF',
                      style: GoogleFonts.nunito(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tap to browse your files',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: AppColors.textMid,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
