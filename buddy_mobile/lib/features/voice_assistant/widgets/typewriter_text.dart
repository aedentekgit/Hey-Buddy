import 'package:flutter/material.dart';

class TypewriterText extends StatefulWidget {
  final String text;
  final TextStyle? style;
  final Duration duration;
  final Curve curve;
  final TextAlign textAlign;
  final bool enabled;

  const TypewriterText(
    this.text, {
    super.key,
    this.style,
    this.duration = const Duration(milliseconds: 45),
    this.curve = Curves.linear,
    this.textAlign = TextAlign.start,
    this.enabled = true,
  });


  @override
  State<TypewriterText> createState() => _TypewriterTextState();
}

class _TypewriterTextState extends State<TypewriterText> with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  late Animation<int> _characterCount;

  @override
  void initState() {
    super.initState();
    _initAnimation();
  }

  @override
  void didUpdateWidget(TypewriterText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.text != oldWidget.text) {
      if (widget.text.startsWith(oldWidget.text)) {
        // Incremental update - append new characters to the end
        _continueAnimation();
      } else {
        // Complete reset - likely a new message
        _initAnimation();
      }
    }
  }

  void _initAnimation() {
    _startAnimation(0);
  }

  void _continueAnimation() {
    _startAnimation(_characterCount.value);
  }

  void _startAnimation(int startAt) {
    final int characters = widget.text.length;

    if (!widget.enabled) {
      _characterCount = AlwaysStoppedAnimation(characters);
      return;
    }

    final int charactersToType = characters - startAt;
    
    // If no new characters to type, just stay at current state
    if (charactersToType <= 0) return;


    final Duration durationForRemaining = Duration(
      milliseconds: widget.duration.inMilliseconds * charactersToType,
    );

    _controller?.dispose();
    _controller = AnimationController(
      vsync: this,
      duration: durationForRemaining,
    );

    _characterCount = StepTween(begin: startAt, end: characters).animate(
      CurvedAnimation(parent: _controller!, curve: widget.curve),
    );

    _controller!.forward();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _characterCount,
      builder: (context, child) {
        String visibleText = widget.text.substring(0, _characterCount.value);
        return Text(
          visibleText,
          style: widget.style,
          textAlign: widget.textAlign,
        );
      },
    );
  }
}
