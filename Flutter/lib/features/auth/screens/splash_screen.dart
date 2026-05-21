// ignore_for_file: unused_element
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/core/providers/security_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final branding = Provider.of<BrandingProvider>(context, listen: false);

    // Wait for initial branding load
    while (branding.isLoading) {
      await Future.delayed(const Duration(milliseconds: 100));
    }

    if (!mounted) return;
    
    // PRIME ALL IMAGES (GIFs) TO LOAD IMMEDIATELY
    await branding.precacheAllImages(context);

    if (branding.hasError) return;

    await Future.delayed(const Duration(seconds: 1));
    if (!mounted) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.tryAutoLogin();

    // Request location permission centrally
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
    } catch (_) {}

    if (!mounted) return;

    // Biometric Security Check
    final security = Provider.of<SecurityProvider>(context, listen: false);
    if (auth.token != null && security.isBiometricEnabled) {
      final authenticated = await security.authenticate();
      if (!authenticated) {
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
        return;
      }
    }

    if (!mounted) return;

    // Always go to MainScreen; default to Explore tab (index 1) for logged-in users
    final auth2 = Provider.of<AuthProvider>(context, listen: false);
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(
      builder: (_) => MainScreen(initialIndex: auth2.token != null ? 1 : 0),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BrandingProvider>(
      builder: (context, branding, _) {
        if (branding.hasError) {
          return _buildErrorScreen(branding);
        }
        return Scaffold(
          backgroundColor: AppColors.bg,
          body: Stack(
            children: [
              // ── Background Gradients ────────────────────────
              Positioned(
                top: -150,
                right: -150,
                child: Container(
                  width: 400,
                  height: 400,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: branding.primaryColor.withValues(alpha: 0.08),
                  ),
                ),
              ),
              Positioned(
                bottom: -100,
                left: -100,
                child: Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.accent.withValues(alpha: 0.08),
                  ),
                ),
              ),

              Center(
                child: Hero(
                  tag: 'app_logo',
                  child: Container(
                    child: branding.splashUrl != null && branding.splashUrl!.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: branding.splashUrl!,
                            height: 320,
                            fit: BoxFit.contain,
                            placeholder: (context, url) => Image.asset(
                              'assets/images/buddy_logo.png',
                              height: 120,
                            ),
                            errorWidget: (context, url, error) => Image.asset(
                              'assets/images/buddy_logo.png',
                              height: 120,
                            ),
                          )
                        : Image.asset(
                            'assets/images/buddy_logo.png',
                            height: 120,
                          ),
                  ),
                ),
              ),

              // Developer Gear Button
              Positioned(
                top: MediaQuery.of(context).padding.top + 10,
                right: 20,
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _showConfigureIpDialog(context),
                    borderRadius: BorderRadius.circular(50),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.07),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withOpacity(0.15),
                          width: 1.5,
                        ),
                      ),
                      child: const Icon(
                        LucideIcons.settings,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildErrorScreen(BrandingProvider branding) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      LucideIcons.cloudOff,
                      size: 64,
                      color: Colors.red.shade400,
                    ),
                  ),
                  const SizedBox(height: 32),
                  Text(
                    "Connection Offline",
                    style: GoogleFonts.outfit(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF1E293B),
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "I'm unable to connect to the intelligence server. Please check your data connection and try again.",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF64748B),
                      height: 1.5,
                    ),
                  ),
                  if (branding.errorMessage != null) ...[
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        branding.errorMessage!,
                        style: GoogleFonts.firaCode(
                          fontSize: 12,
                          color: const Color(0xFF475569),
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                  const SizedBox(height: 48),
                  SizedBox(
                    width: double.infinity,
                    height: 58,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        branding.fetchBranding();
                        _checkAuth();
                      },
                      icon: const Icon(LucideIcons.rotateCcw, size: 18),
                      label: Text(
                        "Retry Connection",
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: branding.primaryColor,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 58,
                    child: OutlinedButton.icon(
                      onPressed: () => _showConfigureIpDialog(context),
                      icon: const Icon(LucideIcons.settings, size: 18),
                      label: Text(
                        "Configure Server IP",
                        style: GoogleFonts.outfit(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF64748B),
                        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            right: 20,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => _showConfigureIpDialog(context),
                borderRadius: BorderRadius.circular(50),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200.withOpacity(0.5),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.grey.shade300,
                      width: 1.5,
                    ),
                  ),
                  child: const Icon(
                    LucideIcons.settings,
                    color: Color(0xFF64748B),
                    size: 24,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showConfigureIpDialog(BuildContext context) async {
    final branding = Provider.of<BrandingProvider>(context, listen: false);
    final prefs = await SharedPreferences.getInstance();
    final controller = TextEditingController(
      text: prefs.getString('custom_server_host') ?? '',
    );

    if (!context.mounted) return;

    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (dialogCtx) {
        return AlertDialog(
          backgroundColor: const Color(0xFF0F172A), // Premium dark mode background
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
            side: const BorderSide(color: Color(0xFF334155), width: 1.5),
          ),
          title: Row(
            children: [
              Icon(
                LucideIcons.settings,
                color: branding.themeData.primaryColor,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                "Configure Backend IP",
                style: GoogleFonts.outfit(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 20,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Enter your computer's local IP address and port (e.g. 192.168.1.15:5001) to connect this app to your local backend.",
                style: GoogleFonts.inter(
                  color: const Color(0xFF94A3B8),
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: controller,
                style: GoogleFonts.firaCode(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  labelText: "Server IP & Port",
                  labelStyle: GoogleFonts.inter(color: const Color(0xFF64748B)),
                  hintText: "192.168.1.15:5001",
                  hintStyle: GoogleFonts.firaCode(color: const Color(0xFF475569)),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: Color(0xFF334155)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide(
                      color: branding.themeData.primaryColor,
                    ),
                  ),
                  prefixIcon: const Icon(LucideIcons.globe, color: Color(0xFF64748B), size: 18),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                "Leave blank to use defaults (ayuskart.com in release, 10.0.2.2:5001 in emulator debug).",
                style: GoogleFonts.inter(
                  color: const Color(0xFF64748B),
                  fontSize: 12,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: Text(
                "Cancel",
                style: GoogleFonts.inter(color: const Color(0xFF94A3B8)),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                final host = controller.text.trim();
                if (host.isEmpty) {
                  await prefs.remove('custom_server_host');
                  AppConfig.customHostOverride = null;
                } else {
                  await prefs.setString('custom_server_host', host);
                  AppConfig.customHostOverride = host;
                }
                if (dialogCtx.mounted) {
                  Navigator.of(dialogCtx).pop();
                }
                // Refresh connection
                branding.fetchBranding();
                _checkAuth();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: branding.themeData.primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(
                "Save & Connect",
                style: GoogleFonts.outfit(fontWeight: FontWeight.bold),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildPlaceholderLogo(BrandingProvider branding) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: branding.primaryColor.withValues(alpha: 0.1),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Icon(Icons.auto_awesome, size: 48, color: branding.primaryColor),
    );
  }
}
