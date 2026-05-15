const admin = require('firebase-admin');
const path = require('path');
const Settings = require('../models/Settings');

// Module-level cache — cleared by resetFirebase() when settings change
let firebaseApp = null;
let firebaseAppName = 'buddy-fcm'; // Named app to avoid conflicts

/**
 * Reset Firebase so the next sendPushNotification call re-initializes
 * with the latest service account. Call this whenever notification settings change.
 */
const resetFirebase = async () => {
    if (firebaseApp) {
        try {
            await firebaseApp.delete();
        } catch (e) {
            // Ignore deletion errors
        }
        firebaseApp = null;
    }
};

const initFirebase = async () => {
    // Return cached app if still alive
    if (firebaseApp) return firebaseApp;

    const settings = await Settings.findOne().select('+notification.serviceAccountJson notification.enabled notification.serviceAccountJson');

    if (!settings || !settings.notification) {
        throw new Error('Notification settings not configured in admin panel');
    }

    if (!settings.notification.enabled) {
        throw new Error('Push notifications are disabled. Please enable them in Admin → Notifications.');
    }

    if (!settings.notification.serviceAccountJson) {
        throw new Error('Firebase Service Account JSON not uploaded. Please upload it in Admin → Notifications.');
    }

    // Build absolute path from relative stored path (e.g. /uploads/config/firebase-sa-xxx.json)
    const relativePath = settings.notification.serviceAccountJson.startsWith('/')
        ? settings.notification.serviceAccountJson.substring(1)
        : settings.notification.serviceAccountJson;

    const jsonPath = path.join(__dirname, '..', relativePath);

    const fs = require('fs');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`Firebase service account file not found at: ${jsonPath}`);
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const serviceAccount = JSON.parse(jsonContent);

    // Check if a named app already exists (e.g. from a previous failed init)
    const existingApp = admin.apps.find(a => a && a.name === firebaseAppName);
    if (existingApp) {
        firebaseApp = existingApp;
        return firebaseApp;
    }

    firebaseApp = admin.initializeApp(
        { credential: admin.credential.cert(serviceAccount) },
        firebaseAppName
    );
    console.log('[Firebase] ✅ Admin SDK initialized with service account:', serviceAccount.client_email);

    return firebaseApp;
};

const sendPushNotification = async (token, title, body, data = {}) => {
    if (!token || token.trim() === '') {
        console.warn('[FCM] Skipping send: empty token');
        return null;
    }

    try {
        const app = await initFirebase();

        // Ensure all data values are strings (FCM requirement)
        const stringData = Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
        );

        const message = {
            notification: { title, body },
            data: stringData,
            token: token,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'buddy_alerts',
                    defaultSound: true,
                    notificationCount: 1,
                }
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                },
                payload: {
                    aps: {
                        'content-available': 1,
                        sound: 'default',
                    }
                }
            }
        };

        const response = await admin.messaging(app).send(message);
        console.log('[FCM] ✅ Notification sent successfully. Message ID:', response);
        return response;
    } catch (error) {
        // Log clearly with the token prefix for debugging
        const tokenPrefix = token ? token.substring(0, 20) + '...' : 'null';
        console.error(`[FCM] ❌ Send failed for token ${tokenPrefix}:`, error.message);
        throw error;
    }
};

/**
 * Send to multiple tokens, collecting results per-token
 */
const sendPushNotificationBatch = async (tokens, title, body, data = {}) => {
    const results = { success: [], failed: [] };
    if (!tokens || tokens.length === 0) return results;

    // UNIQUE-IFY: Ensure we don't send to the same token twice in one batch
    const uniqueTokens = [...new Set(tokens)];

    await Promise.all(
        uniqueTokens.map(token =>
            sendPushNotification(token, title, body, data)
                .then(msgId => results.success.push({ token, msgId }))
                .catch(err => results.failed.push({ token, error: err.message }))
        )
    );

    return results;
};

module.exports = {
    sendPushNotification,
    sendPushNotificationBatch,
    initFirebase,
    resetFirebase,
};
