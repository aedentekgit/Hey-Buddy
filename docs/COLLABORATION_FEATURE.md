# 🤝 Buddy Collaboration & Delegation Feature Documentation

## Overview
The Collaboration Feature allows users to share location-based and time-based reminders with family members. It provides granular control over who receives proximity alerts and ensures that all participants are informed in real-time.

---

## 🛠 Features

### 1. Unified Collaboration (Add/Remove Family)
- **Search & Add**: Users can search for family members by name or email within the `Explore` / `Smart Details` panel.
- **Auto-Population**: When a family member is added, the UI immediately resolves their **Name** and **Profile Picture**, eliminating "Unknown" placeholders.
- **Permissions**: Current implementation supports a default 'view' permission for shared users.

### 2. "Include My Location" Toggle (Delegation)
Located in the Collaboration section of any reminder, this toggle controls the Notification Role:
- **Toggle ON (Joint Task)**: 
    - The Creator receives "Time to Leave" and GPS proximity alerts.
    - Shared Family Members also receive proximity alerts based on their own location.
- **Toggle OFF (Delegated Task)**:
    - The Creator **does not** receive travel-time or proximity alerts for themselves.
    - The task is delegated to the shared User.
    - **Arrival Notification**: When the shared user arrives at the destination, the Creator receives a special notification: *"[Name] has arrived for: [Task Title]"*.

### 3. Smart Notification Engine (Multichannel)
When a reminder is shared or triggered, the system automatically dispatches notifications across three channels:
1.  **In-App Alerts**: A database record is created and appears in the user's notification bell.
2.  **Push Notifications (FCM)**: A real-time ping is sent to the mobile device.
3.  **Email Alerts**: A branded HTML email is sent to the shared user's inbox with details of the task and schedule.

---

## 🏗 Technical Implementation

### Backend Changes
- **Model (`Reminder.js`)**: Added `notifyCreator` (Boolean) and expanded `sharedWith` schema.
- **Controller (`reminderController.js`)**: 
    - Modified `createReminder` and `updateReminder` to detect new collaborators and trigger instant welcome notifications.
    - Updated all return objects to use `.populate()` for User metadata.
- **Worker (`reminderWorker.js`)**:
    - Rewrote the location-trigger logic to iterate through `sharedWith` users.
    - Implemented a check on the `notifyCreator` flag to conditionally skip creator geofence proximity checks.

### Frontend Changes (Flutter)
- **Widget (`smart_details_panel.dart`)**:
    - Implemented a dynamic search input that filters the `FamilyProvider`.
    - Integrated `CachedNetworkImage` for real-time profile picture rendering.
    - Added the "Include My Location" switch with immediate `TasksProvider` auto-save functionality.

---

## ✅ Validation Status
Verified via automated test suite against local MongoDB as of March 13, 2026:
- [x] API User Population (Fixes "Unknown" UI error)
- [x] Delegation Logic (notifyCreator flag respected)
- [x] Multichannel Notification Dispatch (Push/Email/DB)
- [x] Shared User Proximity Trigger
