// ignore_for_file: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:dio/dio.dart';
import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/shared/utils/toast_utils.dart';

class VoicePreferenceScreen extends StatefulWidget {
  const VoicePreferenceScreen({super.key});

  @override
  State<VoicePreferenceScreen> createState() => _VoicePreferenceScreenState();
}

class _VoicePreferenceScreenState extends State<VoicePreferenceScreen> {
  bool _processing = false;
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _playingVoiceId;

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _handlePlayPreview(String voiceId, String gender) async {
    if (_playingVoiceId == voiceId) {
      await _audioPlayer.stop();
      if (mounted) setState(() => _playingVoiceId = null);
      return;
    }

    if (mounted) setState(() => _playingVoiceId = voiceId);

    try {
      final dio = Dio(BaseOptions(baseUrl: AppConfig.baseUrl));
      final response = await dio.post(
        'ai/tts',
        data: {
          'text': "Hello, I am your buddy AI assistant.",
          'voice_id': voiceId,
          'gender': gender,
        },
        options: Options(responseType: ResponseType.bytes),
      );

      final bytes = response.data as Uint8List;
      final tempDir = await getTemporaryDirectory();
      final tempFile = File('${tempDir.path}/preview.mp3');
      await tempFile.writeAsBytes(bytes);

      await _audioPlayer.play(DeviceFileSource(tempFile.path));

      _audioPlayer.onPlayerComplete.listen((_) {
        if (mounted) setState(() => _playingVoiceId = null);
      });
    } catch (e) {
      if (mounted) {
        setState(() => _playingVoiceId = null);
        ToastUtils.showErrorToast("Failed to preview voice.");
      }
    }
  }

  Future<void> _handleSelectVoice(String voiceId) async {
    setState(() => _processing = true);
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    
    final success = await userProvider.updateVoicePreferences({'voiceId': voiceId});
    
    if (mounted) {
      setState(() => _processing = false);
      if (success) {
        ToastUtils.showSuccessToast('Voice updated successfully');
      } else {
        ToastUtils.showErrorToast('Failed to update voice');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        title: Text(
          'Buddy\'s Voice',
          style: GoogleFonts.nunito(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: AppColors.text,
          ),
        ),
        backgroundColor: AppColors.bg,
        elevation: 0,
        centerTitle: true,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.border),
            ),
            child: const Icon(Icons.arrow_back_rounded, color: AppColors.text, size: 20),
          ),
        ),
      ),
      body: Column(
        children: [
          // Intro Card
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF818CF8), Color(0xFF6366F1)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.accent.withOpacity(0.2),
                    blurRadius: 15,
                    offset: const Offset(0, 6),
                  )
                ],
              ),
              child: Row(
                children: [
                   const Icon(LucideIcons.mic2, color: Colors.white, size: 28),
                   const SizedBox(width: 14),
                   Expanded(
                     child: Column(
                       crossAxisAlignment: CrossAxisAlignment.start,
                       children: [
                         Text(
                           "Personalize Buddy",
                           style: GoogleFonts.nunito(
                             fontSize: 16,
                             fontWeight: FontWeight.w800,
                             color: Colors.white,
                           ),
                         ),
                         const SizedBox(height: 2),
                         Text(
                           "Choose exactly how you want your AI assistant to sound.",
                           style: GoogleFonts.inter(
                             fontSize: 12,
                             color: Colors.white.withOpacity(0.9),
                             height: 1.3,
                           ),
                         ),
                       ],
                     ),
                   ),
                ],
              ),
            ),
          ),

          // Voices List
          Expanded(
            child: Consumer2<BrandingProvider, UserProvider>(
              builder: (context, brandingProvider, userProvider, _) {
                final availableVoices = brandingProvider.availableVoices;
                
                if (availableVoices.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.settings, size: 40, color: AppColors.textDim),
                        const SizedBox(height: 16),
                        Text(
                          'No voices configured.',
                          style: GoogleFonts.nunito(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textMid,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                // Initial current voice
                final userPrefs = userProvider.user['voicePreferences'] ?? {};
                String currentVoiceId = userPrefs['voiceId'] ?? '';
                if (currentVoiceId.isEmpty) {
                   final defaultVoice = availableVoices.firstWhere(
                     (v) => v['isDefault'] == true,
                     orElse: () => availableVoices.first
                   );
                   currentVoiceId = defaultVoice['voiceId'] ?? '';
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  physics: const BouncingScrollPhysics(),
                  itemCount: availableVoices.length,
                  itemBuilder: (context, index) {
                    final voice = availableVoices[index];
                    final String name = voice['name'] ?? 'Unknown Voice';
                    final String vId = voice['voiceId'] ?? '';
                    final String gender = (voice['gender'] ?? 'male').toString().toLowerCase();
                    final bool isSelected = vId == currentVoiceId;
                    final bool isPlaying = vId == _playingVoiceId;

                    return GestureDetector(
                      onTap: _processing ? null : () => _handleSelectVoice(vId),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? AppColors.surface : AppColors.surface.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected ? AppColors.accent : AppColors.cardBorder,
                            width: isSelected ? 2 : 1,
                          ),
                          boxShadow: isSelected 
                            ? [
                                BoxShadow(
                                  color: AppColors.accent.withOpacity(0.12),
                                  blurRadius: 10,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            : [],
                        ),
                        child: Row(
                          children: [
                            // Play Avatar
                            GestureDetector(
                               onTap: () => _handlePlayPreview(vId, gender),
                               child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  gradient: isPlaying 
                                    ? const LinearGradient(
                                        colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                                      )
                                    : LinearGradient(
                                        colors: gender == 'female' 
                                            ? const [Color(0xFFF472B6), Color(0xFFE11D48)] 
                                            : const [Color(0xFF60A5FA), Color(0xFF2563EB)],
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                      ),
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: isPlaying 
                                        ? const Color(0xFFF59E0B).withOpacity(0.3) 
                                        : (gender == 'female' ? const Color(0xFFE11D48) : const Color(0xFF2563EB)).withOpacity(0.25),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    )
                                  ]
                                ),
                                child: _processing && isSelected 
                                    ? const Center(
                                        child: SizedBox(
                                          width: 18, 
                                          height: 18, 
                                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                                        )
                                      )
                                    : Icon(
                                        isPlaying ? Icons.stop_rounded : Icons.play_arrow_rounded,
                                        color: Colors.white,
                                        size: isPlaying ? 24 : 26,
                                      ),
                              ),
                            ),
                            const SizedBox(width: 14),

                            // Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: GoogleFonts.nunito(
                                      fontSize: 15.5,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.text,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: gender == 'female' 
                                            ? AppColors.pinkLight 
                                            : AppColors.accentLight,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          gender.toUpperCase(),
                                          style: GoogleFonts.inter(
                                            fontSize: 9.5,
                                            fontWeight: FontWeight.w700,
                                            color: gender == 'female' 
                                                ? AppColors.pink 
                                                : AppColors.accent,
                                            letterSpacing: 0.5,
                                          ),
                                        ),
                                      ),
                                      if (voice['isDefault'] == true) ...[
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                          decoration: BoxDecoration(
                                            color: AppColors.border,
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: Text(
                                            'DEFAULT',
                                            style: GoogleFonts.inter(
                                              fontSize: 9.5,
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textMid,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                        ),
                                      ]
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            
                            // Radio indicator
                            Container(
                              margin: const EdgeInsets.only(left: 10),
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: isSelected ? AppColors.accent : AppColors.textDim.withOpacity(0.3),
                                  width: isSelected ? 6 : 1.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
