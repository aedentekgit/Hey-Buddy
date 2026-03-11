import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';

class LocationReminderCreateScreen extends StatefulWidget {
  final Map<String, dynamic>? reminder;
  const LocationReminderCreateScreen({super.key, this.reminder});

  @override
  State<LocationReminderCreateScreen> createState() => _LocationReminderCreateScreenState();
}

class _LocationReminderCreateScreenState extends State<LocationReminderCreateScreen> {
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
      // Pre-fill with today's date
      final now = DateTime.now();
      _dateController.text = "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";
      _timeController.text = "10:00 AM"; // Default
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
    );
    if (picked != null) {
      setState(() {
        _dateController.text = "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      });
    }
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.now(),
    );
    if (picked != null) {
      final hour = picked.hourOfPeriod == 0 ? 12 : picked.hourOfPeriod;
      final period = picked.period == DayPeriod.am ? 'AM' : 'PM';
      setState(() {
        _timeController.text = "${hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')} $period";
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
      ? await context.read<LocationRemindersProvider>().updateReminder(widget.reminder!['_id'], data)
      : await context.read<LocationRemindersProvider>().createReminder(data);
    
    if (mounted) {
      setState(() => _isLoading = false);
      if (success) {
        Navigator.pop(context, true); // Return true to indicate change
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isEditing ? 'Reminder updated' : 'Location reminder created')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to save reminder'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Reminder' : 'New Location Reminder', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF1E293B),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              _buildFieldLabel('TITLE'),
              TextFormField(
                controller: _titleController,
                decoration: _inputDecoration('e.g. Visit Tower Bridge'),
                validator: (v) => v == null || v.isEmpty ? 'Title is required' : null,
              ),
              const SizedBox(height: 20),

              _buildFieldLabel('LOCATION'),
              TextFormField(
                controller: _locationController,
                decoration: _inputDecoration('e.g. London, UK').copyWith(
                  prefixIcon: const Icon(LucideIcons.mapPin, size: 18),
                ),
                validator: (v) => v == null || v.isEmpty ? 'Location is required' : null,
              ),
              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildFieldLabel('DATE'),
                        TextFormField(
                          controller: _dateController,
                          readOnly: true,
                          onTap: _selectDate,
                          decoration: _inputDecoration('YYYY-MM-DD').copyWith(
                            prefixIcon: const Icon(LucideIcons.calendar, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildFieldLabel('TIME'),
                        TextFormField(
                          controller: _timeController,
                          readOnly: true,
                          onTap: _selectTime,
                          decoration: _inputDecoration('HH:MM AM/PM').copyWith(
                            prefixIcon: const Icon(LucideIcons.clock, size: 18),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              _buildFieldLabel('WARNING LEVEL'),
              Row(
                children: [
                  _warningOption('Low', 'low', const Color(0xFF10B981)),
                  const SizedBox(width: 8),
                  _warningOption('Med', 'medium', const Color(0xFFF59E0B)),
                  const SizedBox(width: 8),
                  _warningOption('High', 'high', const Color(0xFFE11D48)),
                ],
              ),
              
              const SizedBox(height: 48),

              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF10B981),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(isEditing ? 'Update Reminder' : 'Create Reminder', style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        label,
        style: GoogleFonts.outfit(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF64748B),
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 14),
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF10B981), width: 2),
      ),
    );
  }

  Widget _warningOption(String label, String value, Color color) {
    final bool isSelected = _warningLevel == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _warningLevel = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.1) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? color : const Color(0xFFE2E8F0),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isSelected ? color : const Color(0xFF64748B),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
