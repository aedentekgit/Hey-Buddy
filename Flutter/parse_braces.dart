import 'package:analyzer/dart/analysis/utilities.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'dart:io';

void main() {
  final content = File('lib/features/voice_assistant/screens/buddy_assistant_page.dart').readAsStringSync();
  final result = parseString(content: content, throwIfDiagnostics: false);
  for (final error in result.errors) {
    print('Error at ${error.offset} (line ${result.lineInfo.getLocation(error.offset).lineNumber}): ${error.message}');
  }
}
