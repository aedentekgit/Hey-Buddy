import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:google_fonts/google_fonts.dart';

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
    
    if (branding.hasError) return; // Stop here if there's a backend error

    await Future.delayed(const Duration(seconds: 1)); // Extra total splash time for branding
    if (!mounted) return;
    
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.tryAutoLogin();
    
    if (!mounted) return;
    
    if (auth.token == null) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    } else {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BrandingProvider>(
      builder: (context, branding, _) {
        if (branding.hasError) {
          return _buildErrorScreen(branding);
        }
        return Scaffold(
          backgroundColor: branding.primaryColor,
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (branding.splashUrl != null)
                  CachedNetworkImage(
                    imageUrl: branding.splashUrl!,
                    height: 120,
                    placeholder: (context, url) => const CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    errorWidget: (context, url, error) => _buildPlaceholderLogo(),
                  )
                else
                  _buildPlaceholderLogo(),
                const SizedBox(height: 24),
                Text(
                  branding.appName,
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 16),
                const CircularProgressIndicator(color: Colors.white70, strokeWidth: 2),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildErrorScreen(BrandingProvider branding) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Padding(
        padding: const EdgeInsets.all(40),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.cloud_off, size: 80, color: Colors.red.shade400),
              ),
              const SizedBox(height: 32),
              Text(
                "Connection Failed",
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                "The backend server is currently unreachable. Please check your internet connection or the server status.",
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  color: const Color(0xFF64748B),
                  height: 1.5,
                ),
              ),
              if (branding.errorMessage != null) ...[
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    branding.errorMessage!,
                    style: GoogleFonts.firaCode(fontSize: 12, color: const Color(0xFF475569)),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
              const SizedBox(height: 48),
              ElevatedButton.icon(
                onPressed: () {
                  branding.fetchBranding();
                  _checkAuth();
                },
                icon: const Icon(Icons.refresh),
                label: const Text("Retry Connection"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: branding.primaryColor,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(200, 56),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderLogo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white, width: 2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Icon(Icons.eco, size: 80, color: Colors.white),
    );
  }
}
