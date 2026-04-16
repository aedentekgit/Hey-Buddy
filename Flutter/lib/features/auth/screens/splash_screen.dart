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

    final auth2 = Provider.of<AuthProvider>(context, listen: false);
    if (auth2.token == null) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
      return;
    }

    Navigator.of(
      context,
    ).pushReplacement(
      MaterialPageRoute(builder: (_) => const MainScreen(initialIndex: 1)),
    );
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
                            placeholder: (context, url) => _buildPlaceholderLogo(branding),
                            errorWidget: (context, url, error) => _buildPlaceholderLogo(branding),
                          )
                        : _buildPlaceholderLogo(branding),
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
      body: Center(
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
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderLogo(BrandingProvider branding) {
    return Container(
      width: 120,
      height: 120,
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
      child: Center(
        child: Icon(Icons.auto_awesome, size: 48, color: branding.primaryColor),
      ),
    );
  }
}
