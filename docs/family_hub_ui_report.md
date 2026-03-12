# Family Hub UI Specification

This document details the UI components and interactive elements of the **Family Hub** screen within the Buddy AI Assistant mobile application.

---

## 1. Header & Navigation
- **AppBar**: Full-width glass dashboard style.
- **Title**: "Family Hub" (Display centered, Outfit bold, 20pt).
- **Background**: Dynamic top-down gradient using the brand's primary color, fading into a light slate background for the main content area.

---

## 2. Emergency Broadcast System
The highest priority component designed for immediate visibility.
- **Emergency Banner**:
  - A frosted glass container with a red pulsing alert icon.
  - **Dynamic Title**: "Emergency Help" in bold white.
  - **Subtext**: "Alert everyone instantly".
  - **Main Action**: "SEND EMERGENCY ALERT" button.
- **Interactions**:
  - Triggers a system-wide broadcast to all connected family members.
  - Includes a safety confirmation dialog to prevent accidental triggers.

---

## 3. Connectivity & Invites
Allows for the expansion of the family circle.
- **Connect Family Card**:
  - Premium white glass container (0.9 opacity).
  - **Input Field**: Minimalist "Gmail or Apple ID" text entry with a modern pill shape.
  - **Action**: Direct `Send` button (with built-in loading indicator during the invite process).
- **Pending Requests**:
  - A dedicated section for incoming connection requests.
  - **Quick Actions**: "Accept" (Green check) and "Decline" (Red X) icons neatly grouped in a compact card.

---

## 4. Family Member Management
A real-time list of all active family connections.
- **Member Cards**:
  - Displays user profile pictures with high-resolution circular avatars.
  - **Self-Indicator**: A specialized "You" badge for the current user's own card.
  - **Real-Time Actions**:
    - **Private Chat**: Lucide `messageCircle` icon for direct messaging.
    - **Remove Member**: Lucide `userMinus` icon for connection management (securely handled with a confirmation prompt).
- **Communication Hub**:
  - **Group Chat Button**: A dedicated action in the section header for starting family-wide discussions.

---

## 5. Visual Aesthetics & Polish
- **Glassmorphism**: Consistent use of `GlassContainer` with varying opacity and backdrop filters (sigma 10-20).
- **Typography**: Exclusive use of the **Outfit** font family from Google Fonts for a premium, modern feel.
- **Interactions**: Smooth fade-in transitions using `AnimationController` and bouncy list physics for a native feedback experience.
