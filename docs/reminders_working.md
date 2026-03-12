# Reminder & Location Reminder Systems in Buddy AI

This document explains the technical implementation and workflow of the reminder and location-based reminder systems in the Buddy AI platform.

## 1. Core Architectures

The system uses two primary data models for reminders, both stored in MongoDB:

*   **Standard Reminders (`Reminder` model):** Feature-rich reminders that include Google Calendar sync, medicine details, and advanced sharing capabilities.
*   **Location Reminders (`LocationReminder` model):** Specialized reminders focused on geofencing and proximity-based triggers.

---

## 2. How Standard Reminders Work

Standard reminders are primarily time-based but augmented with AI-powered "Smart Features."

### Workflow:
1.  **Creation:** When a user creates a reminder, the backend uses the **Google Maps Geocoding API** to automatically convert a written location (e.g., "Starbucks") into GPS coordinates (`lat`, `lng`).
2.  **Google Calendar Sync:** If the user has linked their Google account, Buddy synchronously creates/updates an event in their Google Calendar.
3.  **Smart Features Execution:** A backend scheduler (`smartReminderScheduler.js`) runs every **5 minutes** to process all pending reminders.

### Smart Features:
*   **Early Warning System:** 
    *   Calculates the **traffic-aware travel time** from the user's current location to the reminder destination.
    *   Subtracts travel time + a safety buffer (e.g., 15 mins) from the scheduled start time.
    *   Sends an alert if the user needs to leave within the next 30 minutes.
*   **Traffic-Aware ETA:** 
    *   Monitors real-time traffic conditions.
    *   If a delay of 10+ minutes is detected, it sends a "Traffic Alert" suggesting the user leave earlier.
*   **Item Exit Guards:** 
    *   Reminds the user about specific items (e.g., "Don't forget your keys") when they are leaving their current location.

---

## 3. How Location Reminders Work

Location reminders focus on **Proximity** and **Geofencing**.

### Workflow:
1.  **Location Tracking:** The Buddy Mobile App (Flutter) periodically sends the user's current GPS coordinates to the backend via the `/users/update-location` endpoint.
2.  **Distance Calculation:** The backend uses the **Haversine Formula** to calculate the distance between the user's current location and the reminder's target coordinates.
3.  **Geofencing:** 
    *   Each reminder has a `geofenceRadius` (default: 500 meters).
    *   **Logic A (Standard Exit):** If a user was previously inside the radius and is now outside, it triggers an "Exit Guard" notification.
    *   **Logic B (Proximity Entry):** If a user enters the radius of a location-based task, they are notified immediately.

---

## 4. Notification Delivery System

Buddy uses a multi-channel approach to ensure you never miss a reminder:

1.  **Push Notifications:** Delivered via **Firebase Cloud Messaging (FCM)** to the mobile app.
2.  **AI Voice Announcements:** If the user is active in the "Buddy Assistant" chat, the backend emits a `voice_alert` via **Socket.io**, causing Buddy to speak the reminder aloud.
3.  **Email Alerts:** Sent for critical reminders or shared task updates.
4.  **In-App Alerts:** Displayed in the "Activity Feed" and "Notification Center."

---

## 5. Technical Stack Summary

| Component | Technology |
| :--- | :--- |
| **Backend Logic** | Node.js (Express) |
| **Database** | MongoDB (Mongoose) |
| **Location Services** | Google Maps Distance Matrix & Geocoding API |
| **Background Tasks** | `node-cron` (Running every 5 minutes) |
| **Real-time Comms** | Socket.io & Firebase Cloud Messaging |
| **Mobile Frontend** | Flutter (Location Service + Background Fetch) |
