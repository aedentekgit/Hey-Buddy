// ignore_for_file: use_build_context_synchronously
import 'package:flutter/material.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class LocationReminderCreateScreen extends StatefulWidget {
  final Map<String, dynamic>? reminder;
  const LocationReminderCreateScreen({super.key, this.reminder});

  @override
  State<LocationReminderCreateScreen> createState() =>
      _LocationReminderCreateScreenState();
}

class _LocationReminderCreateScreenState
    extends State<LocationReminderCreateScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _locationController = TextEditingController();
  final _dateController = TextEditingController();
  final _timeController = TextEditingController();

  String _warningLevel = 'medium';
  bool _isLoading = false;

  bool get isEditing => widget.reminder != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final r = widget.reminder!;
      _titleController.text = r['title'] ?? '';
      _locationController.text = r['location'] ?? '';
      _dateController.text = r['date'] ?? '';
      _timeController.text = r['time'] ?? '';
      _warningLevel = r['warningLevel'] ?? 'medium';
    } else {
      final now = DateTime.now();
      _dateController.text =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      _timeController.text = '10:00 AM';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _locationController.dispose();
    _dateController.dispose();
    _timeController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2101),
      builder: (context, child) => Theme(
        data: Theme.of(
          context,
        ).copyWith(colorScheme: ColorScheme.light(primary: AppColors.accent)),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        _dateController.text =
            '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      });
    }
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
      builder: (context, child) => Theme(
        data: Theme.of(
          context,
        ).copyWith(colorScheme: ColorScheme.light(primary: AppColors.accent)),
        child: child!,
      ),
    );
    if (picked != null) {
      final hour = picked.hourOfPeriod == 0 ? 12 : picked.hourOfPeriod;
      final period = picked.period == DayPeriod.am ? 'AM' : 'PM';
      setState(() {
        _timeController.text =
            '${hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')} $period';
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    final data = {
      'title': _titleController.text.trim(),
      'location': _locationController.text.trim(),
      'date': _dateController.text.trim(),
      'time': _timeController.text.trim(),
      'warningLevel': _warningLevel,
    };

    final success = isEditing
        ? await context.read<LocationRemindersProvider>().updateReminder(
            widget.reminder!['_id'],
            data,
          )
        : await context.read<LocationRemindersProvider>().createReminder(data);

    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.pop(context, true);
        ToastUtils.showSuccessToast(
          isEditing ? 'Reminder updated' : 'Location reminder created',
        );
      } else {
        ToastUtils.showErrorToast('Failed to save reminder');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          // ── Header ────────────────────────────────────────────────
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
                        child: Icon(
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
                            isEditing
                                ? 'Edit Reminder'
                                : 'New Location Reminder',
                            style: GoogleFonts.nunito(
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                              color: AppColors.text,
                            ),
                          ),
                          Text(
                            isEditing
                                ? 'Update reminder details'
                                : 'Set a location-based reminder',
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

          // ── Body ──────────────────────────────────────────────────
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 40),
                children: [
                  // Title field
                  _FieldLabel('Title'),
                  const SizedBox(height: 8),
                  _StyledField(
                    controller: _titleController,
                    hint: 'e.g. Visit Tower Bridge',
                    icon: LucideIcons.fileText,
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Title is required' : null,
                  ),
                  const SizedBox(height: 18),

                  // Location field
                  _FieldLabel('Location'),
                  const SizedBox(height: 8),
                  _StyledField(
                    controller: _locationController,
                    hint: 'e.g. London, UK',
                    icon: LucideIcons.mapPin,
                    iconColor: AppColors.orange,
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Location is required' : null,
                  ),
                  const SizedBox(height: 18),

                  // Date + Time row
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _FieldLabel('Date'),
                            const SizedBox(height: 8),
                            _TappableField(
                              controller: _dateController,
                              hint: 'YYYY-MM-DD',
                              icon: LucideIcons.calendar,
                              iconColor: AppColors.teal,
                              onTap: _selectDate,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _FieldLabel('Time'),
                            const SizedBox(height: 8),
                            _TappableField(
                              controller: _timeController,
                              hint: 'HH:MM AM/PM',
                              icon: LucideIcons.clock,
                              iconColor: AppColors.purple,
                              onTap: _selectTime,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Warning level
                  _FieldLabel('Warning Level'),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      _WarningOption(
                        label: 'Low',
                        value: 'low',
                        color: AppColors.green,
                        selected: _warningLevel == 'low',
                        onTap: () => setState(() => _warningLevel = 'low'),
                      ),
                      const SizedBox(width: 8),
                      _WarningOption(
                        label: 'Medium',
                        value: 'medium',
                        color: AppColors.orange,
                        selected: _warningLevel == 'medium',
                        onTap: () => setState(() => _warningLevel = 'medium'),
                      ),
                      const SizedBox(width: 8),
                      _WarningOption(
                        label: 'High',
                        value: 'high',
                        color: AppColors.danger,
                        selected: _warningLevel == 'high',
                        onTap: () => setState(() => _warningLevel = 'high'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 36),

                  // Save button
                  GestureDetector(
                    onTap: _isLoading ? null : _save,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        gradient: AppColors.headerGradient,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.accent.withValues(alpha: 0.35),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: _isLoading
                          ? const Center(
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                            )
                          : Text(
                              isEditing ? 'Update Reminder' : 'Create Reminder',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.nunito(
                                fontSize: 15,
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
        ],
      ),
    );
  }
}

// ── Shared field widgets ────────────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Text(
      text.toUpperCase(),
      style: GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.textDim,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _StyledField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final Color? iconColor;
  final String? Function(String?)? validator;

  const _StyledField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.iconColor,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    final color = iconColor ?? AppColors.accent;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: TextFormField(
        controller: controller,
        validator: validator,
        cursorColor: AppColors.accent,
        style: GoogleFonts.nunito(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: AppColors.text,
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textDim),
          prefixIcon: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Icon(icon, size: 17, color: color),
          ),
          prefixIconConstraints: const BoxConstraints(
            minWidth: 0,
            minHeight: 0,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 15,
          ),
          border: InputBorder.none,
          errorStyle: GoogleFonts.inter(fontSize: 11, color: AppColors.danger),
        ),
      ),
    );
  }
}

class _TappableField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final Color? iconColor;
  final VoidCallback onTap;

  const _TappableField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.iconColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    final color = iconColor ?? AppColors.accent;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
          boxShadow: AppColors.cardShadow,
        ),
        child: Row(
          children: [
            Icon(icon, size: 17, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                controller.text.isNotEmpty ? controller.text : hint,
                style: controller.text.isNotEmpty
                    ? GoogleFonts.nunito(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.text,
                      )
                    : GoogleFonts.inter(fontSize: 13, color: AppColors.textDim),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WarningOption extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const _WarningOption({
    required this.label,
    required this.value,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: selected ? color.withValues(alpha: 0.12) : AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? color : AppColors.border,
              width: selected ? 1.5 : 1,
            ),
            boxShadow: AppColors.cardShadow,
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.nunito(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: selected ? color : AppColors.textMid,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
