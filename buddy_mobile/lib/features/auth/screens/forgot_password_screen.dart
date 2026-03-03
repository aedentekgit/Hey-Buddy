import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _obscurePassword = true;
  int _currentStep = 0; // 0: Email, 1: OTP, 2: New Password

  void _handleSendOtp() async {
    final email = _emailController.text.trim();
    if (email.isEmpty) {
      ToastUtils.showErrorToast('Please enter your email');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.forgotPassword(email);
    
    if (success && mounted) {
      setState(() {
        _currentStep = 1;
      });
    }
  }

  void _handleVerifyOtp() async {
    final email = _emailController.text.trim();
    final otp = _otpController.text.trim();
    if (otp.isEmpty || otp.length < 6) {
      ToastUtils.showErrorToast('Please enter a valid OTP');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.verifyResetOtp(email, otp);
    
    if (success && mounted) {
      setState(() {
        _currentStep = 2;
      });
    }
  }

  void _handleResetPassword() async {
    final email = _emailController.text.trim();
    final otp = _otpController.text.trim();
    final newPassword = _passwordController.text.trim();
    if (newPassword.isEmpty || newPassword.length < 6) {
      ToastUtils.showErrorToast('Password must be at least 6 characters');
      return;
    }

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.resetPassword(email, otp, newPassword);
    
    if (success && mounted) {
      Navigator.of(context).pop(); // Go back to login screen
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);
    final isLoading = Provider.of<AuthProvider>(context).isLoading;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFF),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF1E293B)),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 24),
              Text(
                _currentStep == 0 
                  ? "Forgot Password?" 
                  : _currentStep == 1 
                    ? "Verify OTP" 
                    : "Reset Password",
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _currentStep == 0 
                  ? "Enter your email address to receive an OTP." 
                  : _currentStep == 1 
                    ? "Enter the 6-digit OTP sent to your email." 
                    : "Create a new strong password.",
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 32),
              
              if (_currentStep == 0) ...[
                _buildTextField(
                  controller: _emailController,
                  label: "Email Address",
                  hint: "Enter your email",
                  icon: Icons.alternate_email,
                ),
                const SizedBox(height: 24),
                _buildButton(
                  text: "Send OTP",
                  isLoading: isLoading,
                  onPressed: _handleSendOtp,
                ),
              ] else if (_currentStep == 1) ...[
                _buildTextField(
                  controller: _otpController,
                  label: "OTP",
                  hint: "Enter 6-digit OTP",
                  icon: Icons.lock_clock,
                ),
                const SizedBox(height: 24),
                _buildButton(
                  text: "Verify OTP",
                  isLoading: isLoading,
                  onPressed: _handleVerifyOtp,
                ),
              ] else if (_currentStep == 2) ...[
                _buildTextField(
                  controller: _passwordController,
                  label: "New Password",
                  hint: "Enter your new password",
                  icon: Icons.lock_outline,
                  isPassword: true,
                  obscure: _obscurePassword,
                  onToggle: () => setState(() => _obscurePassword = !_obscurePassword),
                ),
                const SizedBox(height: 24),
                _buildButton(
                  text: "Reset Password",
                  isLoading: isLoading,
                  onPressed: _handleResetPassword,
                ),
              ],
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

  Widget _buildButton({
    required String text,
    required bool isLoading,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: Provider.of<BrandingProvider>(context).primaryColor,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0,
        ),
        child: isLoading
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
            : Text(text, style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w600)),
      ),
    );
  }
}
