import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/login_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';

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
    // Wait for branding to load if it's still loading
    final branding = Provider.of<BrandingProvider>(context, listen: false);
    if (branding.isLoading) {
      // Small delay to allow branding fetch to progress
      await Future.delayed(const Duration(milliseconds: 500));
    }

    await Future.delayed(const Duration(seconds: 2)); // Total splash time
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
        MaterialPageRoute(builder: (_) => const Scaffold(body: Center(child: Text('Home')))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BrandingProvider>(
      builder: (context, branding, _) {
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
                    placeholder: (context, url) => const CircularProgressIndicator(color: Colors.white),
                    errorWidget: (context, url, error) => _buildPlaceholderLogo(),
                  )
                else
                  _buildPlaceholderLogo(),
                const SizedBox(height: 24),
                Text(
                  branding.appName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
              ],
            ),
          ),
        );
      },
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
