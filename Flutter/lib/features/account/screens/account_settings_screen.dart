import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:io';
import 'dart:convert';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:http/http.dart' as http;
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart' as buddy;

class AccountSettingsScreen extends StatefulWidget {
  final ValueChanged<bool>? onSubViewChanged;

  const AccountSettingsScreen({super.key, this.onSubViewChanged});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

enum _SettingsView { menu, editProfile, notifications, integrations }


class _AccountSettingsScreenState extends State<AccountSettingsScreen> with WidgetsBindingObserver {
  _SettingsView __currentView = _SettingsView.menu;
  _SettingsView get _currentView => __currentView;
  set _currentView(_SettingsView view) {
    __currentView = view;
    // Delay callback to avoid synchronous build conflicts when parent updates
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onSubViewChanged?.call(view != _SettingsView.menu);
    });
  }

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();
  
  String _dateFormat = 'DD/MM/YYYY';
  String _timeFormat = '12';

  File? _imageFile;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadUserData();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _currentView == _SettingsView.integrations) {
      // Reload profile when returning to the app in case Google Auth finished
      Provider.of<UserProvider>(context, listen: false).loadProfile();
    }
  }

  void _loadUserData() {
    Future.microtask(() {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      userProvider.loadProfile().then((_) {
        if (mounted) {
          final user = userProvider.user;
          setState(() {
            _nameController.text = user['name'] ?? '';
            _phoneController.text = user['phone'] ?? '';
            _addressController.text = user['address'] ?? '';
            _dateFormat = user['dateFormat'] ?? 'DD/MM/YYYY';
            _timeFormat = user['timeFormat'] ?? '12';
          });
        }
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _nameController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  // --- Handlers ---
  

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: ImageSource.gallery);

    if (pickedFile != null) {
      setState(() {
        _imageFile = File(pickedFile.path);
      });
      if (mounted) {
        final success = await Provider.of<UserProvider>(context, listen: false).updateAvatar(_imageFile!);
        if (success) {
          ToastUtils.showSuccessToast('Profile picture updated successfully');
        } else {
          ToastUtils.showErrorToast('Failed to upload image');
        }
      }
    }
  }

  Future<void> _handleSave() async {
    final success = await Provider.of<UserProvider>(context, listen: false).updateProfile(
      _nameController.text.trim(),
      _phoneController.text.trim(),
      _addressController.text.trim(),
      dateFormat: _dateFormat,
      timeFormat: _timeFormat,
    );

    if (!mounted) return;

    if (success) {
      ToastUtils.showSuccessToast('Changes saved successfully');
      setState(() => _currentView = _SettingsView.menu); 
    } else {
      ToastUtils.showErrorToast('Failed to save changes');
    }
  }

  Future<void> _handleDeleteAccount() async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        title: Text("Delete Account", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text("Are you sure you want to permanently delete your account? This action cannot be undone.", style: GoogleFonts.outfit()),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text("Cancel"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.withOpacity(0.05),
                    foregroundColor: Colors.red,
                    side: BorderSide(color: Colors.red.withOpacity(0.2), width: 1.5),
                    elevation: 0,
                  ),
                  child: const Text("Delete"),
                ),
              ),
            ],
          ),
        ],
      ),
    );

    if (shouldDelete == true && mounted) {
      final success = await Provider.of<UserProvider>(context, listen: false).deleteAccount();
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

  Future<void> _handleLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        title: Text("Log Out", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text("Are you sure you want to log out of your account?", style: GoogleFonts.outfit()),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text("Cancel"),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Theme.of(context).primaryColor,
                    foregroundColor: Colors.white,
                    elevation: 0,
                  ),
                  child: const Text("Log Out"),
                ),
              ),
            ],
          ),
        ],
      ),
    );

    if (shouldLogout == true && mounted) {
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


  @override
  Widget build(BuildContext context) {
    // Handle back button for sub-views
    return PopScope(
      canPop: _currentView == _SettingsView.menu,
      onPopInvoked: (didPop) {
        if (didPop) return;
        setState(() => _currentView = _SettingsView.menu);
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: Column(
          children: [
            // Header logic based on view
            if (_currentView != _SettingsView.menu)
              _buildSubHeader(),

            Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: Align(
                    key: ValueKey(_currentView),
                    alignment: Alignment.topCenter,
                    child: _buildCurrentView(),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

  Widget _buildSubHeader() {
    String title = "Settings";
    if (_currentView == _SettingsView.editProfile) title = "Edit Profile";
    if (_currentView == _SettingsView.notifications) title = "Notifications";
    if (_currentView == _SettingsView.integrations) title = "Integrations";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.grey[200]!)),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(LucideIcons.arrowLeft, size: 20),
            onPressed: () => setState(() => _currentView = _SettingsView.menu),
          ),
          const SizedBox(width: 8),
          Text(title, style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildCurrentView() {
    switch (_currentView) {
      case _SettingsView.menu:
        return _buildMenu();
      case _SettingsView.editProfile:
        return _buildEditProfile();
      case _SettingsView.notifications:
        return _buildNotifications();
      case _SettingsView.integrations:
        return _buildIntegrations();
    }
  }

  // --- NOTIFICATIONS VIEW ---
  Widget _buildNotifications() {
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    // Safe access to nested prefs
    final prefs = user['notificationPreferences'] as Map<String, dynamic>? ?? {};

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildNotificationItem(
            "AI Voice Reminders", 
            "Receive audible reminders from Buddy AI when you are in an active voice session.", 
            "voice", 
            prefs['voice'],
            LucideIcons.mic
          ),

          _buildNotificationItem(
            "Push Notifications", 
            "Receive instant alerts on your mobile or desktop device.", 
            "push", 
            prefs['push'],
            LucideIcons.bell
          ),



          _buildNotificationItem(
            "Email Notifications", 
            "Receive detailed summaries and reminders in your inbox.", 
            "email", 
            prefs['email'],
            LucideIcons.mail
          ),
          _buildNotificationItem(
            "In-App Notifications", 
            "See alerts and updates within the Buddy Assistant interface.", 
            "inApp", 
            prefs['inApp'],
            LucideIcons.layout
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(String title, String subtitle, String key, dynamic data, IconData icon) {
    final Map<String, dynamic> safeData = data is Map<String, dynamic> ? data : {'enabled': false};
    final bool isEnabled = safeData['enabled'] ?? false;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon, 
                  size: 24, 
                  color: Theme.of(context).primaryColor
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: GoogleFonts.outfit(
                        color: Colors.grey[500],
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Transform.scale(
                scale: 0.8,
                child: Switch.adaptive(
                  value: isEnabled,
                  activeColor: Colors.white,
                  activeTrackColor: Theme.of(context).primaryColor,
                  onChanged: (val) {
                    _updateNotificationPref(key, {'enabled': val});
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _updateNotificationPref(String key, Map<String, dynamic> newData) {
     final userProvider = Provider.of<UserProvider>(context, listen: false);
     // We need to fetch current entire prefs to merge correctly if we were doing it manually, 
     // but UserProvider's updateNotificationPreferences handles merging with existing state.
     // However, we are sending { 'push': { ... } } so we need to wrap it.
     userProvider.updateNotificationPreferences({key: newData});
  }


  // --- INTEGRATIONS VIEW ---
  Widget _buildIntegrations() {
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    final bool isGoogleConnected = user['googleCalendarConnected'] == true || user['googleRefreshToken'] != null;
    final String? connectedEmail = user['googleEmail'] as String?;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
           Container(
             padding: const EdgeInsets.all(20),
             decoration: BoxDecoration(
               color: Colors.white,
               borderRadius: BorderRadius.circular(12),
               border: Border.all(color: Colors.grey[200]!),
               boxShadow: [
                 BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 15, offset: const Offset(0, 4))
               ],
             ),
             child: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 Row(
                   children: [
                     Container(
                       padding: const EdgeInsets.all(10),
                       decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(12)),
                       child: const Icon(LucideIcons.calendar, color: Colors.blue, size: 24),
                     ),
                     const SizedBox(width: 16),
                     Expanded(
                       child: Column(
                         crossAxisAlignment: CrossAxisAlignment.start,
                         children: [
                           Text("Google Calendar", style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700)),
                           if (isGoogleConnected)
                             Text("Connected", style: GoogleFonts.outfit(color: Colors.green, fontWeight: FontWeight.w600, fontSize: 13))
                           else
                             Text("Not Connected", style: GoogleFonts.outfit(color: Colors.grey, fontSize: 13)),
                           // Show connected Gmail email if available
                           if (isGoogleConnected && connectedEmail != null && connectedEmail.isNotEmpty) ...[
                             const SizedBox(height: 6),
                             Container(
                               padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                               decoration: BoxDecoration(
                                 color: Colors.green.withOpacity(0.08),
                                 borderRadius: BorderRadius.circular(20),
                                 border: Border.all(color: Colors.green.withOpacity(0.2)),
                               ),
                               child: Row(
                                 mainAxisSize: MainAxisSize.min,
                                 children: [
                                   // Google "G" logo hint using colored circle
                                   Container(
                                     width: 12,
                                     height: 12,
                                     decoration: const BoxDecoration(
                                       shape: BoxShape.circle,
                                       color: Color(0xFF4285F4),
                                     ),
                                     child: const Center(
                                       child: Text(
                                         'G',
                                         style: TextStyle(
                                           color: Colors.white,
                                           fontSize: 8,
                                           fontWeight: FontWeight.bold,
                                         ),
                                       ),
                                     ),
                                   ),
                                   const SizedBox(width: 5),
                                   Flexible(
                                     child: Text(
                                       connectedEmail,
                                       style: GoogleFonts.outfit(
                                         color: Colors.green[700],
                                         fontSize: 11,
                                         fontWeight: FontWeight.w600,
                                       ),
                                       overflow: TextOverflow.ellipsis,
                                     ),
                                   ),
                                 ],
                               ),
                             ),
                           ],
                         ],
                       ),
                     ),
                     if (isGoogleConnected)
                        const Icon(LucideIcons.checkCircle2, color: Colors.green, size: 24)
                   ],
                 ),
                 const SizedBox(height: 16),
                 Text(
                   "Connect your Google Calendar to automatically sync reminders and events created through Buddy AI.",
                   style: GoogleFonts.outfit(color: Colors.grey[600], height: 1.5),
                 ),
                 const SizedBox(height: 24),
                 if (isGoogleConnected)
                   SizedBox(
                     width: double.infinity,
                     child: OutlinedButton.icon(
                       onPressed: () => _handleUnlinkCalendar(context),
                       icon: const Icon(LucideIcons.link2Off, size: 18),
                       label: Text("Unlink Calendar", style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                       style: OutlinedButton.styleFrom(
                         foregroundColor: Colors.red,
                         side: const BorderSide(color: Colors.red),
                         padding: const EdgeInsets.symmetric(vertical: 12),
                         shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                       ),
                     ),
                   )
                 else
                   SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => _handleConnectGoogleCalendar(context),
                        icon: const Icon(LucideIcons.link, size: 18),
                        label: Text("Connect Calendar", style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Theme.of(context).primaryColor,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    )
               ],
             ),
           ),
        ],
      ),
    );
  }

  Future<void> _handleUnlinkCalendar(BuildContext context) async {
     final confirm = await showDialog<bool>(
       context: context,
       builder: (ctx) => AlertDialog(
         title: Text("Unlink Calendar?", style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
         content: Text("Are you sure you want to stops syncing events?", style: GoogleFonts.outfit()),
         actions: [
           TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
           TextButton(
             onPressed: () => Navigator.pop(ctx, true), 
             child: const Text("Unlink", style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold))
           ),
         ],
       )
     );

     if (confirm == true) {
       await Provider.of<UserProvider>(context, listen: false).unlinkCalendar();
       ToastUtils.showSuccessToast("Calendar unlinked successfully");
     }
  }

  Future<void> _handleConnectGoogleCalendar(BuildContext context) async {
    try {
      final userProvider = Provider.of<UserProvider>(context, listen: false);
      final url = await userProvider.getGoogleAuthUrl();

      if (url == null || url.isEmpty) {
        ToastUtils.showErrorToast("Failed to fetch Google Auth URL. Check admin settings.");
        return;
      }

      final Uri authUri = Uri.parse(url);

      // Try to launch directly — canLaunchUrl is unreliable on Android 11+
      // because it requires explicit <queries> declarations in AndroidManifest.
      // We now have those, but also wrap in try/catch as a belt-and-suspenders approach.
      try {
        final launched = await launchUrl(
          authUri,
          mode: LaunchMode.externalApplication,
        );
        if (!launched) {
          ToastUtils.showErrorToast("Could not open browser. Please try again.");
        }
      } catch (launchError) {
        debugPrint('[Calendar] launchUrl failed: $launchError');
        ToastUtils.showErrorToast("Could not launch Google Auth page: $launchError");
      }
    } catch (e) {
      debugPrint('[Calendar] _handleConnectGoogleCalendar error: $e');
      ToastUtils.showErrorToast("Failed to connect: $e");
    }
  }

  // --- MENU VIEW ---
  Widget _buildMenu() {
    final user = Provider.of<UserProvider>(context).user;
    final primaryColor = Theme.of(context).primaryColor;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Account", style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
          const SizedBox(height: 16),

          // Profile Card
          GestureDetector(
            onTap: () => setState(() => _currentView = _SettingsView.editProfile),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 24, offset: const Offset(0, 8))
                ],
                border: Border.all(color: Colors.grey[100]!),
              ),
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: primaryColor.withOpacity(0.1), width: 3),
                    ),
                    child: ClipOval(
                      child: AppConfig.formatImageUrl(user['profilePicture']) != null
                          ? CachedNetworkImage(
                              imageUrl: AppConfig.formatImageUrl(user['profilePicture'])!,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) => Icon(LucideIcons.user, color: Colors.grey[400]),
                            )
                          : Icon(LucideIcons.user, size: 32, color: Colors.grey[400]),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user['name'] ?? 'Guest User',
                          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700, color: const Color(0xFF1E293B)),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          user['email'] ?? 'No email',
                          style: GoogleFonts.outfit(fontSize: 14, color: Colors.grey[500], fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(LucideIcons.chevronRight, color: Colors.grey[400], size: 20),
                  ),
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 36),

          // Settings Section
          _buildSectionHeader("PREFERENCES"),
          
          _buildSettingsTile(
            icon: LucideIcons.bell,
            title: "Notifications",
            onTap: () => setState(() => _currentView = _SettingsView.notifications),
          ),
          _buildSettingsTile(
            icon: LucideIcons.plug,
            title: "Integrations",
            onTap: () => setState(() => _currentView = _SettingsView.integrations),
          ),
          _buildSettingsTile(
            icon: LucideIcons.lock,
            title: "Privacy & Security",
            onTap: () {}, 
          ),

          const SizedBox(height: 28),

          // Support Section
          _buildSectionHeader("SUPPORT"),
          
          _buildSettingsTile(
            icon: LucideIcons.helpCircle,
            title: "Help Center",
            onTap: () {},
          ),
          _buildSettingsTile(
            icon: LucideIcons.fileText,
            title: "Terms of Service",
            onTap: () {},
          ),

          const SizedBox(height: 28),
          
          // Account Actions
          _buildSectionHeader("ACCOUNT ACTION"),
          
          _buildSettingsTile(
            icon: LucideIcons.logOut,
            title: "Log Out",
            onTap: _handleLogout,
            color: Colors.orange,
          ),
          _buildSettingsTile(
            icon: LucideIcons.trash2,
            title: "Delete Account",
            onTap: _handleDeleteAccount,
            isDestructive: true,
            color: Colors.red,
          ),

          const SizedBox(height: 40),
          Center(
            child: Text(
              "Version 1.0.0", 
              style: GoogleFonts.outfit(color: Colors.grey[300], fontSize: 12, fontWeight: FontWeight.w500)
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 12),
      child: Text(
        title, 
        style: GoogleFonts.outfit(
          fontSize: 12, 
          fontWeight: FontWeight.w800, 
          color: Colors.grey[400], 
          letterSpacing: 1.2
        ),
      ),
    );
  }

  Widget _buildSettingsTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    Color? color,
    bool isDestructive = false,
  }) {
    final themeColor = color ?? Theme.of(context).primaryColor;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey[100]!),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                )
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: themeColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 20, color: themeColor),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: isDestructive ? Colors.red[500] : const Color(0xFF1E293B),
                    ),
                  ),
                ),
                Icon(LucideIcons.chevronRight, color: Colors.grey[300], size: 18),
              ],
            ),
          ),
        ),
      ),
    );
  }


  // --- EDIT PROFILE VIEW ---
  Widget _buildEditProfile() {
    final userProvider = Provider.of<UserProvider>(context);
    final user = userProvider.user;
    final primaryColor = Theme.of(context).primaryColor;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Stack(
              children: [
                Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 4),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10))
                    ],
                  ),
                  child: ClipOval(
                    child: _imageFile != null
                        ? Image.file(_imageFile!, fit: BoxFit.cover)
                        : (AppConfig.formatImageUrl(user['profilePicture']) != null 
                            ? CachedNetworkImage(
                                imageUrl: AppConfig.formatImageUrl(user['profilePicture'])!,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => const CircularProgressIndicator(),
                                errorWidget: (context, url, error) => const Icon(LucideIcons.user, size: 40),
                              )
                            : Container(
                                color: Colors.grey[100],
                                child: Icon(LucideIcons.user, size: 40, color: Colors.grey[400]),
                              )),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: _pickImage,
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: primaryColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: const Icon(LucideIcons.camera, color: Colors.white, size: 16),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),

          _buildLabel("Personal Information"),
          const SizedBox(height: 16),
          
          _buildTextField(_nameController, "Full Name", LucideIcons.user),
          const SizedBox(height: 16),
          // Email — read-only (login identity, cannot be changed)
          _buildReadOnlyField(
            "Email Address",
            user['email'] ?? 'No email on file',
            LucideIcons.mail,
          ),
          const SizedBox(height: 16),
          _buildTextField(_phoneController, "Phone Number", LucideIcons.phone),

          const SizedBox(height: 16),
           _buildTextField(_addressController, "Address", LucideIcons.mapPin, maxLines: 3),
          const SizedBox(height: 24),
          
          _buildLabel("Preferences"),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: _buildDropdown(
                  label: "Date Format",
                  value: _dateFormat,
                  items: const [
                    DropdownMenuItem(value: 'DD/MM/YYYY', child: Text('DD/MM/YYYY')),
                    DropdownMenuItem(value: 'MM/DD/YYYY', child: Text('MM/DD/YYYY')),
                    DropdownMenuItem(value: 'YYYY-MM-DD', child: Text('YYYY-MM-DD')),
                  ],
                  onChanged: (val) => setState(() => _dateFormat = val!),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildDropdown(
                  label: "Time Format",
                  value: _timeFormat,
                  items: const [
                    DropdownMenuItem(value: '12', child: Text('12 Hour')),
                    DropdownMenuItem(value: '24', child: Text('24 Hour')),
                  ],
                  onChanged: (val) => setState(() => _timeFormat = val!),
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 40),
          
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: userProvider.isLoading ? null : _handleSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 4,
                shadowColor: primaryColor.withOpacity(0.4),
              ),
              child: userProvider.isLoading 
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text("Save Changes", style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.outfit(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        color: const Color(0xFF1E293B),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon, {int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600])),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w500, color: Colors.black87),
            decoration: InputDecoration(
              hintText: "Enter your $label",
              hintStyle: GoogleFonts.outfit(color: Colors.grey[400]),
              prefixIcon: Icon(icon, size: 18, color: Colors.grey[400]),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReadOnlyField(String label, String value, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[600])),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.lock, size: 9, color: Colors.grey[400]),
                  const SizedBox(width: 3),
                  Text(
                    'cannot be changed',
                    style: GoogleFonts.outfit(fontSize: 9, color: Colors.grey[400], fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: Row(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Icon(icon, size: 18, color: Colors.grey[350]),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Text(
                    value,
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w500, color: Colors.grey[500]),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }


  Widget _buildDropdown({
    required String label,
    required String value,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.outfit(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: Colors.grey[500],
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: items.any((item) => item.value == value) ? value : items.first.value,
              items: items,
              onChanged: onChanged,
              isExpanded: true,
              style: GoogleFonts.outfit(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF1E293B),
              ),
              icon: Icon(LucideIcons.chevronDown, size: 18, color: Colors.grey[400]),
            ),
          ),
        ),
      ],
    );
  }
}
