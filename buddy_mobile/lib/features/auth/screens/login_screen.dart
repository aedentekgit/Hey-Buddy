import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/signup_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  void _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    
    if (email.isEmpty || password.isEmpty) {
      ToastUtils.showErrorToast('Please fill in all fields');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.login(email, password);
    
    if (!mounted) return;
    
    if (success) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainScreen()),
      );
    } else {
      ToastUtils.showErrorToast('Invalid email or password');
    }
  }

  void _handleGoogleLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.googleLogin();
    
    if (!mounted) return;
    
    if (success) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const MainScreen()),
      );
    } else {
      // Don't show error if cancelled, AuthProvider already handles logging errors
      if (auth.isLoading == false && auth.token == null) {
        // Only show toast if it wasn't a manual cancellation
        // ToastUtils.showErrorToast('Google login failed');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const Spacer(flex: 2),
                    if (branding.logoUrl != null)
                      CachedNetworkImage(
                        imageUrl: branding.logoUrl!,
                        height: 60,
                        errorWidget: (context, url, error) => Icon(Icons.auto_awesome, size: 40, color: branding.primaryColor),
                      )
                    else
                      Icon(Icons.auto_awesome, size: 40, color: branding.primaryColor),
                    const SizedBox(height: 16),
                    Text(
                      "Welcome to ${branding.appName}",
                      style: GoogleFonts.outfit(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    Text(
                      "Sign in to continue your journey",
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const Spacer(flex: 2),
                    _buildTextField(
                      controller: _emailController,
                      label: "Email Address",
                      hint: "Enter your email",
                      icon: Icons.alternate_email,
                    ),
                    const SizedBox(height: 20),
                    _buildTextField(
                      controller: _passwordController,
                      label: "Password",
                      hint: "Enter your password",
                      icon: Icons.lock_outline,
                      isPassword: true,
                      obscure: _obscurePassword,
                      onToggle: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: Text(
                          "Forgot Password?",
                          style: GoogleFonts.inter(
                            color: branding.primaryColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E293B), // Premium dark slate
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: Provider.of<AuthProvider>(context).isLoading
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : Text("Sign In", style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const Spacer(flex: 1),
                    Row(
                      children: [
                        const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text("Or sign in with", style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF94A3B8))),
                        ),
                        const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _socialButton(
                          Icons.g_mobiledata, 
                          const Color(0xFFEA4335),
                          onTap: _handleGoogleLogin,
                        ),
                        const SizedBox(width: 16),
                        _socialButton(Icons.facebook, const Color(0xFF1877F2)),
                        const SizedBox(width: 16),
                        _socialButton(Icons.apple, Colors.black),
                      ],
                    ),
                    const Spacer(flex: 2),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text("Don't have an account? ", style: GoogleFonts.inter(color: const Color(0xFF64748B))),
                        GestureDetector(
                          onTap: () {
                            Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SignupScreen()));
                          },
                          child: Text(
                            "Sign up",
                            style: GoogleFonts.inter(
                              color: branding.primaryColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const Spacer(flex: 1),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    bool obscure = false,
    VoidCallback? onToggle,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w600, color: const Color(0xFF1E293B)),
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscure,
            style: GoogleFonts.inter(fontSize: 15),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
              suffixIcon: isPassword
                  ? IconButton(onPressed: onToggle, icon: Icon(obscure ? Icons.visibility_off : Icons.visibility, color: const Color(0xFF94A3B8), size: 18))
                  : null,
              hintText: hint,
              hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 14),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              isDense: true,
            ),
          ),
        ),
      ],
    );
  }

  Widget _socialButton(IconData icon, Color color, {VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFE2E8F0)),
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(icon, color: color, size: 28),
      ),
    );
  }
}
