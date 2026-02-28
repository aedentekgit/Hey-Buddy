import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreedToTerms = false;

  void _handleSignup() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final confirmPassword = _confirmPasswordController.text.trim();
    
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      ToastUtils.showErrorToast('Please fill in all fields');
      return;
    }

    if (password != confirmPassword) {
      ToastUtils.showErrorToast('Passwords do not match');
      return;
    }

    if (!_agreedToTerms) {
      ToastUtils.showErrorToast('Please agree to the terms and policy');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.register(name, email, password);
    
    if (!mounted) return;
    
    if (success) {
      ToastUtils.showSuccessToast('Account created! Please sign in.');
      Navigator.of(context).pop();
    } else {
      ToastUtils.showErrorToast('Registration failed. Email might be taken.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 48),
              Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_ios_new, size: 20, color: Color(0xFF1E293B)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (branding.logoUrl != null)
                CachedNetworkImage(
                  imageUrl: branding.logoUrl!,
                  height: 50,
                  errorWidget: (context, url, error) => Icon(Icons.auto_awesome, size: 40, color: branding.primaryColor),
                )
              else
                Icon(Icons.auto_awesome, size: 40, color: branding.primaryColor),
              const SizedBox(height: 16),
              Text(
                "Create Account",
                style: GoogleFonts.outfit(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1E293B),
                ),
              ),
              Text(
                "Join Dialogue to experience private AI",
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 40),
              _buildTextField(
                controller: _nameController,
                label: "Full Name",
                hint: "Enter your name",
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _emailController,
                label: "Email Address",
                hint: "Enter your email",
                icon: Icons.alternate_email,
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _passwordController,
                label: "Password",
                hint: "Create a password",
                icon: Icons.lock_outline,
                isPassword: true,
                obscure: _obscurePassword,
                onToggle: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
              const SizedBox(height: 16),
              _buildTextField(
                controller: _confirmPasswordController,
                label: "Confirm Password",
                hint: "Repeat your password",
                icon: Icons.lock_reset_outlined,
                isPassword: true,
                obscure: _obscureConfirmPassword,
                onToggle: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: _agreedToTerms,
                      onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
                      activeColor: branding.primaryColor,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text.rich(
                      TextSpan(
                        text: "I've read and agreed to ",
                        children: [
                          TextSpan(
                            text: "User Agreement",
                            style: GoogleFonts.inter(fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
                          ),
                          const TextSpan(text: " and "),
                          TextSpan(
                            text: "Privacy Policy",
                            style: GoogleFonts.inter(fontWeight: FontWeight.w700, decoration: TextDecoration.underline),
                          ),
                        ],
                      ),
                      style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B)),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _handleSignup,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Provider.of<AuthProvider>(context).isLoading
                      ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text("Create Account", style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text("Already have an account? ", style: GoogleFonts.inter(color: const Color(0xFF64748B))),
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Text(
                      "Sign in",
                      style: GoogleFonts.inter(
                        color: branding.primaryColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
            ],
          ),
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

  Widget _socialButton(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey[300]!),
        borderRadius: BorderRadius.circular(50),
      ),
      child: Icon(icon, color: color, size: 24),
    );
  }
}
