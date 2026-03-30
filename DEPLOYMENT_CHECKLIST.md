# 🚀 Deployment Checklist

Use this checklist before deploying to staging or production.

---

## ☑️ Pre-Deployment Tasks

### 1. Security Configuration

- [ ] Create `Flutter/android/local.properties` from the example
  ```bash
  cd Flutter/android
  cp local.properties.example local.properties
  ```

- [ ] Add your Google Maps API key to `local.properties`
  ```properties
  GOOGLE_MAPS_API_KEY=YOUR_ACTUAL_KEY_HERE
  ```

- [ ] Generate or obtain release keystore
  ```bash
  keytool -genkey -v -keystore upload-keystore.jks \
    -keyalg RSA -keysize 2048 -validity 10000 -alias upload
  ```

- [ ] Add keystore credentials to `local.properties`
  ```properties
  storeFile=upload-keystore.jks
  storePassword=YOUR_STRONG_PASSWORD
  keyAlias=upload
  keyPassword=YOUR_KEY_PASSWORD
  ```

- [ ] Verify `local.properties` is in `.gitignore`
  ```bash
  git check-ignore Flutter/android/local.properties
  # Should output: Flutter/android/local.properties
  ```

- [ ] Verify keystore files are in `.gitignore`
  ```bash
  git check-ignore Flutter/android/app/*.jks
  # Should output the jks file path
  ```

---

### 2. Backend Configuration

- [ ] Create `backend/.env` from example (if exists)
  ```bash
  cd backend
  cp .env.example .env
  ```

- [ ] Configure all required environment variables:
  - [ ] `MONGODB_URI`
  - [ ] `JWT_SECRET` (generate with: `openssl rand -base64 64`)
  - [ ] `FIREBASE_SERVICE_ACCOUNT_PATH`
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `PORT` (default: 5002)
  - [ ] `NODE_ENV` (production/staging/development)

- [ ] Ensure Firebase service account JSON is not in git
  ```bash
  git check-ignore backend/service-account.json
  ```

- [ ] Test backend starts without errors
  ```bash
  npm install
  npm start
  ```

---

### 3. Python AI Service Configuration

- [ ] Create `python/.env` from example
  ```bash
  cd python
  cp .env.example .env
  ```

- [ ] Configure AI provider API keys:
  - [ ] `GROQ_API_KEY` (primary)
  - [ ] `GROQ_API_KEY_2` (optional backup)
  - [ ] `GEMINI_API_KEY` (optional)
  - [ ] `OPENAI_API_KEY` (optional)
  - [ ] `ANTHROPIC_API_KEY` (optional)
  - [ ] `TAVILY_API_KEY` (for web search)

- [ ] Set preferred model:
  - [ ] `GROQ_MODEL=llama-3.3-70b-versatile`

- [ ] Install Python dependencies
  ```bash
  pip install -r requirements.txt
  ```

- [ ] Test Python service starts
  ```bash
  python run.py
  ```

---

### 4. Flutter App Build

- [ ] Install/update Flutter dependencies
  ```bash
  cd Flutter
  flutter pub get
  ```

- [ ] Run Flutter analyzer
  ```bash
  flutter analyze
  # Should show 7 or fewer low-priority issues
  ```

- [ ] Build debug APK for testing
  ```bash
  flutter build apk --debug
  ```

- [ ] Test debug APK on physical device
  - [ ] App launches successfully
  - [ ] Google Maps loads correctly
  - [ ] Biometric authentication works (if device supports)
  - [ ] Network requests work (HTTPS only)

- [ ] Build release APK
  ```bash
  flutter build apk --release
  ```

- [ ] Verify APK size (should be ~60-65MB)
  ```bash
  ls -lh build/app/outputs/flutter-apk/app-release.apk
  ```

---

## ☑️ Security Verification

### 5. Secrets Audit

- [ ] No API keys in `AndroidManifest.xml`
  ```bash
  grep -i "AIza" Flutter/android/app/src/main/AndroidManifest.xml
  # Should return nothing or ${GOOGLE_MAPS_API_KEY}
  ```

- [ ] No passwords in `build.gradle.kts`
  ```bash
  grep -i "password.*=" Flutter/android/app/build.gradle.kts
  # Should only show property reads, not hardcoded values
  ```

- [ ] No cleartext traffic enabled
  ```bash
  grep "usesCleartextTraffic" Flutter/android/app/src/main/AndroidManifest.xml
  # Should return nothing
  ```

- [ ] No `.env` files in git history
  ```bash
  git log --all --full-history -- "**/.env*"
  # Should be empty or show removal commits only
  ```

- [ ] Run security scan (optional but recommended)
  ```bash
  # Using trivy or similar tool
  trivy fs .
  ```

---

### 6. Git Repository Check

- [ ] All sensitive files are gitignored
  ```bash
  # Should NOT be tracked:
  git ls-files | grep -E '(\.env$|local\.properties|\.jks|service-account\.json)'
  # Should return nothing
  ```

- [ ] No large binary files accidentally committed
  ```bash
  git ls-files | grep -E '\.(apk|ipa|pdf|docx)$'
  # Should return nothing
  ```

- [ ] README updated with deployment instructions
- [ ] CHANGELOG updated with version changes

---

## ☑️ Functional Testing

### 7. Core Features Test (Manual)

- [ ] **Authentication:**
  - [ ] User registration works
  - [ ] Login works (email/password)
  - [ ] Google Sign-In works
  - [ ] Biometric login works (if enabled)
  - [ ] Logout works

- [ ] **AI Assistant:**
  - [ ] Voice input works
  - [ ] Text chat works
  - [ ] AI responses are generated
  - [ ] Fallback providers work if primary fails

- [ ] **Tasks & Reminders:**
  - [ ] Create task
  - [ ] Edit task
  - [ ] Delete task
  - [ ] Task notifications work
  - [ ] Location-based reminders work

- [ ] **Memories:**
  - [ ] Create memory
  - [ ] View memory
  - [ ] Edit memory
  - [ ] Delete memory

- [ ] **Family Features:**
  - [ ] Family chat works
  - [ ] Emergency alerts work
  - [ ] Location sharing works

- [ ] **Settings:**
  - [ ] Profile update works
  - [ ] AI provider configuration works
  - [ ] Voice preferences work
  - [ ] Privacy settings work

---

### 8. Network & Performance

- [ ] All API calls use HTTPS
  ```bash
  # On Android, run: adb logcat | grep "cleartext"
  # Should show no cleartext warnings
  ```

- [ ] API response times acceptable (<2s)
- [ ] App loads in <3 seconds
- [ ] No memory leaks (check with Flutter DevTools)
- [ ] Battery drain is reasonable

---

## ☑️ Admin Configuration

### 9. Database Setup

- [ ] MongoDB running and accessible
- [ ] Database indexes created
- [ ] Admin user created
- [ ] Default settings configured

### 10. Admin Settings Panel

- [ ] Access admin settings page
- [ ] Configure primary AI provider (Groq/Gemini/OpenAI/Claude/DeepSeek)
- [ ] Add API keys for AI providers
- [ ] Set preferred AI model
- [ ] Test AI responses with configured keys
- [ ] Verify fallback providers work

---

## ☑️ Monitoring & Logs

### 11. Logging Setup

- [ ] Backend logs configured (Winston)
- [ ] Python service logs configured
- [ ] Log rotation enabled
- [ ] Error tracking setup (Sentry/Firebase Crashlytics)

### 12. Monitoring

- [ ] Server health checks enabled
- [ ] API endpoint monitoring
- [ ] Database performance monitoring
- [ ] Firebase Analytics configured (if used)
- [ ] Alert thresholds set

---

## ☑️ Final Pre-Launch

### 13. Documentation

- [ ] README.md updated
- [ ] API documentation current
- [ ] Admin guide available
- [ ] User guide available
- [ ] Troubleshooting guide available

### 14. Backup & Recovery

- [ ] Database backup configured
- [ ] Keystore backup stored securely offline
- [ ] Environment variables documented
- [ ] Recovery procedures documented
- [ ] Rollback plan prepared

### 15. Legal & Compliance

- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] GDPR compliance checked (if applicable)
- [ ] Data retention policy set
- [ ] User consent mechanisms working

---

## ☑️ Deployment

### 16. Staging Deployment

- [ ] Deploy backend to staging
- [ ] Deploy Python service to staging
- [ ] Deploy web frontend to staging (if applicable)
- [ ] Upload APK to internal testing track
- [ ] Run smoke tests on staging
- [ ] Load testing completed

### 17. Production Deployment

- [ ] Schedule deployment window
- [ ] Notify users of maintenance (if needed)
- [ ] Deploy backend to production
- [ ] Deploy Python service to production
- [ ] Deploy web frontend to production
- [ ] Upload APK to Google Play (production track)
- [ ] Verify all services are running
- [ ] Run smoke tests on production
- [ ] Monitor for 24 hours

---

## ☑️ Post-Deployment

### 18. Monitoring (First 24 Hours)

- [ ] Check error rates every hour
- [ ] Monitor API response times
- [ ] Check database performance
- [ ] Review user feedback
- [ ] Monitor crash reports

### 19. Follow-up (First Week)

- [ ] Review analytics data
- [ ] Check AI provider usage/costs
- [ ] Verify backup systems working
- [ ] Collect user feedback
- [ ] Address critical issues

---

## 🆘 Rollback Plan

If critical issues are found:

1. **Stop accepting new users** (maintenance mode)
2. **Identify the issue** (logs, error reports)
3. **If unfixable quickly:**
   - Revert to previous APK version in Play Store
   - Rollback backend deployment
   - Restore database from backup (if needed)
4. **Notify users** (in-app message or email)
5. **Fix issues in staging** before re-deploying

---

## 📞 Emergency Contacts

- **DevOps Lead:** _______________
- **Backend Developer:** _______________
- **Mobile Developer:** _______________
- **Database Admin:** _______________
- **Security Team:** _______________

---

## 📝 Notes

### Current Version:
- **App Version:** 1.0.8+10
- **Backend API:** v1.0
- **Python Service:** v1.0

### Known Issues:
- (List any known non-critical issues here)

### Future Improvements:
- Add unit tests
- Implement automated security scanning
- Add API rate limiting monitoring
- Enable ProGuard/R8 for APK size reduction

---

**Last Updated:** March 25, 2026
**Next Review:** _______________
