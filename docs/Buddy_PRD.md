# Product Requirements Document: Buddy AI Assistant

## 1. Executive Summary
Buddy is a professional health and personal assistant application. It features a real-time voice assistant powered by Gemini AI, memory management, and a smart reminder system. The project consists of a Node.js/Express backend, a Flutter mobile application, and a React-based web dashboard.

## 2. Core Features
### A. Voice Assistant (Gemini Live)
- Real-time voice interaction with low latency.
- Persona-based responses (Soft/Energetic tones, Male/Female voices).
- Context-aware conversations using user memories and upcoming reminders.
- Support for multiple languages with automatic detection.

### B. Smart Memories
- Users can save "Memories" (facts or notes).
- AI can search through memories to provide personalized answers during conversations.

### C. Reminder System
- Create and manage health or task reminders.
- Smart notification system via Socket.io.
- Automatic reminder worker that runs in the background.

### D. User Management
- Authentication (JWT-based).
- Role-based access control.
- Profile and settings management (Timezone, Voice preferences).

## 3. Technical Stack
- **Backend:** Node.js, Express, MongoDB, Socket.io, Gemini API, OpenAI API.
- **Mobile:** Flutter (Dart).
- **Web Frontend:** React (Vite).
- **Architecture:** Microservices-lite with REST APIs for data and WebSockets for real-time voice.

## 4. User Flows
1. **Onboarding:** User logs in, sets voice tone preference and timezone.
2. **Voice Session:** User speaks to "Buddy". Buddy retrieves current context (date, memories, reminders) and responds with generated audio.
3. **Task Management:** User creates a reminder via text or voice. Buddy sets a cron job and notifies the user at the correct time.
