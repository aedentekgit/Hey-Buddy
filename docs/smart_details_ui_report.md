# Smart Details UI Specification

This document details the UI components and interactive elements of the **Smart Details** (Early Warning) screen within the Buddy AI Assistant mobile application.

---

## 1. Header Section
- **Title**: "Smart Details" (Dynamic: changes to "Edit Settings" when in edit mode).
- **Navigation**:
  - **Back Button**: Lucide `arrowLeft` icon, returns user to the previous screen.
  - **Status Badge**: A pill-shaped indicator showing current task status (e.g., "On Track" in Emerald Green).
- **Primary Action**: "Edit Settings" button (or "Cancel" in edit mode).
  - Glassmorphic style with subtle border.
  - Switches the panel into an interactive form to modify task metadata.

---

## 2. Task Summary
- **Main Title**: Large bold typography (Outfit, 28pt) displaying the task name (e.g., "Pickup son").
- **Location Row**:
  - **Icon**: Lucide `mapPin` (Violet).
  - **Details**: Displays the destination address.
  - **GPS Badge**: A vibrant green badge indicating active GPS tracking for this specific location.
- **Schedule Row**:
  - **Icon**: Lucide `clock` (Violet).
  - **Details**: Displays the combined Date and Time (e.g., "Time: 05:00 PM • 2026-03-11").

---

## 3. Time & Buffer Configuration (Smart Engine)
This section allows users to customize the AI's notification logic.
- **Safety Buffer Slider**:
  - **Label**: "Safety Buffer Time".
  - **Value Indicator**: Purple pill showing the selected minutes (e.g., "5 min").
  - **Interactive Slider**: Allows adjustment between 5 and 120 minutes.
  - **Description**: Helper text explaining that this time is added *before* travel time to prevent lateness.
- **Adjusted Notification Preview**:
  - **Visual Style**: A prominent purple-tinted card.
  - **Icon**: Pulsing Lucide `bell` icon.
  - **Dynamic Calculation**: Displays the **Adjusted Notification Time** (e.g., "06:14 PM").
  - **Logic**: Calculated in real-time as: `Scheduled Time - (Traffic Travel Time + Safety Buffer)`.

---

## 4. Navigation & Location Intelligence
- **Interactive Map** (Rendered if coordinates exist):
  - **Markers**: Displays current user location and destination.
  - **Polyline Route**: Shows the "Driving" path calculated by the Google Directions API.
- **Travel Statistics Bar**:
  - **Distance**: Displays real-time road distance in km.
  - **ETA**: Displays real-time estimated time of arrival based on current traffic conditions.

---

## 5. Item Exit Guards & Proactive Features
- **Smart Features Toggles**:
  - **Early Warning**: Enable/Disable AI traffic monitoring.
  - **Item Exit Guards**: Toggle reminders for specific items (e.g., "Don't forget your keys").
  - **Family Hub Sync**: Option to share real-time progress with family members.
