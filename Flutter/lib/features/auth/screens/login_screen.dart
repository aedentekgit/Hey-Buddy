import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/signup_screen.dart';
import 'package:buddy_mobile/features/auth/screens/forgot_password_screen.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:buddy_mobile/features/home/screens/main_screen.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/core/providers/security_provider.dart';
import 'package:buddy_mobile/shared/dialogs/biometric_prompt_dialog.dart';
import 'package:buddy_mobile/shared/utils/text_formatters.dart';
import 'package:flutter/services.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _autoCheckBiometrics();
    });
  }

  Future<void> _autoCheckBiometrics() async {
    final security = Provider.of<SecurityProvider>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);

    // If we have no token in memory, try to load from storage
    // (This works if logout preserved the token for biometric use)
    if (auth.token == null) {
      await auth.tryAutoLogin();
    }

    // If still no token, we can't do biometric login
    if (auth.token == null) return;

    if (security.isBiometricEnabled) {
      final success = await security.authenticate();
      if (success && mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainScreen()),
        );
      }
    }
  }

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
      if (!mounted) return;
      await _checkAndPromptBiometrics();
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const MainScreen()));
    } else {
      ToastUtils.showErrorToast('Invalid email or password');
    }
  }

  Future<void> _checkAndPromptBiometrics() async {
    final security = Provider.of<SecurityProvider>(context, listen: false);
    if (security.isHardwareAvailable && !security.isBiometricEnabled) {
      final prompted = await security.hasBeenPrompted();
      if (!prompted) {
        if (!mounted) return;
        final bool? result = await showDialog<bool>(
          context: context,
          builder: (context) => const BiometricPromptDialog(),
        );

        if (result == true) {
          await security.toggleBiometric(true);
        }
        await security.setPrompted();
      }
    }
  }

  void _handleGoogleLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.googleLogin();

    if (!mounted) return;

    if (success) {
      if (!mounted) return;
      await _checkAndPromptBiometrics();
      if (!mounted) return;
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const MainScreen()));
    } else {
      if (auth.isLoading == false && auth.token == null) {
        // AuthProvider handles logging errors
      }
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
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: branding.primaryColor.withValues(alpha: 0.05),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            left: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.accent.withValues(alpha: 0.05),
              ),
            ),
          ),

          SafeArea(
            child: CustomScrollView(
              slivers: [
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      children: [
                        const Spacer(flex: 2),
                        // ── Logo & Greeting ──────────────────────────
                        Hero(
                          tag: 'app_logo',
                          child: Container(
                            child: branding.logoUrl != null
                                ? CachedNetworkImage(
                                    imageUrl: branding.logoUrl!,
                                    height: 50,
                                    errorWidget: (context, url, error) => Icon(
                                      Icons.auto_awesome,
                                      size: 40,
                                      color: branding.primaryColor,
                                    ),
                                  )
                                : Icon(
                                    Icons.auto_awesome,
                                    size: 40,
                                    color: branding.primaryColor,
                                  ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          "Welcome Back",
                          style: GoogleFonts.outfit(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            color: AppColors.text,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Sign in to continue your journey with ${branding.appName}",
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            color: const Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const Spacer(flex: 2),

                        // ── Login Form ────────────────────────────────
                        _buildTextField(
                          controller: _emailController,
                          label: "EMAIL ADDRESS",
                          hint: "alex@example.com",
                          icon: LucideIcons.mail,
                          keyboardType: TextInputType.emailAddress,
                          inputFormatters: [LowerCaseTextFormatter()],
                        ),
                        const SizedBox(height: 20),
                        _buildTextField(
                          controller: _passwordController,
                          label: "PASSWORD",
                          hint: "••••••••",
                          icon: LucideIcons.lock,
                          isPassword: true,
                          obscure: _obscurePassword,
                          onToggle: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: () {
                              Navigator.of(context).push(
                                MaterialPageRoute(
                                  builder: (_) => const ForgotPasswordScreen(),
                                ),
                              );
                            },
                            style: TextButton.styleFrom(
                              foregroundColor: branding.primaryColor,
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 30),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              "Forgot Password?",
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),

                        Consumer<SecurityProvider>(
                          builder: (context, security, _) {
                            final auth = Provider.of<AuthProvider>(
                              context,
                              listen: false,
                            );
                            if (security.isBiometricEnabled &&
                                auth.token != null) {
                              return Padding(
                                padding: const EdgeInsets.only(top: 10),
                                child: TextButton.icon(
                                  onPressed: () async {
                                    final navigator = Navigator.of(context);
                                    final success = await security
                                        .authenticate();
                                    if (success) {
                                      navigator.pushReplacement(
                                        MaterialPageRoute(
                                          builder: (_) => const MainScreen(),
                                        ),
                                      );
                                    }
                                  },
                                  icon: const Icon(
                                    LucideIcons.fingerprint,
                                    size: 20,
                                  ),
                                  label: Text(
                                    "Quick Unlock with Biometrics",
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  style: TextButton.styleFrom(
                                    foregroundColor: branding.primaryColor,
                                  ),
                                ),
                              );
                            }
                            return const SizedBox.shrink();
                          },
                        ),
                        const SizedBox(height: 28),

                        // ── Sign In Button ────────────────────────────
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: _handleLogin,
                            style:
                                ElevatedButton.styleFrom(
                                  backgroundColor: branding.primaryColor,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(18),
                                  ),
                                  elevation: 0,
                                  shadowColor: branding.primaryColor
                                      .withValues(alpha: 0.5),
                                ).copyWith(
                                  elevation:
                                      WidgetStateProperty.resolveWith<double>((
                                        states,
                                      ) {
                                        if (states.contains(
                                          WidgetState.pressed,
                                        )) {
                                          return 0;
                                        }
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
                                    "Sign In",
                                    style: GoogleFonts.outfit(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                        const Spacer(flex: 1),

                        // ── Social Login ──────────────────────────────
                        Row(
                          children: [
                            const Expanded(
                              child: Divider(color: Color(0xFFE2E8F0)),
                            ),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              child: Text(
                                "Or continue with",
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: const Color(0xFF94A3B8),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            const Expanded(
                              child: Divider(color: Color(0xFFE2E8F0)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _socialButton(
                              LucideIcons.mail,
                              const Color(0xFFEA4335),
                              onTap: _handleGoogleLogin,
                            ),
                            const SizedBox(width: 20),
                            _socialButton(
                              LucideIcons.facebook,
                              const Color(0xFF1877F2),
                            ),
                            const SizedBox(width: 20),
                            _socialButton(LucideIcons.apple, AppColors.text),
                          ],
                        ),
                        const Spacer(flex: 2),

                        // ── Footer ────────────────────────────────────
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              "New here? ",
                              style: GoogleFonts.inter(
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => const SignupScreen(),
                                  ),
                                );
                              },
                              child: Text(
                                "Create an account",
                                style: GoogleFonts.inter(
                                  color: branding.primaryColor,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Spacer(flex: 1),
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

  Widget _socialButton(IconData icon, Color color, {VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 70,
        height: 56,
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.border, width: 1.5),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Icon(icon, color: color, size: 24),
      ),
    );
  }
}
