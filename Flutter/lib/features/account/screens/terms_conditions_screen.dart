import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

class TermsConditionsScreen extends StatelessWidget {
  const TermsConditionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, color: Color(0xFF1E293B)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Terms of Service',
          style: GoogleFonts.outfit(
            fontSize: 20,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF1E293B),
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
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
                      color: AppColors.accent.withValues(alpha: 0.05),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.accent.withValues(alpha: 0.1)),
                    ),
                    child: const Icon(LucideIcons.fileText, size: 28, color: AppColors.accent),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Last updated: October 2023',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            _buildSection(
              title: '1. Introduction',
              content:
                  'Welcome to Buddy, your personal AI assistant. By using our app, you agree to these terms. Please read them carefully.',
            ),
            _buildSection(
              title: '2. Usage Rights',
              content:
                  'Buddy is designed to assist you with daily tasks, scheduling, and notifications. You agree to use the app in a lawful manner and not for any malicious purposes.',
            ),
            _buildSection(
              title: '3. Data & Privacy',
              content:
                  'Your privacy is important to us. Buddy requires certain permissions (like Calendar access or Biometrics) to function optimally. All personal data is processed securely.',
            ),
            _buildSection(
              title: '4. Service Availability',
              content:
                  'We strive to maintain a 99.9% uptime, but Buddy services may occasionally be interrupted for maintenance or updates without prior notice.',
            ),
            _buildSection(
              title: '5. Limitation of Liability',
              content:
                  'Buddy acts as a supplemental tool and should not be solely relied upon for critical operations. We are not liable for any missed events or data inaccuracies.',
            ),
            const SizedBox(height: 16),
            Center(
              child: Text(
                '© 2023 Buddy Assistant. All rights reserved.',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF94A3B8),
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSection({required String title, required String content}) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.outfit(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w400,
              color: const Color(0xFF64748B),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
