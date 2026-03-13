import 'package:flutter/material.dart';
import 'dart:math' as math;

class BuddyOrb extends StatefulWidget {
  final Color baseColor;
  final bool isTalking;
  final bool isThinking;

  const BuddyOrb({
    super.key,
    required this.baseColor,
    this.isTalking = false,
    this.isThinking = false,
  });

  @override
  State<BuddyOrb> createState() => _BuddyOrbState();
}

class _BuddyOrbState extends State<BuddyOrb> with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late AnimationController _rotationController;
  late AnimationController _waveController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat(reverse: true);

    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 20),
    )..repeat();

    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _rotationController.dispose();
    _waveController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    double baseSize = widget.isTalking ? 240 : 200;

    return AnimatedBuilder(
      animation: Listenable.merge([
        _pulseController,
        _rotationController,
        _waveController,
      ]),
      builder: (context, child) {
        return Stack(
          alignment: Alignment.center,
          children: [
            // Layer 1: The Outer Glow (Breathing)
            Container(
              width: baseSize * (1.0 + (_pulseController.value * 0.1)),
              height: baseSize * (1.0 + (_pulseController.value * 0.1)),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    widget.baseColor.withValues(
                      alpha: 0.15 * (1.0 + _pulseController.value),
                    ),
                    widget.baseColor.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),

            // Layer 2: The Core Glow
            Container(
              width: baseSize * 0.7,
              height: baseSize * 0.7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    widget.baseColor.withValues(
                      alpha: 0.3 * (1.1 - _pulseController.value),
                    ),
                    widget.baseColor.withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),

            // Layer 3: The Interactive Pulse Rings
            CustomPaint(
              size: Size(baseSize, baseSize),
              painter: OrbPainter(
                color: widget.baseColor,
                pulse: _pulseController.value,
                rotation: _rotationController.value,
                isTalking: widget.isTalking,
                isThinking: widget.isThinking,
                wave: _waveController.value,
              ),
            ),
          ],
        );
      },
    );
  }
}

class OrbPainter extends CustomPainter {
  final Color color;
  final double pulse;
  final double rotation;
  final double wave;
  final bool isTalking;
  final bool isThinking;

  OrbPainter({
    required this.color,
    required this.pulse,
    required this.rotation,
    required this.wave,
    required this.isTalking,
    required this.isThinking,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2.5;

    // 1. Draw swirling arcs
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeCap = StrokeCap.round;

    int arcCount = 12;
    for (int i = 0; i < arcCount; i++) {
      double angle =
          (i * (360 / arcCount) * math.pi / 180) + (rotation * 2 * math.pi);
      double opacity = 0.1 + (0.4 * math.sin(angle + (pulse * 5)));

      paint.color = color.withValues(alpha: opacity.clamp(0.0, 1.0));

      double sweepAngle =
          math.pi / 2 + (isTalking ? math.sin(wave * 2 * math.pi) * 0.5 : 0);

      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius * (0.9 + (i * 0.01))),
        angle,
        sweepAngle,
        false,
        paint,
      );
    }

    // 2. Draw "Data Bits" / Floating Particles
    final particlePaint = Paint()..style = PaintingStyle.fill;
    final random = math.Random(42);
    for (int i = 0; i < 20; i++) {
      double pAngle =
          random.nextDouble() * 2 * math.pi +
          (rotation * (random.nextBool() ? 1 : -1));
      double pDistance = radius * (0.8 + random.nextDouble() * 0.4);
      double pSize = 1.0 + random.nextDouble() * 2.0;

      double pX = center.dx + math.cos(pAngle) * pDistance;
      double pY = center.dy + math.sin(pAngle) * pDistance;

      particlePaint.color = color.withValues(
        alpha: 0.2 + (0.3 * math.sin(wave * 2 * math.pi + i)),
      );
      canvas.drawCircle(Offset(pX, pY), pSize, particlePaint);
    }

    // 3. Central Energy Core
    final corePaint = Paint()
      ..shader = RadialGradient(
        colors: [
          Colors.white.withValues(alpha: 0.8),
          color.withValues(alpha: 0.4),
          color.withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius * 0.4));

    canvas.drawCircle(
      center,
      radius * (0.3 + (isTalking ? 0.05 * math.sin(wave * 4 * math.pi) : 0)),
      corePaint,
    );
  }

  @override
  bool shouldRepaint(OrbPainter oldDelegate) => true;
}
