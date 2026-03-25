# Security Setup Guide

## Overview
This guide explains how to configure API keys and sensitive credentials securely without hardcoding them in the source code.

---

## 1. Flutter Android Configuration

### Google Maps API Key Setup

The Google Maps API key is now configured dynamically through `local.properties`.

#### Steps:

1. Create or edit `Flutter/android/local.properties`
2. Add your Google Maps API key:

```properties
# Google Maps API Key (Get from https://console.cloud.google.com/)
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
```

3. The build system will automatically inject this into the AndroidManifest.xml

**Note:** The `local.properties` file is already in `.gitignore` and will never be committed.

---

### Android Keystore Configuration

Keystore credentials are now loaded from `local.properties` for security.

#### Steps:

1. Generate or obtain your release keystore (if you don't have one):

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias upload
```

2. Add keystore configuration to `Flutter/android/local.properties`:

```properties
# Keystore Configuration
storeFile=upload-keystore.jks
storePassword=YOUR_STRONG_PASSWORD_HERE
keyAlias=upload
keyPassword=YOUR_KEY_PASSWORD_HERE
```

3. Place your `upload-keystore.jks` file in `Flutter/android/app/`

**Security Notes:**
- Never commit `.jks` keystore files to git
- Use strong, unique passwords
- Store backup copies of keystore securely offline

---

## 2. Backend API Keys (Node.js)

All backend API keys should be stored in `.env` files and configured through the admin settings page.

### Environment Files:

```bash
backend/.env              # Local development
backend/.env.staging      # Staging environment
backend/.env.production   # Production environment
```

### Required Environment Variables:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/heybuddy

# JWT Secret (Generate: openssl rand -base64 64)
JWT_SECRET=YOUR_STRONG_JWT_SECRET_HERE

# Firebase Admin SDK (Path to service account JSON)
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json

# Google OAuth (Get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET

# Email Configuration (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379

# Server Configuration
PORT=5002
NODE_ENV=production
```

---

## 3. Python AI Service Configuration

The Python AI service uses environment variables for API keys.

### Environment Files:

```bash
python/.env              # Local development
python/.env.staging      # Staging environment
python/.env.production   # Production environment
```

### Required Environment Variables:

```env
# Primary AI Provider API Keys (at least one required)
GROQ_API_KEY=gsk_YOUR_GROQ_API_KEY_HERE
GROQ_API_KEY_2=gsk_YOUR_BACKUP_GROQ_KEY_HERE  # Optional fallback
GROQ_API_KEY_3=gsk_YOUR_THIRD_GROQ_KEY_HERE   # Optional fallback

# Alternative AI Providers (Optional - for fallback)
GEMINI_API_KEY=AIzaYOUR_GEMINI_KEY_HERE
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=sk-ant-YOUR_ANTHROPIC_KEY_HERE

# Model Configuration
GROQ_MODEL=llama-3.3-70b-versatile

# Search API (Optional - for web search features)
TAVILY_API_KEY=tvly-YOUR_TAVILY_KEY_HERE

# Database Paths (Default values are fine for most setups)
# LEARNING_DATA_DIR=./database/learning_data
# VECTOR_STORE_DIR=./database/vector_store
```

---

## 4. Admin Settings Page (Dynamic API Keys)

**IMPORTANT:** All AI provider API keys should be configurable through the admin settings page, not hardcoded.

### Current Implementation:

The admin settings page allows administrators to configure:
- ✅ Primary AI Provider (Groq, Gemini, OpenAI, DeepSeek, Anthropic)
- ✅ API Keys for each provider
- ✅ Preferred AI Model
- ✅ Fallback providers

### How It Works:

1. Admin logs in and navigates to Settings → AI Configuration
2. Enters API keys for desired providers
3. Keys are stored securely in the database (encrypted)
4. Python AI service receives keys via API request headers
5. Fallback system tries alternative providers if primary fails

### For Developers:

**Backend:** API keys are stored in the `settings` collection in MongoDB
**Python Service:** Receives keys dynamically via `api_key` and `api_keys_dict` parameters in `groq_service.py`

---

## 5. Git Security

### Files That Should NEVER Be Committed:

```
.env
.env.local
.env.production
.env.staging
local.properties
*.jks (keystore files)
service-account.json
*.pem
*.p12
```

### Checking Git History:

If you accidentally committed secrets, remove them from history:

```bash
# Remove .env files from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch **/.env*" \
  --prune-empty -- --all

# Force push (WARNING: This rewrites history)
git push origin --force --all
```

**Then:**
1. Rotate all exposed API keys immediately
2. Generate new secrets
3. Update environment files

---

## 6. Production Deployment Checklist

### Before Deploying:

- [ ] All API keys moved to environment variables
- [ ] Strong passwords for keystore (not "android")
- [ ] `usesCleartextTraffic` removed from AndroidManifest (HTTPS only)
- [ ] Firebase service account JSON not in git
- [ ] `.env` files properly configured for production
- [ ] JWT secret is strong and unique (64+ characters)
- [ ] Database credentials secure
- [ ] Backup keystore stored offline
- [ ] All environment files in `.gitignore`

### Security Best Practices:

1. **Rotate secrets regularly** (every 90 days)
2. **Use different keys** for dev/staging/production
3. **Enable 2FA** on all API provider accounts
4. **Monitor API usage** for anomalies
5. **Set up rate limiting** on backend endpoints
6. **Enable CORS** with specific origins only
7. **Use HTTPS everywhere** (no cleartext traffic)
8. **Implement API key rotation** without downtime

---

## 7. Local Development Setup

### First Time Setup:

```bash
# 1. Clone repository
git clone <repo-url>
cd Buddy

# 2. Setup Flutter
cd Flutter
cp android/local.properties.example android/local.properties
# Edit local.properties with your keys
flutter pub get

# 3. Setup Backend
cd ../backend
cp .env.example .env
# Edit .env with your keys
npm install

# 4. Setup Python AI Service
cd ../python
cp .env.example .env
# Edit .env with your keys
pip install -r requirements.txt

# 5. Start services
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Python AI
cd python && python run.py

# Terminal 3: Flutter
cd Flutter && flutter run
```

---

## 8. Environment Variable Templates

### Flutter `local.properties` Template:

```properties
# Google Maps API Key
GOOGLE_MAPS_API_KEY=YOUR_KEY_HERE

# Keystore Configuration
storeFile=upload-keystore.jks
storePassword=YOUR_PASSWORD_HERE
keyAlias=upload
keyPassword=YOUR_PASSWORD_HERE
```

### Backend `.env` Template:

```env
MONGODB_URI=mongodb://localhost:27017/heybuddy
JWT_SECRET=GENERATE_STRONG_SECRET_HERE
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
PORT=5002
NODE_ENV=development
```

### Python `.env` Template:

```env
GROQ_API_KEY=gsk_YOUR_KEY_HERE
GEMINI_API_KEY=AIza_YOUR_KEY_HERE
OPENAI_API_KEY=sk-YOUR_KEY_HERE
TAVILY_API_KEY=tvly-YOUR_KEY_HERE
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## Need Help?

If you encounter issues:
1. Check logs in each service
2. Verify environment variables are loaded correctly
3. Ensure API keys are valid and have proper quotas
4. Check network/firewall settings
5. Review the main README.md for troubleshooting

**Last Updated:** March 25, 2026
