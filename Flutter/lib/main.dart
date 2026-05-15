import 'package:flutter/material.dart'; // hr 11
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
import 'package:buddy_mobile/core/services/socket_service.dart';


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
    // Gracefully handle APNS errors on iOS Simulator
    if (e.toString().contains('apns-token-not-set')) {
      debugPrint("[Main] ℹ️ APNS not available on iOS Simulator (normal)");
    } else {
      debugPrint("[Main] ⚠️ Firebase/Notification initialization failed: $e");
    }
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
        // Proxy provider logic to connect Socket events to Providers
        ProxyProvider<BuddyProvider, RealtimeSyncManager>(
          update: (context, buddy, _) =>
              RealtimeSyncManager(context, buddy.socketService),
          lazy: false,
        ),
      ],
      child: const BuddyApp(),
    ),
  );
}

class RealtimeSyncManager {
  final SocketService socketService;
  final TasksProvider tasksProvider;
  final LocationRemindersProvider locationRemindersProvider;
  final MemoriesProvider memoriesProvider;
  final UserProvider userProvider;
  final FamilyProvider familyProvider;

  RealtimeSyncManager(BuildContext context, this.socketService)
    : tasksProvider = context.read<TasksProvider>(),
      locationRemindersProvider = context.read<LocationRemindersProvider>(),
      memoriesProvider = context.read<MemoriesProvider>(),
      userProvider = context.read<UserProvider>(),
      familyProvider = context.read<FamilyProvider>() {
    _init();
  }

  void _init() {
    socketService.dataSyncStream.listen((data) {
      final type = data['type'];
      debugPrint('RealtimeSyncManager: Received sync for $type');

      // Use try-catch to safely access providers even if context is no longer mounted
      try {
        if (type == 'task' || type == 'reminder') {
          tasksProvider.loadTasks(silent: true);
        } else if (type == 'location_reminder') {
          locationRemindersProvider.loadReminders();
        } else if (type == 'memory') {
          memoriesProvider.loadMemories(silent: true);
        } else if (type == 'profile') {
          userProvider.loadProfile();
        } else if (type == 'family') {
          familyProvider.loadData();
        }
      } catch (e) {
        debugPrint('RealtimeSyncManager: Error accessing context - $e');
      }
    });
  }
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
            return Container(
              decoration: BoxDecoration(
                color: branding.isDarkMode ? null : const Color(0xFFF5F7FA), // Light mode fallback
                gradient: branding.isDarkMode
                    ? const LinearGradient(
                        colors: [
                          Color(0xFF0B101E), // Deep dark navy
                          Color(0xFF1A1A2E), // Glossy purple-navy
                          Color(0xFF0F172A), // Slate
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        stops: [0.0, 0.5, 1.0],
                      )
                    : null,
              ),
              child: child!,
            );
          },
        );
      },
    );
  }
}
