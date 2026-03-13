import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/shared/utils/date_formatter.dart';

class UserProfileScreen extends StatefulWidget {
  final VoidCallback? onPickImage;
  const UserProfileScreen({super.key, this.onPickImage});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  bool _editMode = false;
  late TextEditingController _nameCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _phoneCtrl;
  String _dateFormat = 'DD/MM/YYYY';
  String _timeFormat = '12';
  String _timezone = 'UTC';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final user = Provider.of<UserProvider>(context, listen: false).user;
    _nameCtrl = TextEditingController(text: user['name'] ?? '');
    _emailCtrl = TextEditingController(text: user['email'] ?? '');
    _phoneCtrl = TextEditingController(text: user['phone'] ?? '');
    _dateFormat = user['dateFormat'] ?? 'DD/MM/YYYY';
    _timeFormat = user['timeFormat'] ?? '12';
    _timezone = user['timezone'] ?? 'UTC';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _save(UserProvider provider) async {
    setState(() => _saving = true);
    final ok = await provider.updateProfile(
      _nameCtrl.text.trim(),
      _phoneCtrl.text.trim(),
      provider.user['address'] ?? '', // Preserve existing address if not edited here
      dateFormat: _dateFormat,
      timeFormat: _timeFormat,
      timezone: _timezone,
    );
    setState(() {
      _saving = false;
      if (ok) _editMode = false;
    });
    if (ok) {
      ToastUtils.showSuccessToast('Profile updated');
    } else {
      final String msg = provider.error.isNotEmpty 
          ? provider.error 
          : 'Failed to update profile';
      ToastUtils.showErrorToast(msg);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Consumer<UserProvider>(
        builder: (context, provider, _) {
          final user = provider.user;
          final String name = user['name'] ?? 'User';
          final String? avatarUrl = user['profilePicture'] as String?;

          return Column(
            children: [
              // ── Header ──────────────────────────────────────────────
              Container(
                color: AppColors.surface,
                child: SafeArea(
                  bottom: false,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      border: Border(
                        bottom: BorderSide(color: AppColors.border),
                      ),
                    ),
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                    child: Row(
                      children: [
                        GestureDetector(
                          onTap: () => Navigator.maybePop(context),
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
                                'My Profile',
                                style: GoogleFonts.nunito(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.text,
                                ),
                              ),
                              Text(
                                'View and edit your details',
                                style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: AppColors.textMid,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Edit / Cancel toggle
                        GestureDetector(
                          onTap: () => setState(() {
                            if (_editMode) {
                              // Reset on cancel
                              _nameCtrl.text = user['name'] ?? '';
                              _phoneCtrl.text = user['phone'] ?? '';
                              _dateFormat = user['dateFormat'] ?? 'DD/MM/YYYY';
                              _timeFormat = user['timeFormat'] ?? '12';
                              _timezone = user['timezone'] ?? 'UTC';
                            }
                            _editMode = !_editMode;
                          }),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color: _editMode
                                  ? AppColors.bg
                                  : AppColors.accentLight,
                              borderRadius: BorderRadius.circular(11),
                              border: Border.all(
                                color: _editMode
                                    ? AppColors.border
                                    : AppColors.accent.withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              _editMode ? 'Cancel' : 'Edit',
                              style: GoogleFonts.nunito(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: _editMode
                                    ? AppColors.textMid
                                    : AppColors.accent,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // ── Body ────────────────────────────────────────────────
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(18, 24, 18, 40),
                  child: Column(
                    children: [
                      // ── Avatar section ────────────────────────────
                      Center(
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            _buildAvatar(avatarUrl, name, 86),
                            if (_editMode)
                              Positioned(
                                bottom: -2,
                                right: -2,
                                child: GestureDetector(
                                  onTap: widget.onPickImage,
                                  child: Container(
                                    width: 28,
                                    height: 28,
                                    decoration: BoxDecoration(
                                      gradient: AppColors.headerGradient,
                                      borderRadius: BorderRadius.circular(9),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.accent.withOpacity(
                                            0.4,
                                          ),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: const Icon(
                                      LucideIcons.camera,
                                      size: 13,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        name,
                        style: GoogleFonts.nunito(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user['email'] ?? '',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: AppColors.textMid,
                        ),
                      ),
                      const SizedBox(height: 28),

                      // ── Info fields ───────────────────────────────
                      _buildSectionLabel('Personal Info'),
                      const SizedBox(height: 10),
                      _buildField(
                        icon: LucideIcons.user,
                        iconColor: AppColors.accent,
                        label: 'Full Name',
                        controller: _nameCtrl,
                        editable: _editMode,
                      ),
                      _buildDivider(),
                      _buildField(
                        icon: LucideIcons.mail,
                        iconColor: AppColors.teal,
                        label: 'Email Address',
                        controller: _emailCtrl,
                        editable: false,
                        hint: 'Not set',
                      ),
                      _buildDivider(),
                      _buildField(
                        icon: LucideIcons.phone,
                        iconColor: AppColors.green,
                        label: 'Phone Number',
                        controller: _phoneCtrl,
                        editable: _editMode,
                        hint: 'Add phone number',
                        keyboardType: TextInputType.phone,
                      ),

                      const SizedBox(height: 24),
                      _buildSectionLabel('Account Info'),
                      const SizedBox(height: 10),
                      _buildReadOnly(
                        icon: LucideIcons.shieldCheck,
                        iconColor: AppColors.purple,
                        label: 'Account Status',
                        value: 'Active',
                        valueColor: AppColors.green,
                      ),
                      _buildDivider(),
                      _buildReadOnly(
                        icon: LucideIcons.calendarDays,
                        iconColor: AppColors.orange,
                        label: 'Member Since',
                        value: _formatJoinDate(user['createdAt']),
                      ),

                      const SizedBox(height: 24),
                      _buildSectionLabel('Preferences'),
                      const SizedBox(height: 10),
                      _buildPickerField(
                        icon: LucideIcons.calendar,
                        iconColor: AppColors.accent,
                        label: 'Date Format',
                        value: _dateFormat,
                        editable: _editMode,
                        options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
                        onChanged: (v) => setState(() => _dateFormat = v),
                      ),
                      _buildDivider(),
                      _buildPickerField(
                        icon: LucideIcons.clock,
                        iconColor: AppColors.orange,
                        label: 'Time Format',
                        value: _timeFormat == '24' ? '24-hour' : '12-hour',
                        editable: _editMode,
                        options: ['12-hour', '24-hour'],
                        onChanged: (v) => setState(
                          () => _timeFormat = v.contains('24') ? '24' : '12',
                        ),
                      ),
                      _buildDivider(),
                      _buildPickerField(
                        icon: LucideIcons.globe,
                        iconColor: AppColors.teal,
                        label: 'Timezone',
                        value: _timezone,
                        editable: _editMode,
                        options: [
                          'UTC',
                          'Asia/Kolkata',
                          'Asia/Calcutta',
                          'IST',
                          'EST',
                          'CST',
                          'PST',
                          'GMT',
                          'CET',
                        ],
                        onChanged: (v) => setState(() => _timezone = v),
                      ),

                      // ── Save button ───────────────────────────────
                      if (_editMode) ...[
                        const SizedBox(height: 28),
                        GestureDetector(
                          onTap: _saving ? null : () => _save(provider),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              gradient: AppColors.headerGradient,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.accent.withOpacity(0.35),
                                  blurRadius: 20,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: _saving
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
                                    'Save Changes',
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
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  Widget _buildAvatar(String? url, String name, double size) {
    if (url != null && url.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2.4),
        child: CachedNetworkImage(
          imageUrl: url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _fallbackAvatar(name, size),
          errorWidget: (_, __, ___) => _fallbackAvatar(name, size),
        ),
      );
    }
    return _fallbackAvatar(name, size);
  }

  Widget _fallbackAvatar(String name, double size) {
    final parts = name.trim().split(' ');
    final initials = parts.length >= 2
        ? '${parts[0][0]}${parts[1][0]}'.toUpperCase()
        : name.isNotEmpty
        ? name[0].toUpperCase()
        : 'U';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.circular(size / 2.4),
      ),
      child: Center(
        child: Text(
          initials,
          style: GoogleFonts.nunito(
            fontSize: size * 0.33,
            fontWeight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
      ),
    );
  }

  Widget _buildSectionLabel(String label) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppColors.textDim,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _buildDivider() => Container(height: 1, color: AppColors.border);

  Widget _buildField({
    required IconData icon,
    required Color iconColor,
    required String label,
    required TextEditingController controller,
    required bool editable,
    String? hint,
    TextInputType? keyboardType,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: iconColor.withOpacity(0.18)),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDim,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 5),
                editable
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 9,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.accentLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: AppColors.accent.withOpacity(0.35),
                          ),
                        ),
                        child: TextField(
                          controller: controller,
                          keyboardType: keyboardType,
                          cursorColor: AppColors.accent,
                          style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.text,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                            border: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            filled: true,
                            fillColor: Colors.transparent,
                            hintText: hint,
                            hintStyle: GoogleFonts.nunito(
                              fontSize: 14,
                              color: AppColors.textDim,
                            ),
                          ),
                        ),
                      )
                    : Text(
                        controller.text.isNotEmpty
                            ? controller.text
                            : (hint ?? '—'),
                        style: GoogleFonts.nunito(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: controller.text.isNotEmpty
                              ? AppColors.text
                              : AppColors.textDim,
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReadOnly({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: iconColor.withOpacity(0.18)),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDim,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: GoogleFonts.nunito(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: valueColor ?? AppColors.text,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPickerField({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
    required bool editable,
    required List<String> options,
    required ValueChanged<String> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: iconColor.withOpacity(0.18)),
            ),
            child: Icon(icon, size: 17, color: iconColor),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textDim,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 5),
                editable
                    ? GestureDetector(
                        onTap: () =>
                            _showPicker(label, options, value, onChanged),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.accentLight,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: AppColors.accent.withOpacity(0.35),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  value,
                                  style: GoogleFonts.nunito(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.text,
                                  ),
                                ),
                              ),
                              Icon(
                                LucideIcons.chevronDown,
                                size: 14,
                                color: AppColors.textMid,
                              ),
                            ],
                          ),
                        ),
                      )
                    : Text(
                        value,
                        style: GoogleFonts.nunito(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.text,
                        ),
                      ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showPicker(
    String title,
    List<String> options,
    String current,
    ValueChanged<String> onChanged,
  ) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Select $title',
              style: GoogleFonts.nunito(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.text,
              ),
            ),
            const SizedBox(height: 16),
            ...options.map(
              (opt) => ListTile(
                title: Text(
                  opt,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: opt == current
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: opt == current ? AppColors.accent : AppColors.text,
                  ),
                ),
                trailing: opt == current
                    ? const Icon(
                        LucideIcons.check,
                        color: AppColors.accent,
                        size: 20,
                      )
                    : null,
                onTap: () {
                  onChanged(opt);
                  Navigator.pop(context);
                },
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  String _formatJoinDate(dynamic raw) {
    if (raw == null) return 'Unknown';
    return DateFormatter.displayDateString(context, raw.toString());
  }
}
