import 'dart:io';

void main() {
  var content = File('lib/features/voice_assistant/screens/buddy_assistant_page.dart').readAsStringSync();
  int braceCount = 0;
  bool inString = false;
  
  for (int i = 0; i < content.length; i++) {
    var char = content[i];
    
    // Simplistic string skipping
    if (char == "'" || char == '"') {
      inString = !inString;
      continue;
    }
    
    if (inString) continue;
    
    if (char == '{') braceCount++;
    if (char == '}') braceCount--;
    
    if (braceCount == 0 && char == '}') {
      int line = content.substring(0, i).split('\n').length;
      print('Block closed at line: $line');
    }
  }
}
