# 🚀 Project Buddy: AI-Powered Smart Assistant

A comprehensive documentation of the current functionality and technology stack used in **Buddy**.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: [React 19](https://react.dev/) (Vite)
- **Styling**: Vanilla CSS (Premium Design System)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Visuals**: [Cobe](https://github.com/shuding/cobe) (Interactive 3D Globe), [Lucide React](https://lucide.dev/) (Iconography)
- **Charts**: [Recharts](https://recharts.org/) (Data Visualization)
- **State Management**: React Context API
- **Notifications**: React Hot Toast

### **Backend**
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose ODM)
- **Authentication**: JWT & [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- **File Storage**: [Firebase Storage](https://firebase.google.com/products/storage)
- **Scheduler**: [Node-Cron](https://www.npmjs.com/package/node-cron)

### **AI & Third-Party APIs**
- **NLU/LLMs**: 
  - [OpenAI GPT-4o-mini](https://openai.com/) (Primary NLU)
  - [Google Gemini 1.5 Flash](https://aistudio.google.com/) (Vision & RAG)
  - [OpenRouter](https://openrouter.ai/) (Multi-model routing)
- **Location Services**: [Google Maps Distance Matrix API](https://developers.google.com/maps/documentation/distance-matrix)
- **Communication**: 
  - [Firebase Cloud Messaging](https://firebase.google.com/products/cloud-messaging) (Push Notifications)
  - [Nodemailer](https://nodemailer.com/) (SMTP Email)
- **Productivity**: [Google Calendar API](https://developers.google.com/calendar)

---

## 🌟 Core Functionality

### **1. AI Voice Assistant (Buddy 2.0)**
- **Voice Lifecycle**: Implements an 8-step lifecycle (Capture → ASR → Turn-taking → NLU → TTS → Playback).
- **Natural Interaction**: Supports multi-language responses and context-aware chatting.
- **Voice-to-Action**: Can create reminders, save memories, and query knowledge directly through voice commands.

### **2. AI-Powered Smart Reminders**
- **⚠️ Early Warning System**: Proactively alerts users to leave for appointments based on real-time traffic and GPS location.
- **🚦 Traffic-Aware ETA**: Monitors active reminders and sends alerts if traffic delays exceed 10 minutes.
- **📦 Item Exit Guards**: Geofencing technology that reminds you to bring specific items (keys, charger) when you leave your current location.

### **3. AI Vision (Smart Lens)**
- **Document Extraction**: Upload images of prescriptions, grocery lists, or bills.
- **Automated Reminders**: Automatically parses image content and converts it into structured reminders (e.g., medication schedules).
- **Firebase Integration**: Images are securely stored in the cloud for historical reference.

### **4. Personal Knowledge Core (RAG)**
- **Document Memory**: Upload PDFs or images to build a personal AI knowledge base.
- **Searchable Wisdom**: Ask Buddy questions about your own documents (e.g., "What was the warranty date on my laptop invoice?").
- **Hybrid Search**: Combines Mongo text indexing with LLM reasoning.

### **5. Administration & System Management**
- **Admin Dashboard**: Real-time stats on user activity, reminder distribution, and system health.
- **RBAC (Role-Based Access Control)**: Granular permissions for Admins, Users, and specialized roles.
- **Appearance Engine**: Full UI customization including Dark/Light modes, accent colors, and font preferences.

### **6. Ecosystem Sync**
- **Google Calendar**: Bi-directional sync for all reminders.
- **Multi-Device Flow**: Backend support for Android (APK) and Web clients.
- **Self-Healing AI**: Automatic fallback mechanism if one AI provider (OpenRouter/OpenAI) is unavailable.

---

## 📁 Infrastructure
- **Containerization**: `Dockerfile` and `docker-compose.yml` included for easy deployment.
- **Deployment**: Automated VPS setup scripts (`setup_vps.sh`) and Nginx configurations.
- **Database Tools**: Built-in scripts for DB export, restore, and user seeding.

---
*Created by Buddy AI Development Team*
