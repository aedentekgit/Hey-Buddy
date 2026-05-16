import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/shared/utils/text_formatters.dart';
import 'package:flutter/services.dart';

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
    final isLoading = Provider.of<AuthProvider>(context).isLoading;

    return Scaffold(
      backgroundColor: AppColors.bg,
      // No AppBar to remove back button and header
      body: Stack(
        children: [
          // ── No Decorative Background ──────────────────────────

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 20),
                  Text(
                    _currentStep == 0
                        ? "Reset Password"
                        : _currentStep == 1
                        ? "Verify OTP"
                        : "New Password",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: AppColors.text,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _currentStep == 0
                        ? "Enter your email address to receive a verification code."
                        : _currentStep == 1
                        ? "We've sent a 6-digit code to your email."
                        : "At least 6 characters to keep your account secure.",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 40),

                  if (_currentStep == 0) ...[
                    _buildTextField(
                      controller: _emailController,
                      label: "EMAIL ADDRESS",
                      hint: "alex@example.com",
                      icon: LucideIcons.mail,
                      keyboardType: TextInputType.emailAddress,
                      inputFormatters: [LowerCaseTextFormatter()],
                    ),
                    const SizedBox(height: 32),
                    _buildButton(
                      text: "Get OTP",
                      isLoading: isLoading,
                      onPressed: _handleSendOtp,
                    ),
                  ] else if (_currentStep == 1) ...[
                    _buildTextField(
                      controller: _otpController,
                      label: "VERIFICATION CODE",
                      hint: "0 0 0 0 0 0",
                      icon: LucideIcons.key,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 32),
                    _buildButton(
                      text: "Verify Code",
                      isLoading: isLoading,
                      onPressed: _handleVerifyOtp,
                    ),
                  ] else if (_currentStep == 2) ...[
                    _buildTextField(
                      controller: _passwordController,
                      label: "NEW PASSWORD",
                      hint: "••••••••",
                      icon: LucideIcons.lock,
                      isPassword: true,
                      obscure: _obscurePassword,
                      onToggle: () =>
                          setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    const SizedBox(height: 32),
                    _buildButton(
                      text: "Update Password",
                      isLoading: isLoading,
                      onPressed: _handleResetPassword,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
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
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    List<TextInputFormatter>? inputFormatters,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF64748B),
              letterSpacing: 1.2,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.border, width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TextField(
            controller: controller,
            obscureText: obscure,
            keyboardType: keyboardType,
            textCapitalization: textCapitalization,
            inputFormatters: inputFormatters,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.text,
            ),
            decoration: InputDecoration(
              prefixIcon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
              suffixIcon: isPassword
                  ? IconButton(
                      onPressed: onToggle,
                      icon: Icon(
                        obscure ? LucideIcons.eyeOff : LucideIcons.eye,
                        color: const Color(0xFF94A3B8),
                        size: 18,
                      ),
                    )
                  : null,
              hintText: hint,
              hintStyle: GoogleFonts.inter(
                color: const Color(0xFF94A3B8),
                fontSize: 14,
                fontWeight: FontWeight.w400,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 12,
              ),
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
    final branding = Provider.of<BrandingProvider>(context, listen: false);
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style:
            ElevatedButton.styleFrom(
              backgroundColor: branding.primaryColor,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
              elevation: 0,
              shadowColor: branding.primaryColor.withValues(alpha: 0.5),
            ).copyWith(
              elevation: WidgetStateProperty.resolveWith<double>((states) {
                if (states.contains(WidgetState.pressed)) return 0;
                return 12;
              }),
            ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : Text(
                text,
                style: GoogleFonts.outfit(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
      ),
    );
  }
}
