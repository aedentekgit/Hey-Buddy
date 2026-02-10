# Google Calendar Integration - Complete Setup Guide

## 🎉 Overview
The Buddy AI application now has full Google Calendar integration, allowing users to sync their reminders and events automatically with their Google Calendar.

## ✅ What's Implemented

### 1. **Admin Configuration** (Admin Settings Page)
- **Location**: Admin Settings → Integrations → Google Calendar Setup
- **Features**:
  - Configure OAuth Client ID and Client Secret
  - Set redirect URI (auto-configured to backend URL)
  - Support for multiple account types (Personal, Work, Business)
  - Test OAuth flow with "Verify OAuth Flow" button
  - Connection status indicator

### 2. **User Integration** (User Settings Page)
- **Location**: User Settings → Google Calendar Integration
- **Features**:
  - ✅ **Connection Status**: Visual indicator showing if calendar is linked
  - ✅ **Link Calendar Button**: One-click OAuth flow to connect Google Calendar
  - ✅ **Unlink Calendar Button**: Disconnect Google Calendar integration
  - ✅ **Helpful Tips**: Guidance on how to use the integration

### 3. **Backend Implementation**
- **OAuth Flow**: Complete OAuth 2.0 implementation for Google Calendar API
- **Token Management**: Secure storage of refresh tokens in user database
- **Calendar Operations**:
  - Create events
  - Update events
  - Delete events
  - Read calendar data

### 4. **Voice Assistant Integration**
- Users can create reminders via voice and choose to save to:
  - **Buddy Only**: Saves only in Buddy database
  - **Buddy + Google**: Saves in Buddy AND syncs to Google Calendar

## 🔧 Configuration Steps

### For Administrators:

1. **Google Cloud Console Setup**:
   - Create a Google Cloud Project (or use existing)
   - Enable Google Calendar API
   - Configure OAuth Consent Screen:
     - User Type: External
     - Publishing Status: Testing (for development)
     - Add test users
   - Create OAuth 2.0 Credentials (Web Application)
   - Add authorized redirect URI: `http://localhost:5001/api/voice/google/callback`

2. **Buddy Admin Settings**:
   - Navigate to Admin Settings → Integrations → Google Calendar Setup
   - Enter Client ID from Google Cloud Console
   - Enter Client Secret from Google Cloud Console
   - Redirect URI is auto-filled
   - Set status to "Active"
   - Click "Save Changes"
   - Test with "Verify OAuth Flow" button

### For Users:

1. **Link Google Calendar**:
   - Go to User Settings → Google Calendar Integration
   - Click "Link Google Calendar" button
   - Authenticate with Google account
   - Grant calendar permissions
   - See "Connected" status

2. **Use Calendar Sync**:
   - Create reminders via Buddy AI voice assistant
   - Choose "Buddy + Google" when saving
   - Events automatically sync to Google Calendar

3. **Unlink Calendar** (if needed):
   - Go to User Settings → Google Calendar Integration
   - Click "Unlink Calendar" button
   - Confirm unlinking

## 📁 Files Modified

### Frontend:
- `frontend/src/pages/AdminSettings.jsx` - Admin calendar setup UI
- `frontend/src/pages/UserSettings.jsx` - User calendar integration UI
- `frontend/src/pages/BuddyAssistant.jsx` - Voice assistant with calendar sync
- `frontend/.env` - API URL configuration

### Backend:
- `backend/controllers/voiceController.js` - OAuth flow and calendar operations
- `backend/controllers/userController.js` - User calendar unlinking
- `backend/routes/userRoutes.js` - Unlink calendar route
- `backend/models/User.js` - Google refresh token storage
- `backend/models/Settings.js` - Google Calendar settings schema
- `backend/controllers/settingsController.js` - Settings CRUD operations
- `backend/.env` - Google OAuth credentials

## 🔐 Security Features

1. **Client Secret Protection**: Marked with `select: false` in database schema
2. **Refresh Token Security**: Stored securely in user model
3. **OAuth 2.0**: Industry-standard authentication
4. **User-Level Permissions**: Each user manages their own calendar connection
5. **Admin-Level Configuration**: Centralized OAuth credentials management

## 🎯 User Flow

### Linking Calendar:
1. User clicks "Link Google Calendar" in User Settings
2. OAuth popup opens with Google sign-in
3. User authenticates and grants permissions
4. Refresh token saved to user account
5. "Connected" status displayed

### Creating Synced Reminders:
1. User speaks to Buddy AI: "Create a meeting tomorrow at 3 PM"
2. Buddy parses the reminder details
3. User reviews and selects "Buddy + Google"
4. Reminder saved to Buddy database
5. Event created in Google Calendar
6. Success confirmation shown

### Unlinking Calendar:
1. User clicks "Unlink Calendar" in User Settings
2. Refresh token removed from user account
3. "Not Connected" status displayed
4. Future reminders won't sync (existing events remain in Google Calendar)

## 🚀 API Endpoints

### User Endpoints:
- `POST /api/users/unlink-calendar` - Unlink Google Calendar
- `POST /api/users/fcm-token` - Save FCM token for notifications

### Voice/Calendar Endpoints:
- `GET /api/voice/google/auth` - Get OAuth authorization URL
- `GET /api/voice/google/callback` - OAuth callback handler

### Settings Endpoints:
- `GET /api/settings` - Get all settings (including Google Calendar config)
- `PUT /api/settings` - Update settings (including Google Calendar config)

## 📝 Environment Variables

### Backend (.env):
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5001/api/voice/google/callback
```

### Frontend (.env):
```env
VITE_API_URL=http://localhost:5001/api
VITE_BACKEND_URL=http://localhost:5001
```

## 🎨 UI Features

### Connection Status Indicators:
- ✅ **Connected**: Green badge with checkmark
- ❌ **Not Connected**: Gray badge with X icon

### Visual Feedback:
- Loading spinners during OAuth flow
- Success/error toast notifications
- Smooth animations for status changes
- Helpful tips and guidance text

## 🔄 Sync Behavior

- **One-way sync**: Buddy → Google Calendar
- **Event creation**: Automatic when "Buddy + Google" is selected
- **Event updates**: Synced when reminder is modified in Buddy
- **Event deletion**: Synced when reminder is deleted in Buddy
- **Default duration**: 30 minutes for calendar events
- **Timezone**: Asia/Kolkata (configurable)

## 🐛 Troubleshooting

### Common Issues:

1. **"org_internal" error**:
   - Solution: Change OAuth consent screen to "External"

2. **"redirect_uri_mismatch" error**:
   - Solution: Ensure redirect URI in Google Cloud matches backend URL

3. **"Authentication failed"**:
   - Solution: Check that Client Secret is saved in Admin Settings

4. **Calendar not syncing**:
   - Solution: Verify user has linked their calendar in User Settings

## 📊 Database Schema

### User Model:
```javascript
{
  googleRefreshToken: String,  // OAuth refresh token
  fcmTokens: [String],         // Push notification tokens
  voicePreferences: {
    gender: String,
    tone: String
  }
}
```

### Settings Model:
```javascript
{
  googleCalendar: {
    activeAccount: String,     // 'personal', 'work', or 'business'
    accounts: {
      personal: {
        clientId: String,
        clientSecret: String,  // select: false
        redirectUri: String,
        enabled: Boolean
      },
      work: { ... },
      business: { ... }
    }
  }
}
```

## ✨ Success!

Your Google Calendar integration is now fully operational! Users can seamlessly sync their Buddy AI reminders with Google Calendar for a unified scheduling experience.

---

**Last Updated**: February 10, 2026
**Version**: 1.0.0
