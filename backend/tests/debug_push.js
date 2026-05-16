const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── PASTE THE FRESH TOKEN FROM FLUTTER LOGS HERE ──
const FRESH_TOKEN = 'fN48lvs7QoKPLElzBvD03S:APA91bFM6GSSUbozlxByL290YGr4oHSenLHJrpEKzWMnCDlvpVBHyLUM5eH5Z6CBmCdMvaYuZ38OoNl-WaHN1gbR-S9ItleeUgqq3FMLL3xRN9Vhbf7gTsw';

const sendTest = async () => {
    try {
        console.log('[1] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('[1] ✅ MongoDB connected');

        const Settings = require('./models/Settings');
        const settings = await Settings.findOne().select('+notification.serviceAccountJson notification.enabled notification.serviceAccountJson');

        if (!settings) throw new Error('No settings found in DB');

        console.log('[2] Notification enabled:', settings.notification?.enabled);
        console.log('[2] Service account path:', settings.notification?.serviceAccountJson);

        const relativePath = settings.notification.serviceAccountJson.startsWith('/')
            ? settings.notification.serviceAccountJson.substring(1)
            : settings.notification.serviceAccountJson;

        const jsonPath = path.join(__dirname, relativePath);
        console.log('[3] Resolved service account file path:', jsonPath);
        console.log('[3] File exists:', fs.existsSync(jsonPath));

        if (!fs.existsSync(jsonPath)) {
            throw new Error(`Service account file NOT FOUND at: ${jsonPath}`);
        }

        const serviceAccount = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        console.log('[3] ✅ Service account loaded for:', serviceAccount.client_email);
        console.log('[3] Project ID:', serviceAccount.project_id);

        // Initialize Firebase Admin
        const appName = 'test-send-' + Date.now();
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        }, appName);
        console.log('[4] ✅ Firebase Admin initialized');

        // Check user FCM tokens in DB
        const User = require('./models/User');
        const users = await User.find({ fcmTokens: { $exists: true, $ne: [] } }).select('email fcmTokens');
        console.log('[5] Users with FCM tokens:', users.length);
        users.forEach(u => {
            console.log(`    📱 ${u.email}: ${u.fcmTokens.length} token(s)`);
            u.fcmTokens.forEach(t => console.log(`       ${t.substring(0, 40)}...`));
        });

        // Send to fresh token from logs
        console.log('\n[6] Sending to fresh token from emulator logs...');
        console.log('[6] Token prefix:', FRESH_TOKEN.substring(0, 40) + '...');

        const message = {
            notification: {
                title: '🔔 Buddy Test Push',
                body: 'Push notifications are working! Time: ' + new Date().toLocaleTimeString()
            },
            data: {
                type: 'test',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'buddy_alerts',
                    defaultSound: true,
                    notificationCount: 1,
                }
            },
            token: FRESH_TOKEN
        };

        const response = await admin.messaging(app).send(message);
        console.log('[6] ✅ Message sent successfully! Message ID:', response);

        await app.delete();
        mongoose.disconnect();
    } catch (e) {
        console.error('\n[ERROR] Failed:', e.code || '', e.message);
        if (e.errorInfo) {
            console.error('[ERROR] FCM Error Info:', JSON.stringify(e.errorInfo, null, 2));
        }
        mongoose.disconnect();
        process.exit(1);
    }
};

sendTest();
