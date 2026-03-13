# Buddy Project Deployment & APK Build Guide

This guide provides the exact commands and steps to deploy the Buddy project to the VPS and build the mobile application for both **Staging** and **Live (Production)** environments.

---

## 1. Web & Services Deployment (VPS)

The deployment script handles packaging the Frontend, Backend, and AI Service, uploading them to the VPS, and restarting the services with zero downtime.

### Staging Environment
*   **URL**: [https://staging.ayuskart.com](https://staging.ayuskart.com)
*   **Command**:
    ```bash
    node deploy/deploy-vps.js staging
    ```

### Live (Production) Environment
*   **URL**: [https://ayuskart.com](https://ayuskart.com)
*   **Command**:
    ```bash
    node deploy/deploy-vps.js production
    ```

---

## 2. Mobile APK Build (Flutter)

The mobile app configuration is dynamic. By default, a release build points to Staging. To build for Live, you must provide the production URL as a build argument.

### Build Step: Preparation
Ensure you are in the mobile directory:
```bash
cd buddy_mobile
```

### Staging APK
Builds an APK that connects to `staging.ayuskart.com`.
```bash
flutter build apk --release
```
*   **Output Path**: `build/app/outputs/flutter-apk/app-release.apk`

### Live (Production) APK
Builds an APK that connects to the main production server `ayuskart.com`.
```bash
flutter build apk --release --dart-define=API_URL=ayuskart.com
```
*   **Output Path**: `build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Post-Deployment Checks

### Service Status (VPS)
To check if the services are running on the server:
```bash
ssh root@82.29.167.22 "pm2 list"
```

### View Logs
*   **Staging AI**: `ssh root@82.29.167.22 "pm2 logs buddy-backend-staging-ai"`
*   **Production AI**: `ssh root@82.29.167.22 "pm2 logs buddy-backend-prod-ai"`

### Database Manual Adjustments
If you need to update settings via MongoDB (e.g., clearing the `aiAssistantApiUrl`):
```bash
ssh root@82.29.167.22 'mongosh "mongodb://buddy_admin:HeyBuddySecure123!@82.29.167.22:27017/staging_Heybuddy?authSource=admin" --eval "db.settings.updateOne({}, {\$set: {\"ai.aiAssistantApiUrl\": \"\"}})"'
```
*(Replace `staging_Heybuddy` with `live_Heybuddy` for production)*
