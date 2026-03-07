# Hey Buddy — Wake-Word & Barge-In System Architecture

This document outlines the complete implementation for:
1. **"Hey Buddy"** wake-word activation (always-listening, hands-free)
2. **Barge-In** — user can interrupt Buddy mid-speech and Buddy stops + listens
3. **Stop Command** — saying "stop", "pause", "quiet" etc. halts Buddy immediately

---

## System Overview

```
Flutter App  ──► Node.js Backend  ──► Gemini Live API
   (mic)           (orchestration)       (STT + AI Brain)
    ▲                    │
    └────────────────────┘
         Socket.io (bidirectional)
```

**States:**
- `STANDBY` → Always streaming audio, scanning for "Hey Buddy"
- `ACTIVE` → Processing user commands normally
- `SPEAKING` → Buddy is playing TTS audio response
- `BARGE_IN` → User spoke while Buddy was speaking → stop + listen

---

## 1. Flutter (Mobile) — Audio Streaming & Barge-In

**File:** `lib/features/voice_assistant/screens/buddy_assistant_page.dart`

### State Variables

```dart
bool _isStandby = true;       // true = waiting for wake word
bool _isBuddySpeaking = false; // true = Buddy is playing TTS audio
AudioPlayer _audioPlayer = AudioPlayer(); // TTS playback
StreamSubscription? _audioRecSub;
StreamSubscription? _wakeWordSub;
StreamSubscription? _bargeInSub;
StreamSubscription? _stopCmdSub;
```

### Recorder Initialization (Always-On)

```dart
// Initialize at 16kHz — always stream audio (even in standby)
await _recorderStream.initialize(sampleRate: 16000);

_audioRecSub = _recorderStream.audioStream.listen((data) {
  // Always send audio — backend decides what to do based on state
  provider.socketService.sendAudioChunk(data);
});
```

### Wake-Word Listener

```dart
// Server fires 'wake_word_detected' → activate Buddy
_wakeWordSub = provider.socketService.wakeWordStream.listen((_) {
  setState(() => _isStandby = false);
  HapticFeedback.mediumImpact();
  _playActivationSound(); // e.g., a soft "ding"
  // STT is now active on backend — no need to restart mic
});
```

### Barge-In Listener (User interrupts Buddy)

```dart
// When user speaks while Buddy is talking → stop audio immediately
_bargeInSub = provider.socketService.bargeInStream.listen((_) {
  if (_isBuddySpeaking) {
    _audioPlayer.stop();          // Stop Buddy's voice
    setState(() => _isBuddySpeaking = false);
    // Backend is now listening for the new user command
  }
});
```

### Stop Command Listener

```dart
// User said "stop", "pause", "be quiet", etc.
_stopCmdSub = provider.socketService.stopCommandStream.listen((_) {
  _audioPlayer.stop();
  setState(() {
    _isBuddySpeaking = false;
    _isStandby = true; // Return to standby after explicit stop
  });
});
```

### TTS Playback (track when Buddy is speaking)

```dart
void _playBuddyResponse(String audioUrl) async {
  setState(() => _isBuddySpeaking = true);
  await _audioPlayer.play(UrlSource(audioUrl));
  // Reset after playback finishes naturally
  _audioPlayer.onPlayerComplete.listen((_) {
    setState(() => _isBuddySpeaking = false);
  });
}
```

---

## 2. Socket.io Service — New Event Streams

**File:** `lib/services/socket_service.dart`

```dart
// Existing
Stream<dynamic> get wakeWordStream => _wakeWordController.stream;

// NEW — add these:
final _bargeInController   = StreamController<dynamic>.broadcast();
final _stopCmdController   = StreamController<dynamic>.broadcast();

Stream<dynamic> get bargeInStream    => _bargeInController.stream;
Stream<dynamic> get stopCommandStream => _stopCmdController.stream;

void _registerListeners() {
  socket.on('wake_word_detected', (data) => _wakeWordController.add(data));
  socket.on('barge_in_detected',  (data) => _bargeInController.add(data));   // NEW
  socket.on('stop_command',       (data) => _stopCmdController.add(data));   // NEW
}
```

---

## 3. Backend (Node.js) — Barge-In & Stop Command Logic

**File:** `backend/agents/BuddyAgent.js`

### State Variables

```javascript
this.isStandby   = true;   // Waiting for wake word
this.isSpeaking  = false;  // Buddy is currently playing TTS
```

### Audio Relay (Unchanged)

```javascript
handleIncomingAudio(audioBuffer) {
  if (this.ai && this.ai.isConnected) {
    const base64 = Buffer.from(audioBuffer).toString('base64');
    this.ai.sendAudio(base64);
  }
}
```

### Transcript Handler — Wake Word + Barge-In + Stop

```javascript
this.ai.on('user_transcript', (text) => {
  const transcript = text.toLowerCase().trim();

  // ── STANDBY MODE: scan for wake word only ──────────────────────
  if (this.isStandby) {
    if (transcript.includes('hey buddy')) {
      console.log('[BuddyAgent] ⚡ Wake Word Detected!');
      this.isStandby = false;
      this.socket.emit('wake_word_detected');
    }
    return; // Ignore everything else in standby
  }

  // ── STOP COMMANDS: user wants Buddy to shut up ─────────────────
  const stopWords = ['stop', 'pause', 'be quiet', 'shut up', 'enough', 'cancel'];
  if (stopWords.some(w => transcript.includes(w))) {
    console.log('[BuddyAgent] 🛑 Stop Command Detected');
    this.isSpeaking = false;
    this.isStandby  = true;  // Go back to standby
    this.socket.emit('stop_command');
    return;
  }

  // ── BARGE-IN: user spoke while Buddy was speaking ──────────────
  if (this.isSpeaking) {
    console.log('[BuddyAgent] 🎤 Barge-In Detected — interrupting Buddy');
    this.isSpeaking = false;
    this.socket.emit('barge_in_detected'); // Tell Flutter to stop audio
    // Fall through to process the new command below
  }

  // ── ACTIVE MODE: normal command processing ─────────────────────
  this.processMessage(text);
});
```

### Mark Buddy as Speaking (call this when sending TTS to Flutter)

```javascript
sendResponseToClient(audioData) {
  this.isSpeaking = true;
  this.socket.emit('buddy_response_audio', audioData);

  // Safety reset — if playback event never fires
  setTimeout(() => { this.isSpeaking = false; }, 30000);
}

// Call this when TTS finishes (if you track it server-side)
onTTSComplete() {
  this.isSpeaking = false;
}
```

---

## 4. Gemini Live Service — Configuration

**File:** `backend/services/geminiLiveService.js`

```javascript
const setupMessage = {
  setup: {
    model: "models/gemini-2.0-flash-exp",
    generation_config: {
      response_modalities: ["AUDIO"],
    },
    // Enables real-time transcription of the user's voice
    input_audio_transcription: {},
    // Optional: Enable output transcription to detect when Buddy finishes
    output_audio_transcription: {},
  }
};
```

---

## 5. State Machine Summary

```
┌─────────────┐   "Hey Buddy"    ┌────────────┐
│   STANDBY   │ ───────────────► │   ACTIVE   │
│ (listening  │                  │ (processing│
│  for wake   │ ◄─────────────── │  commands) │
│   word)     │  stop command    │            │
└─────────────┘                  └─────┬──────┘
                                       │ Buddy responds
                                       ▼
                                 ┌────────────┐
                                 │  SPEAKING  │
                                 │ (TTS plays)│
                                 └─────┬──────┘
                                       │ user speaks → BARGE-IN
                                       ▼
                                 ┌────────────┐
                                 │  BARGE-IN  │ → stop audio → ACTIVE
                                 └────────────┘
```

---

## 6. Network Configuration

**File:** `backend/server.js`

```javascript
// Must bind to 0.0.0.0 so Android Emulator (10.0.2.2) can reach it
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend listening on 0.0.0.0:${PORT}`);
});
```

**Android Emulator → Local Machine:** Use `10.0.2.2` instead of `localhost`

```dart
// lib/services/socket_service.dart
const String backendUrl = 'http://10.0.2.2:3000';
```

---

## 7. New Socket.io Events Reference

| Event | Direction | Description |
|---|---|---|
| `audio_chunk` | Flutter → Backend | Raw PCM audio (16kHz, continuous) |
| `wake_word_detected` | Backend → Flutter | "Hey Buddy" matched — go active |
| `barge_in_detected` | Backend → Flutter | User spoke mid-reply — stop TTS |
| `stop_command` | Backend → Flutter | Stop command heard — go standby |
| `buddy_response_audio` | Backend → Flutter | TTS audio for Buddy's reply |

---

## 8. Quick Checklist

- [ ] Flutter streams audio **continuously** (not just when mic button pressed)
- [ ] Backend `isStandby` flag defaults to `true` on connection
- [ ] Stop words list customised for your use case
- [ ] `isSpeaking` flag set to `true` before emitting TTS audio
- [ ] `barge_in_detected` received by Flutter → `_audioPlayer.stop()` called
- [ ] Gemini config includes `input_audio_transcription: {}`
- [ ] Android Emulator uses `10.0.2.2` as backend host
