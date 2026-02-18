import 'package:flutter/material.dart';
import 'package:buddy_mobile/shared/widgets/mobile_header.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'dart:io';

class AccountSettingsScreen extends StatefulWidget {
  const AccountSettingsScreen({super.key});

  @override
  State<AccountSettingsScreen> createState() => _AccountSettingsScreenState();
}

enum _SettingsView { menu, editProfile, notifications, integrations }

class _AccountSettingsScreenState extends State<AccountSettingsScreen> {
  _SettingsView _currentView = _SettingsView.menu;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  File? _imageFile;

  @override
  void initState() {
    super.initState();
    _loadUserData();
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
          });
        }
      });
    });
  }

  @override
  void dispose() {
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Delete Account', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to permanently delete your account? This action cannot be undone.', style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: GoogleFonts.outfit(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: Text('Delete', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (shouldDelete == true && mounted) {
      final success = await Provider.of<UserProvider>(context, listen: false).deleteAccount();
      if (success && mounted) {
        Provider.of<AuthProvider>(context, listen: false).logout();
      }
    }
  }

  Future<void> _handleLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Log Out', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
        content: Text('Are you sure you want to log out?', style: GoogleFonts.outfit()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: GoogleFonts.outfit(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Log Out', style: GoogleFonts.outfit(fontWeight: FontWeight.bold, color: Theme.of(context).primaryColor)),
          ),
        ],
      ),
    );

    if (shouldLogout == true && mounted) {
       Provider.of<AuthProvider>(context, listen: false).logout();
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
        body: SafeArea(
          child: Column(
            children: [
              // Header logic based on view
              if (_currentView == _SettingsView.menu)
                const MobileHeader()
              else
                _buildSubHeader(),

              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _buildCurrentView(),
                ),
              ),
            ],
          ),
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
      case _SettingsView.integrations:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.construction, size: 48, color: Colors.grey[300]),
              const SizedBox(height: 16),
              Text("Coming Soon", style: GoogleFonts.outfit(color: Colors.grey[500], fontSize: 16)),
            ],
          ),
        );
    }
  }

  // --- MENU VIEW ---
  Widget _buildMenu() {
    final user = Provider.of<UserProvider>(context).user;
    final primaryColor = Theme.of(context).primaryColor;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Account", style: GoogleFonts.outfit(fontSize: 28, fontWeight: FontWeight.w800, color: const Color(0xFF1E293B))),
          const SizedBox(height: 24),

          // Profile Card
          GestureDetector(
            onTap: () => setState(() => _currentView = _SettingsView.editProfile),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
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
                      child: user['profilePicture'] != null
                          ? CachedNetworkImage(
                              imageUrl: user['profilePicture'],
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
    final themeColor = color ?? const Color(0xFF6366F1);
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
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
      padding: const EdgeInsets.all(20),
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
                        : (user['profilePicture'] != null 
                            ? CachedNetworkImage(
                                imageUrl: user['profilePicture'],
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
          _buildTextField(_phoneController, "Phone Number", LucideIcons.phone),
          const SizedBox(height: 16),
           _buildTextField(_addressController, "Address", LucideIcons.mapPin, maxLines: 3),
          
          const SizedBox(height: 40),
          
          SizedBox(
            width: double.infinity,
            height: 54,
            child: ElevatedButton(
              onPressed: userProvider.isLoading ? null : _handleSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
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
}
