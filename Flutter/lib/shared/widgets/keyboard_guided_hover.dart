import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:ui';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';

class KeyboardGuidedHover extends StatefulWidget {
  final Widget child;
  const KeyboardGuidedHover({super.key, required this.child});

  @override
  State<KeyboardGuidedHover> createState() => _KeyboardGuidedHoverState();
}

class _KeyboardGuidedHoverState extends State<KeyboardGuidedHover>
    with SingleTickerProviderStateMixin {
  final _storage = const FlutterSecureStorage();
  bool _isFirstTime = false;
  bool _hasInitialCheckDone = false;
  late AnimationController _breathingController;
  late Animation<double> _breathingAnimation;

  @override
  void initState() {
    super.initState();
    _checkFirstTime();
    _breathingController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _breathingAnimation = Tween<double>(begin: 1.0, end: 1.05).animate(
      CurvedAnimation(parent: _breathingController, curve: Curves.easeInOut),
    );
  }

  Future<void> _checkFirstTime() async {
    final val = await _storage.read(key: 'keyboard_hover_shown');
    if (val == null) {
      if (mounted) {
        setState(() {
          _isFirstTime = true;
          _hasInitialCheckDone = true;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _isFirstTime = false;
          _hasInitialCheckDone = true;
        });
      }
    }
  }

  Future<void> _completeFirstTime() async {
    await _storage.write(key: 'keyboard_hover_shown', value: 'true');
    if (mounted) {
      setState(() {
        _isFirstTime = false;
      });
    }
  }

  @override
  void dispose() {
    _breathingController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_hasInitialCheckDone || !_isFirstTime) return widget.child;

    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;
    final isKeyboardOpen = keyboardHeight > 0;

    // Auto-complete as soon as it starts showing to fulfill "first launch only" rule
    if (isKeyboardOpen && _isFirstTime) {
      _completeFirstTime();
    }

    final primaryColor = Theme.of(context).primaryColor;

    return Stack(
      children: [
        widget.child,
        AnimatedPositioned(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutCubic,
          bottom: isKeyboardOpen ? keyboardHeight + 16 : -120,
          left: 20,
          right: 20,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 300),
            opacity: isKeyboardOpen ? 1.0 : 0.0,
            child: ScaleTransition(
              scale: _breathingAnimation,
              child: _buildHoverCard(primaryColor),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHoverCard(Color primaryColor) {
    return GestureDetector(
      onTap: () {
        // Optional: Do nothing or close
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.75),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: Colors.white.withOpacity(0.4),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 30,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: primaryColor.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.auto_awesome_rounded,
                    color: primaryColor,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "${Provider.of<BrandingProvider>(context, listen: false).appName} Dialogue",
                        style: GoogleFonts.outfit(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        "Start typing to chat with your assistant.",
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  onPressed: _completeFirstTime,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    "Got it",
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: primaryColor,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
