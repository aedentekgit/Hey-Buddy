import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';

class NotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final Dio _dio = Dio();
  final _storage = const FlutterSecureStorage();

  Future<void> initialize() async {
    // Request permission
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');
      
      // Get token
      String? token = await _fcm.getToken();
      if (token != null) {
        print('FCM Token: $token');
        _saveTokenToServer(token);
      }
    }

    // Listen to foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Got a message whilst in the foreground!');
      if (message.notification != null) {
        print('Message also contained a notification: ${message.notification}');
      }
    });
  }

  Future<void> _saveTokenToServer(String token) async {
    try {
      final authToken = await _storage.read(key: 'token');
      if (authToken == null) return;

      await _dio.post(
        '${AppConfig.baseUrl}user/fcm-token',
        data: {'token': token},
        options: Options(
          headers: {'Authorization': 'Bearer $authToken'},
        ),
      );
      print("FCM Token saved to server");
    } catch (e) {
      print("Failed to save FCM token: $e");
    }
  }
}
