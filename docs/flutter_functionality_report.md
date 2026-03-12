# Buddy AI Assistant: Flutter App Functionality Report

This report provides a comprehensive overview of every page and its functionality within the **Buddy AI Assistant** Flutter mobile application.

---

## 1. Authentication & Onboarding
These screens handle the user's entry into the application and secure their data.
- **Splash Screen**: The initial loading screen that checks for existing user sessions and handles auto-login.
- **Login Screen**: Allows existing users to authenticate with their credentials.
- **Signup Screen**: Enables new users to create an account.
- **Forgot Password Screen**: Provides a workflow for users to reset their account password via email.

---

## 2. Core Navigation
- **Main Screen**: The central hub that manages the bottom navigation tabs. It coordinates switching between the **Explore**, **Buddy Assistant**, **Memories**, and **Settings** sections.

---

## 3. Buddy AI Assistant (The "Brain")
The flagship feature of the app, providing a premium, interactive AI experience.
- **Buddy Assistant Page**:
    - **Multimodal Chat**: Supports text-based interaction and image/document uploads for visual analysis.
    - **Voice Interaction**: Integrated **Speech-to-Text (STT)** for hands-free input and **Text-to-Speech (TTS)** with customizable voices for AI responses.
    - **Local Intelligence**: Automatically fetches and presents **Local News** and events based on the user's current GPS location.
    - **Real-Time Connectivity**: Uses WebSockets for low-latency, streaming AI responses and wake-word detection.
    - **Personalized Context**: Accesses the user's "Memories" and "Reminders" to provide contextually aware assistance.

---

## 4. Explore & Dashboard
A high-level overview of the user's day and the app's ecosystem.
- **Explore Screen**:
    - **Action Grid**: Quick shortcuts to create new Memories or Reminders.
    - **Smart Marquee**: A dynamic, scrolling "Cloud" of the user's stored memories for quick recall.
    - **Today's Reminders**: A prioritized list of tasks and reminders scheduled for the current day.
    - **Banners**: Entry points for the **Location Reminders** and **Family Hub** modules.

---

## 5. Memory Management
Allows users to store and recall personal information, preferences, and documents.
- **Memory List Screen**: A glassmorphic gallery of all saved memories with search functionality.
- **Memory Details Screen**: View a full memory, including any associated images and metadata.
- **Memory Edit Screen**: Update or delete existing memory entries.

---

## 6. Smart Reminders & Location Services
Advanced task management tied to time, location, and AI-driven logic.
- **Reminder List Screen**: Manage time-based tasks and reminders.
- **Reminder Create Screen**: AI-assisted form for setting up new tasks.
- **Location Reminders Screen**: View reminders that are triggered when arriving at or leaving specific geographic locations.
- **Early Warning / Smart Details Screen**:
    - **Early Warning System**: AI-driven proactive alerts if the user is at risk of being late.
    - **Traffic-Aware ETA**: Automatically adjusts notification times based on real-time traffic data.
    - **Item Exit Guards**: Reminds users to bring specific items (keys, wallet) when leaving a location.
    - **Safety Buffer**: Customizable "buffer time" slider for early notifications.

---

## 7. Family Hub & Communication
Connects the user with loved ones for shared safety and coordination.
- **Family Hub Screen**:
    - **Emergency Alert**: A high-priority button that sends an instant "Help" broadcast to all family members.
    - **Member Management**: Invite family via email and manage connection requests.
    - **Presence Connectivity**: See which family members are active.
- **Family Chat Screen**: Integrated private and group messaging for family coordination.

---

## 8. Account & Personalization
Comprehensive control over the user experience and privacy.
- **Account Settings Screen**:
    - **Profile Management**: Update name, phone, address, and profile picture.
    - **Notification Preferences**: Granular toggles for Voice, Push, Email, and In-App alerts.
    - **Integrations**: Connect and sync with **Google Calendar** for a unified schedule.
    - **Regional Settings**: Configure Date and Time display formats (12h/24h).
    - **Security**: Manage account deletion and logouts.
