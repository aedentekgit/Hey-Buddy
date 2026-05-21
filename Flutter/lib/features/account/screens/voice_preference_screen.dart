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
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _playingVoiceId;

  // Fallback voices shown when the server hasn't configured any yet
  static const List<Map<String, dynamic>> _defaultVoices = [
    {'name': 'Puck (British Male)', 'voiceId': 'Puck', 'gender': 'male', 'isDefault': true},
    {'name': 'Charon (Deep Male)', 'voiceId': 'Charon', 'gender': 'male', 'isDefault': false},
    {'name': 'Fenrir (Strong Male)', 'voiceId': 'Fenrir', 'gender': 'male', 'isDefault': false},
    {'name': 'Aoede (Soft Female)', 'voiceId': 'Aoede', 'gender': 'female', 'isDefault': false},
    {'name': 'Kore (Bright Female)', 'voiceId': 'Kore', 'gender': 'female', 'isDefault': false},
  ];

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

    // Stop any currently playing audio before starting new preview
    await _audioPlayer.stop();
    if (mounted) setState(() => _playingVoiceId = voiceId);

    try {
      // Retrieve the JWT auth token — required by the backend 'protect' middleware
      final token = await _storage.read(key: 'jwt');
      final targetUrl = '${AppConfig.baseUrl}ai/tts';
      debugPrint('[VoicePreview] POST $targetUrl | voice=$voiceId, gender=$gender | token=${token != null ? "present" : "MISSING"}');

      final dio = Dio(BaseOptions(
        baseUrl: AppConfig.baseUrl,
        headers: {
          if (token != null) 'Authorization': 'Bearer $token',
          'x-platform': 'mobile',
          'Content-Type': 'application/json',
        },
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
      ));
      final response = await dio.post(
        'ai/tts',
        data: {
          'text': "Hello, I am your buddy AI assistant.",
          'voice_id': voiceId,
          'gender': gender,
        },
        options: Options(responseType: ResponseType.bytes),
      );

      debugPrint('[VoicePreview] Response: ${response.statusCode} | ${response.data.length} bytes');

      final bytes = response.data as Uint8List;
      final tempDir = await getTemporaryDirectory();

      // Use the correct file extension based on what the backend actually returned.
      // Backend sends X-Audio-Format: 'wav' (Gemini) or 'mp3' (Google/edge-tts).
      final xFormat = response.headers.value('x-audio-format');
      final contentType = response.headers.value('content-type') ?? '';
      final audioFormat = xFormat ?? (contentType.contains('wav') ? 'wav' : 'mp3');
      debugPrint('[VoicePreview] Audio format: $audioFormat | Content-Type: $contentType');
      
      final tempFile = File('${tempDir.path}/preview_$voiceId.$audioFormat');
      await tempFile.writeAsBytes(bytes);

      await _audioPlayer.play(DeviceFileSource(tempFile.path));

      _audioPlayer.onPlayerComplete.listen((_) {
        if (mounted) setState(() => _playingVoiceId = null);
      });
    } on DioException catch (e) {
      debugPrint('[VoicePreview] DioException: type=${e.type} | status=${e.response?.statusCode} | msg=${e.message}');
      if (e.response != null) {
        debugPrint('[VoicePreview] Response data: ${e.response?.data}');
      }
      if (mounted) {
        setState(() => _playingVoiceId = null);
        String errorMsg = "Failed to preview voice.";
        if (e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
          errorMsg = "Voice preview timed out. Please try again.";
        } else if (e.type == DioExceptionType.connectionError) {
          errorMsg = "Cannot reach the server. Check your connection.";
        } else if (e.response?.statusCode == 401) {
          errorMsg = "Session expired. Please log in again.";
        } else if (e.response?.statusCode == 500) {
          errorMsg = "Voice generation failed on server. Try another voice.";
        }
        ToastUtils.showErrorToast(errorMsg);
      }
    } catch (e) {
      debugPrint('[VoicePreview] Error previewing voice $voiceId: $e');
      if (mounted) {
        setState(() => _playingVoiceId = null);
        ToastUtils.showErrorToast("Failed to preview voice. Please check your connection.");
      }
    }
  }


  Future<void> _handleSelectVoice(String voiceId, String gender) async {
    setState(() => _processing = true);
    final userProvider = Provider.of<UserProvider>(context, listen: false);
    
    final success = await userProvider.updateVoicePreferences({
      'voiceId': voiceId,
      'gender': gender,
    });
    
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
                      'Buddy\'s Voice',
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
                // Use server voices; fall back to built-in defaults so the list
                // is never empty even when the backend hasn't configured voices yet.
                final serverVoices = brandingProvider.availableVoices;
                final availableVoices = serverVoices.isNotEmpty
                    ? serverVoices
                    : _defaultVoices;
                
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
                      onTap: _processing ? null : () => _handleSelectVoice(vId, gender),
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
