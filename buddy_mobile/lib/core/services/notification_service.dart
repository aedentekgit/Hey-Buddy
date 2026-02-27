import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:buddy_mobile/core/config/app_config.dart';
import 'package:flutter_tts/flutter_tts.dart';

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  
  print("Handling a background message: ${message.messageId}");
  
  // Play voice-over if text exists in the push payload
  if (message.notification?.body != null || message.data['body'] != null) {
    String textToSpeak = message.notification?.body ?? message.data['body'];
    print("HELLO FROM BACKGROUND ISOLATE! Initializing TTS for background voice over: $textToSpeak");
    try {
      FlutterTts flutterTts = FlutterTts();
      await flutterTts.awaitSpeakCompletion(true); // Wait so the isolate doesn't die
      await flutterTts.setVolume(1.0);
      await flutterTts.setSpeechRate(0.5);
      await flutterTts.setPitch(1.0);
      
      // Attempt to speak the reminder message
      var result = await flutterTts.speak("Pardon the interruption. $textToSpeak");
      print("TTS background voice over completed or failed silently with result: $result");
    } catch (e, stack) {
      print("ERROR IN BACKGROUND TTS: $e\n$stack");
    }
  }
}

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
        updateToken(); // Try to save if already logged in
      }
    }

    // Listen to foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) async {
      print('Got a message whilst in the foreground!');
      
      // Play voice-over if text exists in the push payload
      if (message.notification?.body != null || message.data['body'] != null) {
        String textToSpeak = message.notification?.body ?? message.data['body']!;
        print("Initializing Foreground TTS: $textToSpeak");
        try {
          FlutterTts flutterTts = FlutterTts();
          await flutterTts.setVolume(1.0);
          await flutterTts.setSpeechRate(0.5);
          await flutterTts.setPitch(1.0);
          await flutterTts.speak("Pardon the interruption. $textToSpeak");
        } catch (e) {
          print("Foreground TTS Error: $e");
        }
      }
    });
  }

  Future<void> updateToken() async {
    String? token = await _fcm.getToken();
    if (token != null) {
      await _saveTokenToServer(token);
    }
  }

  Future<void> _saveTokenToServer(String token) async {
    try {
      final authToken = await _storage.read(key: 'jwt'); 
      if (authToken == null) {
        print("Skipping FCM registration: Not logged in");
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
        ),
      );
      print("FCM Token saved to server");
    } catch (e) {
      print("Failed to save FCM token: $e");
    }
  }
}
