import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    Provider.of<BrandingProvider>(context);
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(36),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                  BoxShadow(
                    color: AppColors.accent.withValues(alpha: 0.04),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
                border: Border.all(
                  color: AppColors.border.withValues(alpha: 0.8),
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.text.withValues(alpha: 0.03),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        LucideIcons.arrowLeft,
                        size: 19,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Privacy Policy',
                      style: GoogleFonts.nunito(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: AppColors.text,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppColors.green.withValues(alpha: 0.05),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.green.withValues(alpha: 0.1)),
                    ),
                    child: const Icon(LucideIcons.shieldCheck, size: 28, color: AppColors.green),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Last updated: October 2023',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textMid,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            _buildSection(
              title: '1. What Data We Collect',
              content:
                  'Buddy collects necessary information to provide personalized AI assistance. This may include your profile details, voice prompts, basic usage metrics, and authorized calendar information.',
            ),
            _buildSection(
              title: '2. How We Use Your Data',
              content:
                  'We use your data solely to improve your personal assistant experience. Voice inputs are processed accurately to serve intelligent responses. Calender data is used strictly for scheduling tasks and sending timely reminders.',
            ),
            _buildSection(
              title: '3. Data Security & Storage',
              content:
                  'Your personal information is stored securely on encrypted servers. If you enable biometrics (Face ID / Fingerprint), that data stays exclusively on your device and is never sent to our servers.',
            ),
            _buildSection(
              title: '4. Third-Party Integrations',
              content:
                  'Buddy may connect with third-party services like Google Calendar upon your explicit authorization. We do not sell your data to outside advertisers or third parties.',
            ),
            _buildSection(
              title: '5. Your Rights',
              content:
                  'You have full control over your data. You may delete your account, remove connected integrations, and modify privacy preferences at any time from the app settings.',
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                '© 2023 Buddy Assistant. All rights reserved.',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textDim,
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
      ),
        ],
      ),
    );
  }



  Widget _buildSection({required String title, required String content}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.text,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: AppColors.textMid,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
