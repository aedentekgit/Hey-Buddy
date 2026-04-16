import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';

void main() {
  testWidgets('BrandingProvider hydrates app name into widget tree', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      'branding_app_name': 'Buddy QA',
      'branding_primary_color': '#2563EB',
      'branding_is_dark_mode': false,
    });
    final prefs = await SharedPreferences.getInstance();
    final branding = BrandingProvider(prefs);

    await tester.pumpWidget(
      ChangeNotifierProvider<BrandingProvider>.value(
        value: branding,
        child: Consumer<BrandingProvider>(
          builder: (context, b, _) {
            return MaterialApp(
              title: b.appName,
              theme: b.themeData,
              home: Scaffold(body: Text(b.appName)),
            );
          },
        ),
      ),
    );

    expect(find.text('Buddy QA'), findsOneWidget);
  });
}
