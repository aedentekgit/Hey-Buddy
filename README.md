# Hey Buddy - AI Voice Assistant Platform

A comprehensive AI-powered voice assistant platform with multi-model support, Google Calendar integration, and advanced administrative features.

## 🚀 Features

### Core Capabilities
- **AI Voice Assistant**: Multi-model AI support (OpenAI, Anthropic, Google Gemini)
- **Smart Reminders**: Voice-activated reminder management with Google Calendar sync
- **Memory System**: Contextual conversation memory for personalized interactions
- **Multi-Language Support**: Auto-detection with language-controlled responses

### AI Engine
- **Direct Gemini Integration**: Use your own Google AI Studio API key for free Pro access
- **Multi-AI Consensus Mode**: Compare responses from multiple models
- **Smart Free Router**: Automatic free model selection
- **Self-Healing Fallbacks**: Automatic recovery when primary models fail

### Integrations
- **Google Calendar**: Multi-account support (Personal, Work, Business)
- **Google Authentication**: OAuth login for web, Android, and iOS
- **Email & SMS**: SMTP and SMS notifications
- **Push Notifications**: Firebase Cloud Messaging support

### Administration
- **Role-Based Access Control**: Granular permissions system
- **User Management**: Complete user lifecycle management
- **System Settings**: Centralized configuration dashboard
- **Theme Customization**: Dark/Light modes with accent color options

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (v4.4 or higher)
- **Google Cloud Console** account (for Calendar & Auth)
- **OpenRouter API Key** (optional, for multi-model AI)
- **Google AI Studio API Key** (optional, for direct Gemini access)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/aedentekgit/Hey-Buddy.git
cd Hey-Buddy
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/buddy
JWT_SECRET=your_super_secret_jwt_key_here
FRONTEND_URL=http://localhost:3000

# OpenRouter (Optional - for multi-model AI)
OPENAI_API_KEY=your_openrouter_api_key

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5001/api/voice/google/callback

# Firebase (Optional - for push notifications)
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:5001/api
VITE_BACKEND_URL=http://localhost:5001
```

### 4. Start the Application

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:3000`

## 🔑 Configuration

### Google AI Studio (Free Gemini Access)
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. In Buddy Admin Settings → AI Engine → Enter your Gemini API Key
4. Select "Gemini 2.0 Flash (Fully Free)" as your primary model

### Google Calendar Integration
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URI: `http://localhost:5001/api/voice/google/callback`
6. In Buddy Admin Settings → Integrations → Configure your credentials

### Google Authentication
1. In Google Cloud Console, create OAuth 2.0 credentials for:
   - Web application
   - Android (optional)
   - iOS (optional)
2. In Buddy Admin Settings → Authentication → Enter your Client IDs
3. Enable Google Authentication

## 📱 Usage

### Default Admin Credentials
```
Email: admin@example.com
Password: admin123
```

**⚠️ Change these credentials immediately after first login!**

### Voice Commands Examples
- "Remind me to take my medicine tomorrow at 10 AM"
- "What are my reminders for today?"
- "Remember that I prefer coffee without sugar"
- "What do you know about me?"

## 🏗️ Project Structure

```
Hey-Buddy/
├── backend/
│   ├── controllers/     # Request handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth & validation
│   ├── utils/           # Helper functions
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React contexts
│   │   ├── services/    # API services
│   │   └── App.jsx      # Main app component
│   └── index.html
└── README.md
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (RBAC)
- Secure API key storage
- Environment variable protection
- CORS configuration

## 🎨 Customization

### Theme Settings
Navigate to **Admin Settings → Appearance** to customize:
- Theme Mode (Dark/Light/Auto)
- Accent Color
- Theme Variant (Default/Vibrant/Elegant)
- Font Family

### AI Configuration
Navigate to **Admin Settings → AI Engine** to configure:
- Primary AI Model
- Gemini API Key (for free access)
- Multi-AI Consensus Mode
- Response preferences

## 🐛 Troubleshooting

### "Brain Trouble" Error
This means all AI models failed. Solutions:
1. Add your Gemini API Key in Settings
2. Select "Gemini 2.0 Flash (Fully Free)" as primary model
3. Check your OpenRouter credits (if using)

### Google Calendar Not Syncing
1. Verify credentials in Admin Settings → Integrations
2. Check redirect URI matches exactly
3. Ensure Google Calendar API is enabled in Cloud Console

### Authentication Issues
1. Clear browser cache and cookies
2. Verify JWT_SECRET is set in backend .env
3. Check MongoDB connection

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

## 🙏 Acknowledgments

- OpenAI for GPT models
- Anthropic for Claude
- Google for Gemini AI and Calendar API
- OpenRouter for multi-model access

---

**Built with ❤️ using React, Node.js, Express, and MongoDB**
