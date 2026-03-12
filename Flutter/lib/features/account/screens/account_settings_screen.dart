import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart' as buddy;
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:buddy_mobile/features/account/screens/user_profile_screen.dart';

class AccountSettingsScreen extends StatefulWidget {
  final ValueChanged<bool>? onSubViewChanged;
  const AccountSettingsScreen({super.key, this.onSubViewChanged});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

class _AccountSettingsScreenState extends State<AccountSettingsScreen>
    with WidgetsBindingObserver {

  // Toggle states
  bool _voiceAlerts = true;
  bool _pushNotifications = true;
  bool _emailDigest = false;
  bool _inAppAlerts = true;
  bool _biometrics = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() {
      if (mounted) {
        Provider.of<UserProvider>(context, listen: false).loadProfile();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // ── Avatar upload ────────────────────────────────────────────────────────
  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked != null && mounted) {
      final success = await Provider.of<UserProvider>(context, listen: false)
          .updateAvatar(File(picked.path));
      if (success) {
        ToastUtils.showSuccessToast('Profile picture updated');
      } else {
        ToastUtils.showErrorToast('Failed to upload image');
      }
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  Future<void> _handleLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => _ConfirmDialog(
        title: 'Log Out',
        message: 'Are you sure you want to log out of your account?',
        confirmLabel: 'Log Out',
        confirmColor: AppColors.accent,
      ),
    );
    if (ok == true && mounted) {
      await Provider.of<AuthProvider>(context, listen: false).logout();
      if (mounted) {
        Provider.of<UserProvider>(context, listen: false).clearUser();
        Provider.of<buddy.BuddyProvider>(context, listen: false).startNewChat();
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const MainScreen()),
          (route) => false,
        );
      }
    }
  }

  // ── Delete account ───────────────────────────────────────────────────────
  Future<void> _handleDeleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => _ConfirmDialog(
        title: 'Delete Account',
        message:
            'This will permanently delete your account and all associated data. This cannot be undone.',
        confirmLabel: 'Delete Account',
        confirmColor: AppColors.danger,
        isDanger: true,
      ),
    );
    if (ok == true && mounted) {
      final success =
          await Provider.of<UserProvider>(context, listen: false).deleteAccount();
      if (success && mounted) {
        await Provider.of<AuthProvider>(context, listen: false).logout();
        if (mounted) {
          Provider.of<UserProvider>(context, listen: false).clearUser();
          Provider.of<buddy.BuddyProvider>(context, listen: false).startNewChat();
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => const MainScreen()),
            (route) => false,
          );
        }
      }
    }
  }

  // ── Google Calendar toggle ───────────────────────────────────────────────
  Future<void> _handleCalendarToggle(UserProvider userProvider) async {
    final isConnected = userProvider.user['googleCalendarConnected'] == true ||
        userProvider.user['googleRefreshToken'] != null;
    if (isConnected) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => _ConfirmDialog(
          title: 'Disconnect Calendar',
          message: 'Disconnect Google Calendar? Your reminders will no longer sync.',
          confirmLabel: 'Disconnect',
          confirmColor: AppColors.orange,
        ),
      );
      if (ok == true && mounted) {
        await userProvider.unlinkCalendar();
        ToastUtils.showSuccessToast('Google Calendar disconnected');
      }
    } else {
      final url = await userProvider.getGoogleAuthUrl();
      if (url != null && mounted) {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Consumer<UserProvider>(
        builder: (context, userProvider, _) {
          final user = userProvider.user;
          final String name = user['name'] ?? 'User';
          final String email = user['email'] ?? '';
          final String? avatarUrl = user['profilePicture'] as String?;
          final bool calConnected = user['googleCalendarConnected'] == true ||
              user['googleRefreshToken'] != null;

          final notificationPrefs = user['notificationPreferences'] ?? {};
          final bool voiceAlerts = notificationPrefs['voice']?['enabled'] ?? true;
          final bool pushNotifications = notificationPrefs['push']?['enabled'] ?? true;
          final bool emailDigest = notificationPrefs['email']?['enabled'] ?? true;
          final bool inAppAlerts = notificationPrefs['inApp']?['enabled'] ?? true;

          return ListView(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
            children: [
              // ── Profile card ──────────────────────────────────────────
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => UserProfileScreen(
                      onPickImage: _pickImage,
                    ),
                  ),
                ),
                child: _Card(
                  child: Row(
                    children: [
                      // Avatar
                      _Avatar(name: name, avatarUrl: avatarUrl, size: 60),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: GoogleFonts.nunito(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: AppColors.text),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              email,
                              style: GoogleFonts.inter(
                                  fontSize: 12, color: AppColors.textMid),
                            ),
                          ],
                        ),
                      ),
                      // Right arrow
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.bg,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Icon(LucideIcons.chevronRight,
                            size: 16, color: AppColors.textMid),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // ── Notifications ─────────────────────────────────────────
              _SecLabel(label: 'Notifications'),
              _Card(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _SettingsRow(
                      icon: LucideIcons.mic,
                      iconColor: AppColors.accent,
                      label: 'Voice Alerts',
                      sub: 'Buddy speaks reminders',
                      trailing: _Toggle(
                          value: voiceAlerts,
                          onChanged: (v) => userProvider.updateNotificationPreferences({
                            'voice': {'enabled': v}
                          })),
                    ),
                    _Divider(),
                    _SettingsRow(
                      icon: LucideIcons.bell,
                      iconColor: AppColors.orange,
                      label: 'Push Notifications',
                      sub: 'Lock screen alerts',
                      trailing: _Toggle(
                          value: pushNotifications,
                          onChanged: (v) => userProvider.updateNotificationPreferences({
                                'push': {'enabled': v}
                              })),
                    ),
                    _Divider(),
                    _SettingsRow(
                      icon: LucideIcons.messageSquare,
                      iconColor: AppColors.teal,
                      label: 'Email Digest',
                      sub: 'Daily summary via email',
                      trailing: _Toggle(
                          value: emailDigest,
                          onChanged: (v) => userProvider.updateNotificationPreferences({
                                'email': {'enabled': v}
                              })),
                    ),
                    _Divider(),
                    _SettingsRow(
                      icon: LucideIcons.star,
                      iconColor: AppColors.pink,
                      label: 'In-App Alerts',
                      sub: 'Banners & badges',
                      trailing: _Toggle(
                          value: inAppAlerts,
                          onChanged: (v) => userProvider.updateNotificationPreferences({
                                'inApp': {'enabled': v}
                              })),
                      isLast: true,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // ── Integrations ──────────────────────────────────────────
              _SecLabel(label: 'Integrations'),
              _Card(
                padding: EdgeInsets.zero,
                child: _SettingsRow(
                  icon: LucideIcons.calendar,
                  iconColor: AppColors.accent,
                  label: 'Google Calendar',
                  sub: calConnected ? 'Synced · Connected' : 'Not connected',
                  trailing: _Toggle(
                      value: calConnected,
                      onChanged: (_) =>
                          _handleCalendarToggle(userProvider)),
                  isLast: true,
                ),
              ),

              const SizedBox(height: 18),

              // ── Security ──────────────────────────────────────────────
              _SecLabel(label: 'Security'),
              _Card(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _SettingsRow(
                      icon: LucideIcons.shield,
                      iconColor: AppColors.green,
                      label: 'Biometrics',
                      sub: 'Face ID / Fingerprint',
                      trailing: _Toggle(
                          value: _biometrics,
                          onChanged: (v) => setState(() => _biometrics = v)),
                    ),
                    _Divider(),
                    _SettingsRow(
                      icon: LucideIcons.key,
                      iconColor: AppColors.orange,
                      label: 'Change Password',
                      sub: 'Update your account password',
                      trailing: Icon(LucideIcons.chevronRight,
                          size: 15, color: AppColors.textDim),
                      onTap: () => _showInfoModal(
                        title: 'Update Password',
                        icon: LucideIcons.key,
                        color: AppColors.orange,
                        desc:
                            'We will send a secure link to your registered email to reset your account password.',
                      ),
                      isLast: true,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // ── Account ───────────────────────────────────────────────
              _SecLabel(label: 'Account'),
              _Card(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _SettingsRow(
                      icon: LucideIcons.logOut,
                      iconColor: AppColors.textMid,
                      label: 'Log Out',
                      sub: 'Sign out of your account',
                      trailing: Icon(LucideIcons.chevronRight,
                          size: 15, color: AppColors.textDim),
                      onTap: _handleLogout,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // ── Danger Zone ───────────────────────────────────────────
              _SecLabel(label: 'Danger Zone', color: AppColors.danger),
              GestureDetector(
                onTap: _handleDeleteAccount,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFFECACA)),
                    boxShadow: AppColors.cardShadow,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.dangerLight,
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: const Icon(LucideIcons.alertTriangle,
                              size: 17, color: AppColors.danger),
                        ),
                        const SizedBox(width: 13),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Delete Account',
                              style: GoogleFonts.nunito(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.danger),
                            ),
                            Text(
                              'Permanently remove all data',
                              style: GoogleFonts.inter(
                                  fontSize: 11,
                                  color: const Color(0xFFF87171)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showInfoModal({
    required String title,
    required IconData icon,
    required Color color,
    required String desc,
  }) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: color.withOpacity(0.2)),
                ),
                child: Icon(icon, size: 22, color: color),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                style: GoogleFonts.nunito(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppColors.text),
              ),
              const SizedBox(height: 8),
              Text(
                desc,
                style: GoogleFonts.inter(
                    fontSize: 14, color: AppColors.textMid, height: 1.6),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    gradient: AppColors.headerGradient,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [
                      BoxShadow(
                          color: AppColors.accent.withOpacity(0.4),
                          blurRadius: 18,
                          offset: const Offset(0, 8)),
                    ],
                  ),
                  child: Text(
                    'Understood',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunito(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Colors.white),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Reusable widgets ─────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  const _Card({required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardShadow,
      ),
      child: child,
    );
  }
}

class _SecLabel extends StatelessWidget {
  final String label;
  final Color? color;
  const _SecLabel({required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color ?? AppColors.textDim,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      Container(height: 1, color: AppColors.border);
}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String? sub;
  final Widget trailing;
  final VoidCallback? onTap;
  final bool isLast;

  const _SettingsRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    this.sub,
    required this.trailing,
    this.onTap,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
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
                    style: GoogleFonts.nunito(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.text),
                  ),
                  if (sub != null)
                    Text(
                      sub!,
                      style: GoogleFonts.inter(
                          fontSize: 11, color: AppColors.textMid),
                    ),
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }
}

class _Toggle extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;
  const _Toggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 25,
        decoration: BoxDecoration(
          color: value ? AppColors.accent : const Color(0xFFD1D5DB),
          borderRadius: BorderRadius.circular(13),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.symmetric(horizontal: 2.5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 4,
                    offset: const Offset(0, 1))
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String? avatarUrl;
  final double size;
  const _Avatar({required this.name, this.avatarUrl, required this.size});

  String get _initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : 'U';
  }

  @override
  Widget build(BuildContext context) {
    if (avatarUrl != null && avatarUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(size / 2),
        child: CachedNetworkImage(
          imageUrl: avatarUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          placeholder: (_, __) => _fallback(),
          errorWidget: (_, __, ___) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: Center(
        child: Text(
          _initials,
          style: GoogleFonts.nunito(
              fontSize: size * 0.33,
              fontWeight: FontWeight.w900,
              color: Colors.white),
        ),
      ),
    );
  }
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
class _ConfirmDialog extends StatelessWidget {
  final String title;
  final String message;
  final String confirmLabel;
  final Color confirmColor;
  final bool isDanger;

  const _ConfirmDialog({
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.confirmColor,
    this.isDanger = false,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: GoogleFonts.nunito(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: AppColors.text),
            ),
            const SizedBox(height: 10),
            Text(
              message,
              style: GoogleFonts.inter(
                  fontSize: 13.5, color: AppColors.textMid, height: 1.5),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context, false),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.bg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        'Cancel',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMid),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context, true),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        color: isDanger
                            ? AppColors.dangerLight
                            : confirmColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: confirmColor.withOpacity(0.3)),
                      ),
                      child: Text(
                        confirmLabel,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.nunito(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: confirmColor),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
