import 'dart:async';
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
        // Keep a single sync manager instance and update its dependencies.
        ChangeNotifierProxyProvider<BuddyProvider, RealtimeSyncManager>(
          create: (_) => RealtimeSyncManager(),
          update: (context, buddy, manager) {
            final syncManager = manager ?? RealtimeSyncManager();
            syncManager.bind(
              socketService: buddy.socketService,
              tasksProvider: context.read<TasksProvider>(),
              locationRemindersProvider: context.read<LocationRemindersProvider>(),
              memoriesProvider: context.read<MemoriesProvider>(),
              userProvider: context.read<UserProvider>(),
              familyProvider: context.read<FamilyProvider>(),
            );
            return syncManager;
          },
          lazy: false,
        ),
      ],
      child: const BuddyApp(),
    ),
  );
}

class RealtimeSyncManager extends ChangeNotifier {
  StreamSubscription<Map<String, dynamic>>? _subscription;
  SocketService? _socketService;
  TasksProvider? _tasksProvider;
  LocationRemindersProvider? _locationRemindersProvider;
  MemoriesProvider? _memoriesProvider;
  UserProvider? _userProvider;
  FamilyProvider? _familyProvider;

  void bind({
    required SocketService socketService,
    required TasksProvider tasksProvider,
    required LocationRemindersProvider locationRemindersProvider,
    required MemoriesProvider memoriesProvider,
    required UserProvider userProvider,
    required FamilyProvider familyProvider,
  }) {
    _tasksProvider = tasksProvider;
    _locationRemindersProvider = locationRemindersProvider;
    _memoriesProvider = memoriesProvider;
    _userProvider = userProvider;
    _familyProvider = familyProvider;

    if (identical(_socketService, socketService) && _subscription != null) {
      return;
    }

    _subscription?.cancel();
    _socketService = socketService;
    _subscription = socketService.dataSyncStream.listen(_handleSync);
  }

  void _handleSync(Map<String, dynamic> data) {
    final type = data['type'];
    debugPrint('RealtimeSyncManager: Received sync for $type');

    try {
      if (type == 'task' || type == 'reminder') {
        final tasksProvider = _tasksProvider;
        if (tasksProvider != null) {
          _runSafely(
            tasksProvider.loadTasks(silent: true),
            'task/reminder',
          );
        }
      } else if (type == 'location_reminder') {
        final locationRemindersProvider = _locationRemindersProvider;
        if (locationRemindersProvider != null) {
          _runSafely(
            locationRemindersProvider.loadReminders(),
            'location_reminder',
          );
        }
      } else if (type == 'memory') {
        final memoriesProvider = _memoriesProvider;
        if (memoriesProvider != null) {
          _runSafely(
            memoriesProvider.loadMemories(silent: true),
            'memory',
          );
        }
      } else if (type == 'profile') {
        final userProvider = _userProvider;
        if (userProvider != null) {
          _runSafely(userProvider.loadProfile(), 'profile');
        }
      } else if (type == 'family') {
        final familyProvider = _familyProvider;
        if (familyProvider != null) {
          _runSafely(familyProvider.loadData(), 'family');
        }
      }
    } catch (e) {
      debugPrint('RealtimeSyncManager: Error handling sync - $e');
    }
  }

  void _runSafely(Future<void> future, String label) {
    unawaited(
      future.catchError((e) {
        debugPrint('RealtimeSyncManager: $label sync failed - $e');
      }),
    );
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
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
