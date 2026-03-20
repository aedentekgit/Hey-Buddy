import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:buddy_mobile/core/providers/branding_provider.dart';
import 'package:buddy_mobile/features/auth/providers/auth_provider.dart';
import 'package:buddy_mobile/features/home/providers/memories_provider.dart';
import 'package:buddy_mobile/features/home/providers/tasks_provider.dart';
import 'package:buddy_mobile/features/home/providers/location_reminders_provider.dart';
import 'package:buddy_mobile/features/account/providers/user_provider.dart';
import 'package:buddy_mobile/features/voice_assistant/providers/buddy_provider.dart';
import 'package:buddy_mobile/features/explore/providers/family_provider.dart';
import 'package:buddy_mobile/features/auth/screens/splash_screen.dart';
import 'package:buddy_mobile/core/providers/security_provider.dart';


import 'package:shared_preferences/shared_preferences.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:buddy_mobile/core/services/notification_service.dart';

final GlobalKey<NavigatorState> globalNavigatorKey =
    GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase in the background
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // iOS: Show banners when app is in foreground
    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );

    final notificationService = NotificationService();
    await notificationService.initialize();
    debugPrint('[Main] ✅ Firebase & Notifications initialized');
  } catch (e) {
    debugPrint("[Main] ⚠️ Firebase/Notification initialization failed: $e");
  }

  // Pre-load SharedPreferences to eliminate hydration lag
  final prefs = await SharedPreferences.getInstance();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => BrandingProvider(prefs)..fetchBranding(),
        ),
        ChangeNotifierProvider(create: (_) => AuthProvider()..tryAutoLogin()),
        ChangeNotifierProvider(create: (_) => MemoriesProvider()),
        ChangeNotifierProvider(create: (_) => TasksProvider()),
        ChangeNotifierProvider(create: (_) => LocationRemindersProvider()),
        ChangeNotifierProvider(create: (_) => UserProvider()),
        ChangeNotifierProvider(create: (_) => BuddyProvider()),
        ChangeNotifierProvider(create: (_) => SecurityProvider()),
        ChangeNotifierProxyProvider<BuddyProvider, FamilyProvider>(
          create: (context) =>
              FamilyProvider(context.read<BuddyProvider>().socketService),
          update: (context, buddy, family) =>
              family ?? FamilyProvider(buddy.socketService),
        ),
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
          navigatorKey: globalNavigatorKey,
          title: branding.appName,
          debugShowCheckedModeBanner: false,
          theme: branding.themeData,
          home: const SplashScreen(),
          builder: (context, child) {
            return child!;
          },
        );
      },
    );
  }
}
