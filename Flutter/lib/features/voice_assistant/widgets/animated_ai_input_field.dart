// ignore_for_file: unused_field
import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:buddy_mobile/core/theme/app_colors.dart';

class AnimatedAIInputField extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback onMicPressed;
  final VoidCallback onAttachPressed;
  final VoidCallback onSendPressed;
  final bool isListening;
  final bool isSpeaking;
  final bool isVoiceSessionActive;
  final bool isEnabled;
  final bool isMuted;

  const AnimatedAIInputField({
    super.key,
    required this.controller,
    required this.onMicPressed,
    required this.onAttachPressed,
    required this.onSendPressed,
    this.isListening = false,
    this.isSpeaking = false,
    this.isVoiceSessionActive = false,
    this.isEnabled = true,
    this.isMuted = false,
  });

  @override
  State<AnimatedAIInputField> createState() => _AnimatedAIInputFieldState();
}

class _AnimatedAIInputFieldState extends State<AnimatedAIInputField>
    with TickerProviderStateMixin {
  late final AnimationController _rotationController;
  late final AnimationController _pulseController;
  late final AnimationController _hoverController;
  late final AnimationController _focusController;
  late final FocusNode _focusNode;

  bool _isHovered = false;
  bool _isFocused = false;
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);

    _hoverController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _focusController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );

    _focusNode = FocusNode();
    _focusNode.addListener(_onFocusChange);
    widget.controller.addListener(_onTextChanged);
  }

  @override
  void didUpdateWidget(covariant AnimatedAIInputField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isEnabled != oldWidget.isEnabled) {
      if (widget.isEnabled) {
        if (!_rotationController.isAnimating) _rotationController.repeat();
      } else {
        _rotationController.stop();
      }
    }
    if (widget.isListening != oldWidget.isListening) {
      if (widget.isListening) {
        _pulseController.duration = const Duration(milliseconds: 1000);
        _pulseController.repeat(reverse: true);
      } else {
        _pulseController.duration = const Duration(milliseconds: 2500);
        _pulseController.repeat(reverse: true);
      }
    }
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _pulseController.dispose();
    _hoverController.dispose();
    _focusController.dispose();
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    widget.controller.removeListener(_onTextChanged);
    super.dispose();
  }

  void _onFocusChange() {
    if (!mounted) return;
    setState(() {
      _isFocused = _focusNode.hasFocus;
    });

    if (_isFocused) {
      _focusController.forward();
      _rotationController.duration = const Duration(
        seconds: 8,
      ); // slow down when focused
      _rotationController.repeat();
    } else {
      _focusController.reverse();
      _rotationController.duration = const Duration(
        seconds: 4,
      ); // return to normal
      _rotationController.repeat();
    }
  }

  void _onTextChanged() {
    if (!mounted) return;
    final isCurrentlyTyping = widget.controller.text.isNotEmpty;
    if (_isTyping != isCurrentlyTyping) {
      setState(() {
        _isTyping = isCurrentlyTyping;
      });
      if (_isTyping) {
        // Minimal animation while active typing
        _pulseController.stop();
      } else {
        _pulseController.repeat(reverse: true);
      }
    }
  }

  void _onHover(bool isHovered) {
    if (!widget.isEnabled) return;
    setState(() => _isHovered = isHovered);
    if (isHovered) {
      _hoverController.forward();
    } else {
      _hoverController.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => _onHover(true),
      onExit: (_) => _onHover(false),
      child: AnimatedBuilder(
        animation: Listenable.merge([
          _rotationController,
          _pulseController,
          _hoverController,
          _focusController,
        ]),
        builder: (context, child) {
          // Calculate animated values
          final hoverVal = CurvedAnimation(
            parent: _hoverController,
            curve: Curves.easeOutBack,
          ).value;
          final focusVal = CurvedAnimation(
            parent: _focusController,
            curve: Curves.easeInOutCubic,
          ).value;
          final pulseVal = Curves.easeInOutSine.transform(
            _pulseController.value,
          );

          // State-based adjustments
          final double glowIntensity = widget.isEnabled
              ? (widget.isSpeaking
                    ? (1.0 + 0.4 * pulseVal)
                    : (_isTyping
                          ? 0.2
                          : (_isFocused
                                ? (0.8 + 0.3 * pulseVal)
                                : (0.4 + 0.4 * hoverVal))))
              : 0.0;

          final yOffset = widget.isEnabled
              ? (widget.isSpeaking ? -2.0 : -4.0 * hoverVal)
              : 0.0;
          final expansion = focusVal * 4.0 + (widget.isSpeaking ? 2.0 : 0.0);

          final List<Color> gradientColors = [
            const Color(
              0xFF3B82F6,
            ).withValues(alpha: widget.isEnabled ? 1 : 0.3), // Vibrant Blue
            const Color(
              0xFF8B5CF6,
            ).withValues(alpha: widget.isEnabled ? 1 : 0.3), // Vibrant Purple
            const Color(
              0xFFD946EF,
            ).withValues(alpha: widget.isEnabled ? 1 : 0.3), // Vibrant Pink
            const Color(
              0xFF6366F1,
            ).withValues(alpha: widget.isEnabled ? 1 : 0.3), // Indigo
            const Color(
              0xFF3B82F6,
            ).withValues(alpha: widget.isEnabled ? 1 : 0.3),
          ];

          return Opacity(
            opacity: widget.isEnabled ? 1.0 : 0.6,
            child: Transform.translate(
              offset: Offset(0, yOffset),
              child: Container(
                margin: EdgeInsets.symmetric(vertical: 4 + expansion),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(100),
                  boxShadow: widget.isEnabled
                      ? [
                          BoxShadow(
                            color: const Color(0xFF6366F1).withValues(
                              alpha:
                                  0.08 + (0.12 * hoverVal) + (0.05 * pulseVal),
                            ),
                            blurRadius: 20 + (10 * hoverVal) + (5 * pulseVal),
                            offset: const Offset(0, 8),
                            spreadRadius: 2 * hoverVal,
                          ),
                        ]
                      : [],
                ),
                child: CustomPaint(
                  painter: _GradientRingPainter(
                    progress: _rotationController.value,
                    borderWidth: 1.5 + (0.5 * focusVal),
                    glowIntensity: glowIntensity,
                    isPulsing: _isFocused,
                    pulseValue: pulseVal,
                    colors: gradientColors,
                    isEnabled: widget.isEnabled,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(100),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 0,
                        ),
                        decoration: BoxDecoration(
                          color: _isFocused
                              ? AppColors.surface.withValues(alpha: 0.95)
                              : AppColors.surface.withValues(
                                  alpha: 0.85 + (0.05 * hoverVal),
                                ),
                          borderRadius: BorderRadius.circular(100),
                        ),
                        child: Row(
                          children: [
                            const SizedBox(width: 12),
                            Expanded(
                              child: (widget.isListening || widget.isSpeaking)
                                  ? _buildWaveform()
                                  : TextField(
                                      controller: widget.controller,
                                      focusNode: _focusNode,
                                      enabled: widget.isEnabled,
                                      cursorColor: const Color(0xFF6366F1),
                                      cursorWidth: 2,
                                      cursorRadius: const Radius.circular(2),
                                      style: GoogleFonts.inter(
                                        fontSize: 15,
                                        color: AppColors.text,
                                        fontWeight: FontWeight.w500,
                                      ),
                                      decoration: InputDecoration(
                                        hintText: widget.isVoiceSessionActive
                                            ? (widget.isListening
                                                  ? "Listening..."
                                                  : "Voice mode on — speak now")
                                            : (_isFocused
                                                  ? "I'm listening..."
                                                  : "Feel free to ask me any questions..."),
                                        border: InputBorder.none,
                                        enabledBorder: InputBorder.none,
                                        focusedBorder: InputBorder.none,
                                        isDense: true,
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                              vertical: 8,
                                            ),

                                        hintStyle: GoogleFonts.inter(
                                          color: AppColors.textDim,
                                          fontSize: 14,
                                        ),
                                      ),
                                      onSubmitted: (_) =>
                                          widget.onSendPressed(),
                                    ),
                            ),

                            // Mic Button
                            _buildActionIconButton(
                              icon: widget.isMuted
                                  ? LucideIcons.micOff
                                  : widget.isVoiceSessionActive
                                  ? LucideIcons.stopCircle
                                  : LucideIcons.mic,
                              color: widget.isMuted
                                  ? const Color(0xFFEF4444)
                                  : widget.isVoiceSessionActive
                                  ? const Color(0xFFEF4444)
                                  : AppColors.textMid,
                              onTap: widget.isEnabled
                                  ? widget.onMicPressed
                                  : null,
                              isPulsing: widget.isVoiceSessionActive,
                              pulseVal: pulseVal,
                            ),

                            const SizedBox(width: 4),

                            // Attach Button
                            _buildActionIconButton(
                              icon: LucideIcons.plus,
                              color: AppColors.textMid,
                              onTap: widget.isEnabled
                                  ? widget.onAttachPressed
                                  : null,
                            ),

                            const SizedBox(width: 4),

                            // Send Button (only visible when typing)
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 200),
                              transitionBuilder:
                                  (Widget child, Animation<double> animation) {
                                    return ScaleTransition(
                                      scale: animation,
                                      child: FadeTransition(
                                        opacity: animation,
                                        child: child,
                                      ),
                                    );
                                  },
                              child: _isTyping
                                  ? InkWell(
                                      key: const ValueKey('send_btn'),
                                      onTap: widget.isEnabled
                                          ? widget.onSendPressed
                                          : null,
                                      borderRadius: BorderRadius.circular(100),
                                      child: Container(
                                        padding: const EdgeInsets.all(8),
                                        margin: const EdgeInsets.only(
                                          left: 4,
                                          right: 4,
                                        ),
                                        decoration: BoxDecoration(
                                          gradient: const LinearGradient(
                                            colors: [
                                              Color(0xFF6366F1),
                                              Color(0xFF8B5CF6),
                                            ],
                                            begin: Alignment.topLeft,
                                            end: Alignment.bottomRight,
                                          ),
                                          shape: BoxShape.circle,
                                          boxShadow: [
                                            BoxShadow(
                                              color: const Color(
                                                0xFF6366F1,
                                              ).withValues(alpha: 0.3),
                                              blurRadius: 8,
                                              offset: const Offset(0, 2),
                                            ),
                                          ],
                                        ),
                                        child: const Icon(
                                          LucideIcons.send,
                                          color: Colors.white,
                                          size: 16,
                                        ),
                                      ),
                                    )
                                  : const SizedBox(key: ValueKey('empty_send')),
                            ),
                            const SizedBox(width: 4),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildWaveform() {
    return SizedBox(
      height: 32,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(24, (index) {
          // Dynamic heights to create a mountain shape
          double multiplier = 1.0;
          if (index < 6) multiplier = (index + 1) / 6.0;
          if (index > 18) multiplier = (24 - index) / 6.0;

          return WaveformBar(
            index: index,
            multiplier: multiplier,
            isActive: true,
          );
        }),
      ),
    );
  }

  Widget _buildActionIconButton({
    required IconData icon,
    required Color color,
    VoidCallback? onTap,
    bool isPulsing = false,
    double pulseVal = 0.0,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(100),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isPulsing
              ? Colors.red.withValues(alpha: 0.1 + (0.1 * pulseVal))
              : Colors.transparent,
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: (isPulsing || widget.isSpeaking) ? AppColors.textMid : color,
          size: 20 + (isPulsing ? (2 * pulseVal) : 0),
        ),
      ),
    );
  }
}

class WaveformBar extends StatefulWidget {
  final int index;
  final double multiplier;
  final bool isActive;

  const WaveformBar({
    super.key,
    required this.index,
    required this.multiplier,
    required this.isActive,
  });

  @override
  State<WaveformBar> createState() => _WaveformBarState();
}

class _WaveformBarState extends State<WaveformBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 400 + (widget.index % 5) * 100),
    );

    _animation = Tween<double>(begin: 4, end: 24 * widget.multiplier).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOutSine),
    );

    if (widget.isActive) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(WaveformBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive != oldWidget.isActive) {
      if (widget.isActive) {
        _controller.repeat(reverse: true);
      } else {
        _controller.stop();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Gradient coloring blue -> purple -> pink
    Color barColor;
    if (widget.index < 8) {
      barColor = Color.lerp(
        const Color(0xFF3B82F6),
        const Color(0xFF8B5CF6),
        widget.index / 8,
      )!;
    } else if (widget.index < 16) {
      barColor = Color.lerp(
        const Color(0xFF8B5CF6),
        const Color(0xFFD946EF),
        (widget.index - 8) / 8,
      )!;
    } else {
      barColor = Color.lerp(
        const Color(0xFFD946EF),
        const Color(0xFFD946EF),
        (widget.index - 16) / 8,
      )!;
    }

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 1.5),
          width: 3,
          height: _animation.value,
          decoration: BoxDecoration(
            color: barColor,
            borderRadius: BorderRadius.circular(2),
          ),
        );
      },
    );
  }
}

class _GradientRingPainter extends CustomPainter {
  final double progress;
  final double borderWidth;
  final double glowIntensity;
  final bool isPulsing;
  final double pulseValue;
  final List<Color> colors;
  final bool isEnabled;

  _GradientRingPainter({
    required this.progress,
    required this.borderWidth,
    required this.glowIntensity,
    required this.isPulsing,
    required this.pulseValue,
    required this.colors,
    required this.isEnabled,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (!isEnabled) {
      final borderRect = Offset.zero & size;
      final borderRRect = RRect.fromRectAndRadius(
        borderRect,
        Radius.circular(size.height / 2),
      );
      final paint = Paint()
        ..color = AppColors.border
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth;
      canvas.drawRRect(borderRRect, paint);
      return;
    }

    final rect = Offset.zero & size;
    final rrect = RRect.fromRectAndRadius(
      rect,
      Radius.circular(size.height / 2),
    );

    // Gradient transform for orbiting effect
    final gradient = SweepGradient(
      colors: colors,
      stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
      transform: GradientRotation(progress * 2 * math.pi),
    );

    // Outer glow for premium effect
    if (glowIntensity > 0) {
      final blurPaint = Paint()
        ..shader = gradient.createShader(rect)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 12 * glowIntensity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth * 2;
      canvas.drawRRect(rrect, blurPaint);
    }

    // Actual border
    final paint = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;

    // Optional bright inner pulse when focused
    if (isPulsing && pulseValue > 0) {
      final pulsePaint = Paint()
        ..shader = gradient.createShader(rect)
        ..maskFilter = MaskFilter.blur(BlurStyle.solid, 4 * pulseValue)
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth + (pulseValue * 1.0);
      canvas.drawRRect(rrect, pulsePaint);
    }

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(covariant _GradientRingPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.glowIntensity != glowIntensity ||
        oldDelegate.isPulsing != isPulsing ||
        oldDelegate.pulseValue != pulseValue ||
        oldDelegate.borderWidth != borderWidth ||
        oldDelegate.isEnabled != isEnabled;
  }
}
