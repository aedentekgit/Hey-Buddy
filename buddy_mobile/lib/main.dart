import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/auth/screens/splash_screen.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:buddy_mobile/core/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase in the background without blocking the splash screen
  unawaited(Firebase.initializeApp().then((_) async {
    print("Firebase initialized successfully");
    
    // Register background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final notificationService = NotificationService();
    await notificationService.initialize();
  }).catchError((e) {
    print("Firebase/Notification background initialization failed: $e");
  }));
  
  // Pre-load SharedPreferences to eliminate hydration lag
  final prefs = await SharedPreferences.getInstance();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => BrandingProvider(prefs)..fetchBranding()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MemoriesProvider()),
        ChangeNotifierProvider(create: (_) => TasksProvider()),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => BuddyProvider()),
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
