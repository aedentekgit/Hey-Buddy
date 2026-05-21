package com.aedentek.heybuddy

import android.media.AudioManager
import android.os.Bundle
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    private val CHANNEL = "com.aedentek.heybuddy/audio"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "setSpeakerphoneOn" -> {
                    try {
                        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
                        audioManager.mode = AudioManager.MODE_NORMAL
                        audioManager.isSpeakerphoneOn = true
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("AUDIO_ERROR", "Failed to set speakerphone: ${e.message}", null)
                    }
                }
                "setSpeakerphoneOff" -> {
                    try {
                        val audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
                        audioManager.isSpeakerphoneOn = false
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("AUDIO_ERROR", "Failed to unset speakerphone: ${e.message}", null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
