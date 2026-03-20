#!/bin/bash
# Using perl since it's robust for multi-line replacements
perl -0777 -pi -e 's/import '"'"'package:flutter_tts\/flutter_tts.dart'"'"';\n//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart
perl -0777 -pi -e 's/final FlutterTts _flutterTts = FlutterTts\(\);\n//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart
perl -0777 -pi -e 's/\s+FlutterTts get tts => _flutterTts;\n//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart

perl -0777 -pi -e 's/String _ttsBuffer = '"'"''"'"';\n  final List<String> _ttsQueue = \[\];\n  bool _isSpeakingQueue = false;/final List<String> _audioQueue = [];\n  bool _isSpeakingQueue = false;/g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart

perl -0777 -pi -e 's/_flutterTts\.stop\(\);//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart
perl -0777 -pi -e 's/_flutterTts\.speak\([^)]*\);//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart
perl -0777 -pi -e 's/await _flutterTts\.set[A-Za-z]+\([^)]*\);//g' Flutter/lib/features/voice_assistant/providers/buddy_provider.dart

