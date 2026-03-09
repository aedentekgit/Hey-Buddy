import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_tts/flutter_tts.dart';

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';

// ─── Background handler (must be top-level) ───────────────────────────────────
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  print("[FCM Background] messageId: ${message.messageId}");
  print("[FCM Background] title: ${message.notification?.title}");
  print("[FCM Background] body: ${message.notification?.body}");
  print("[FCM Background] data: ${message.data}");

  // Show local notification so the user sees it when app is background-killed
  final localNotif = FlutterLocalNotificationsPlugin();
  const androidInit = AndroidInitializationSettings('@mipmap/launcher_icon');
  await localNotif.initialize(const InitializationSettings(android: androidInit));

  final text = message.notification?.body ?? message.data['body'] as String?;
  if (text != null && text.isNotEmpty) {
    await localNotif.show(
      message.hashCode,
      message.notification?.title ?? 'Buddy',
      text,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'buddy_alerts',
          'Buddy Alerts',
          channelDescription: 'Smart reminder & early warning alerts',
          importance: Importance.max,
          priority: Priority.high,
          playSound: true,
        ),
      ),
    );

    // Voice readout
    try {
      final FlutterTts tts = FlutterTts();
      await tts.awaitSpeakCompletion(true);
      await tts.setVolume(1.0);
      await tts.setSpeechRate(0.5);
      await tts.setPitch(1.0);
      await tts.speak("Pardon the interruption. $text");
    } catch (e) {
      print("[FCM Background] TTS error: $e");
    }
  }
}

// ─── Notification Channel ─────────────────────────────────────────────────────
const AndroidNotificationChannel _channel = AndroidNotificationChannel(
  'buddy_alerts',
  'Buddy Alerts',
  description: 'Smart reminder & early warning alerts from Buddy AI',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
);

// ─── Notification Service ─────────────────────────────────────────────────────
class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final Dio _dio = Dio();
  final _storage = const FlutterSecureStorage();

  final FlutterLocalNotificationsPlugin _localNotif =
      FlutterLocalNotificationsPlugin();

  Future<void> initialize() async {
    // 1. Create Android notification channel
    await _localNotif
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    // 2. Initialize local notifications plugin
    const androidInit = AndroidInitializationSettings('@mipmap/launcher_icon');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _localNotif.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    // 3. Request FCM permission
    final NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    print('[FCM] Permission status: ${settings.authorizationStatus}');

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      // 4. Get & register token
      final String? token = await _fcm.getToken();
      if (token != null) {
        print('[FCM] Token: $token');
        await _saveTokenToServer(token);
      }

      // 5. Listen for token refresh
      _fcm.onTokenRefresh.listen((newToken) {
        print('[FCM] Token refreshed: $newToken');
        _saveTokenToServer(newToken);
      });
    } else {
      print('[FCM] Permission NOT granted: ${settings.authorizationStatus}');
    }

    // 6. Handle foreground messages — show local notification
    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      print('[FCM Foreground] Received: ${message.notification?.title}');
      print('[FCM Foreground] Body: ${message.notification?.body}');
      print('[FCM Foreground] Data: ${message.data}');

      final notification = message.notification;
      final String title = notification?.title ?? message.data['title'] as String? ?? 'Buddy';
      final String? body = notification?.body ?? message.data['body'] as String?;

      if (body != null && body.isNotEmpty) {
        // Show heads-up banner via local notifications
        await _localNotif.show(
          message.hashCode,
          title,
          body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'buddy_alerts',
              'Buddy Alerts',
              channelDescription: 'Smart reminder & early warning alerts',
              importance: Importance.max,
              priority: Priority.high,
              playSound: true,
              enableVibration: true,
            ),
            iOS: DarwinNotificationDetails(
              presentAlert: true,
              presentBadge: true,
              presentSound: true,
            ),
          ),
        );

        // Voice readout
        try {
          final FlutterTts tts = FlutterTts();
          await tts.setVolume(1.0);
          await tts.setSpeechRate(0.5);
          await tts.setPitch(1.0);
          await tts.speak("Pardon the interruption. $body");
        } catch (e) {
          print('[FCM Foreground] TTS error: $e');
        }
      }
    });

    // 7. Handle notification tap when app is in background (but not killed)
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('[FCM] App opened from notification: ${message.notification?.title}');
    });

    // 8. Check if app was opened from a terminated-state notification
    final RemoteMessage? initialMessage = await _fcm.getInitialMessage();
    if (initialMessage != null) {
      print('[FCM] App launched from notification: ${initialMessage.notification?.title}');
    }
  }

  Future<void> updateToken() async {
    final String? token = await _fcm.getToken();
    if (token != null) {
      print('[FCM] Updating token: $token');
      await _saveTokenToServer(token);
    }
  }

  Future<void> _saveTokenToServer(String token) async {
    try {
      final authToken = await _storage.read(key: 'jwt');
      if (authToken == null) {
        print('[FCM] Skipping token registration: not logged in yet');
        return;
      }

      await _dio.post(
        '${AppConfig.baseUrl}users/fcm-token',
        data: {'token': token},
        options: Options(
          headers: {
            'Authorization': 'Bearer $authToken',
            'x-platform': 'mobile',
          },
          sendTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 10),
        ),
      );
      print('[FCM] ✅ Token saved to server successfully');
    } catch (e) {
      print('[FCM] ⚠️ Failed to save FCM token: $e');
    }
  }
}
