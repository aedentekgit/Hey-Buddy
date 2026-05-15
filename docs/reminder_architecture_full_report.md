# Buddy AI - Unified Reminder System Report

This report provides a comprehensive overview of the current technical implementation of the Reminder and Location Reminder systems in Buddy AI, confirming alignment with your requested architecture.

---

## 1. System Architecture Overview
The system is built on a **Backend-Heavy** logic pattern. All trigger calculations, distance formula processing (Haversine), and scheduling are handled on the Node.js server. The Flutter and React frontends act strictly as data entry and viewing layers, calling the APIs to provide user configuration.

---

## 2. Supported Reminder Types

### A. Normal Reminders (Time-Based)
*   **Categories**: Pickup, Drop, Meeting, Medicine, Personal, etc.
*   **Trigger Logic**: These reminders are triggered precisely when the current server time (adjusted for the user's local timezone) matches the scheduled `date` and `time`.
*   **Location Inclusivity**: If a meeting includes a location name like "Hiranandani Office," the system still treats it as a time-based reminder unless the time field is omitted.

### B. Location-Based Reminders (Geofence Reminders)
*   **Workflow**: These reminders trigger based on proximity to a physical location rather than a clock.
*   **Geocoding**: Upon creation, the backend uses the **Google Maps Geocoding API** to fetch precise GPS coordinates if they aren't provided.
*   **Geofencing**: Every location reminder defines a `geofenceRadius` (default: 500 meters).
*   **Trigger Logic**: When the user enters the defined radius, the backend detects this during its background check and fires the notification immediately.

---

## 3. Location Tracking & Distance Logic

The mobile application (Flutter) periodically updates the user's GPS position via the `POST /api/users/update-location` endpoint.

*   **Distance calculation**: The backend implements the **Haversine formula** (`calculateDistance`) to calculate the exact distance (in meters) between the user's current GPS position and any active reminder coordinates.
*   **Real-time response**: When a location update is received, the backend immediately triggers an "Exit Guard" check to see if the user has left a specific location where they needed to bring items.

---

## 4. Smart Reminder Features (AI-Powered)

These features are handled by a dedicated scheduler (`smartReminderScheduler.js`) that runs every **5 minutes**.

### I. Early Warning System
*   **How it works**: Uses the **Google Distance Matrix API** to calculate real-time travel times. 
*   **Logic**: `(Scheduled Time) - (Traffic-Aware Travel Time) - (Buffer Time)`. 
*   **Behavior**: If the user needs to leave within the next 30 minutes to arrive on time, an "Early Warning" alert is dispatched.

### II. Traffic-Aware ETA
*   **How it works**: Monitors traffic conditions for upcoming events.
*   **Threshold**: If current traffic causes a delay of strictly **10 minutes or more** compared to standard travel times, the system sends an emergency update via voice and push notification.

### III. Item Exit Guards
*   **Category**: Proximity-based safety check.
*   **Behavior**: When a user leaves their current location (as tracked by the mobile app), the system checks if they have any pending items listed in reminders for that specific geofence and alerts them to "Don't forget [Item Name]."

---

## 5. Notification Delivery Channels
Notifications are triggered exclusively by the backend across four major channels:

1.  **Firebase Cloud Messaging (FCM)**: Reliable cross-platform push notifications for mobile devices.
2.  **Voice Announcements (Socket.io)**: If the user is actively using the Buddy AI Assistant, the backend emits a `voice_alert`. The assistant then speaks the reminder out loud.
3.  **Email Alerts**: Critical reminders (like medicine or high-priority meetings) are sent via verified SMTP services.
4.  **In-App Center**: Persistent notifications stored in MongoDB and synchronized across all devices in real-time.

---

## 6. Background Processing & Scalability

### **Current Execution:**
The system uses **node-cron** to manage background tasks:
*   `startReminderWorker`: Runs every **1 minute** (handles precise time-based and geofence entries).
*   `startSmartReminderScheduler`: Runs every **5 minutes** (handles Google API travel analysis and exit guards).

### **Scalability Roadmap:**
The backend is designed for modularity. As usage grows, the cron-based triggers are ready to be migrated to **Queue-based jobs using Redis and BullMQ** to handle high-concurrency location updates and traffic calculations without bottlenecking the main event loop.

---

## 7. Technology Stack Checklist

| Component | Technology Used | Status |
| :--- | :--- | :--- |
| **Backend** | Node.js (Express) | **ACTIVE** |
| **Database** | MongoDB | **ACTIVE** |
| **Location APIs** | Google Maps Geocoding & Distance Matrix | **INTEGRATED** |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | **INTEGRATED** |
| **Real-time Messaging** | Socket.io | **ACTIVE** |
| **Background Jobs** | node-cron (Ready for BullMQ) | **ACTIVE** |
| **Mobile Frontend** | Flutter | **ACTIVE** |
| **Web Frontend** | React | **ACTIVE** |
