import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/providers/branding_provider.dart';
import 'features/auth/providers/auth_provider.dart';
import 'features/auth/screens/splash_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BrandingProvider()..fetchBranding()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const BuddyApp(),
    ),
  );
}

class BuddyApp extends StatelessWidget {
  const BuddyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<BrandingProvider>(
      builder: (context, branding, _) {
        return MaterialApp(
          title: branding.appName,
          debugShowCheckedModeBanner: false,
          theme: branding.themeData,
          home: const SplashScreen(),
        );
      },
    );
  }
}
