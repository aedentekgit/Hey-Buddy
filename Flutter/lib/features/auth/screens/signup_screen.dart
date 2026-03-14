import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/shared/utils/text_formatters.dart';
import 'package:flutter/services.dart';

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
    final result = await auth.register(name, email, password);

    if (!mounted) return;

    if (result['success'] == true) {
      ToastUtils.showSuccessToast('Account created! Please sign in.');
      Navigator.of(context).pop();
    } else {
      String error =
          result['message'] ?? 'Registration failed. Email might be taken.';
      ToastUtils.showErrorToast(error);
    }
  }

  @override
  Widget build(BuildContext context) {
    final branding = Provider.of<BrandingProvider>(context);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Stack(
        children: [
          // ── Decorative Background ──────────────────────────
          Positioned(
            top: -100,
            left: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: branding.primaryColor.withValues(alpha: 0.05),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const SizedBox(height: 40),
                  Hero(
                    tag: 'app_logo',
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: branding.primaryColor.withValues(alpha: 0.1),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: branding.logoUrl != null
                          ? CachedNetworkImage(
                              imageUrl: branding.logoUrl!,
                              height: 40,
                              errorWidget: (context, url, error) => Icon(
                                Icons.auto_awesome,
                                size: 30,
                                color: branding.primaryColor,
                              ),
                            )
                          : Icon(
                              Icons.auto_awesome,
                              size: 30,
                              color: branding.primaryColor,
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    "Join ${branding.appName}",
                    style: GoogleFonts.outfit(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF1E293B),
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "Sign up to experience private, intelligent AI",
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 36),
                  _buildTextField(
                    controller: _nameController,
                    label: "FULL NAME",
                    hint: "Alex Johnson",
                    icon: LucideIcons.user,
                  ),
                  const SizedBox(height: 18),
                  _buildTextField(
                    controller: _emailController,
                    label: "EMAIL ADDRESS",
                    hint: "alex@example.com",
                    icon: LucideIcons.mail,
                    keyboardType: TextInputType.emailAddress,
                    inputFormatters: [LowerCaseTextFormatter()],
                  ),
                  const SizedBox(height: 18),
                  _buildTextField(
                    controller: _passwordController,
                    label: "PASSWORD",
                    hint: "Create password",
                    icon: LucideIcons.lock,
                    isPassword: true,
                    obscure: _obscurePassword,
                    onToggle: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                  const SizedBox(height: 18),
                  _buildTextField(
                    controller: _confirmPasswordController,
                    label: "CONFIRM PASSWORD",
                    hint: "Repeat password",
                    icon: LucideIcons.shieldCheck,
                    isPassword: true,
                    obscure: _obscureConfirmPassword,
                    onToggle: () => setState(
                      () => _obscureConfirmPassword = !_obscureConfirmPassword,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _agreedToTerms,
                          onChanged: (val) =>
                              setState(() => _agreedToTerms = val ?? false),
                          activeColor: branding.primaryColor,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text.rich(
                          TextSpan(
                            text: "I agree to the ",
                            children: [
                              TextSpan(
                                text: "Terms of Service",
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w800,
                                  color: branding.primaryColor,
                                ),
                              ),
                              const TextSpan(text: " and "),
                              TextSpan(
                                text: "Privacy Policy",
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w800,
                                  color: branding.primaryColor,
                                ),
                              ),
                            ],
                          ),
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 58,
                    child: ElevatedButton(
                      onPressed: Provider.of<AuthProvider>(context).isLoading
                          ? null
                          : _handleSignup,
                      style:
                          ElevatedButton.styleFrom(
                            backgroundColor: branding.primaryColor,
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: branding.primaryColor
                                .withValues(alpha: 0.6),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(18),
                            ),
                            elevation: 0,
                            shadowColor: branding.primaryColor.withValues(alpha: 0.5),
                          ).copyWith(
                            elevation: WidgetStateProperty.resolveWith<double>((
                              states,
                            ) {
                              if (states.contains(WidgetState.pressed))
                                return 0;
                              return 12;
                            }),
                          ),
                      child: Provider.of<AuthProvider>(context).isLoading
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Text(
                              "Create Account",
                              style: GoogleFonts.outfit(
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Already joined? ",
                        style: GoogleFonts.inter(
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Text(
                          "Sign in here",
                          style: GoogleFonts.inter(
                            color: branding.primaryColor,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  FutureBuilder<PackageInfo>(
                    future: PackageInfo.fromPlatform(),
                    builder: (context, snapshot) {
                      if (snapshot.hasData) {
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: Text(
                            "Version ${snapshot.data!.version}",
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
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
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
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
            inputFormatters: inputFormatters,
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF1E293B),
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
                vertical: 18,
              ),
              isDense: true,
            ),
          ),
        ),
      ],
    );
  }
}
