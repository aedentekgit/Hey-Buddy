import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('Branding provider hydrates saved app name', () async {
    SharedPreferences.setMockInitialValues({
      'branding_app_name': 'Buddy Test',
    });
    final prefs = await SharedPreferences.getInstance();
    final branding = BrandingProvider(prefs);

    expect(branding.appName, 'Buddy Test');
  });
}
