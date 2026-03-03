const admin = require('firebase-admin');
const path = require('path');
const Settings = require('../models/Settings');

let firebaseApp = null;

const initFirebase = async () => {
    try {
        if (firebaseApp) return firebaseApp;

        const settings = await Settings.findOne();
        if (!settings || !settings.notification || !settings.notification.serviceAccountJson) {
            throw new Error("Firebase Service Account JSON not found in settings");
        }

        // The path stored is like /uploads/filename.json
        // We need the full absolute path. Remove leading slash for correct joining.
        const relativePath = settings.notification.serviceAccountJson.startsWith('/')
            ? settings.notification.serviceAccountJson.substring(1)
            : settings.notification.serviceAccountJson;

        const jsonPath = path.join(__dirname, '..', relativePath);

        const fs = require('fs');
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const serviceAccount = JSON.parse(jsonContent);

        if (!admin.apps.length) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin Initialized");
        } else {
            firebaseApp = admin.app();
        }

        return firebaseApp;
    } catch (error) {
        console.error("Firebase Init Error:", error);
        throw error;
    }
};

const sendPushNotification = async (token, title, body, data = {}) => {
    try {
        const app = await initFirebase();

        const message = {
            notification: { title, body },
            data: data,
            token: token,
            android: {
                priority: 'high',
                notification: {
                    channelId: 'buddy_alerts',
                    defaultSound: true
                }
            },
            apns: {
                payload: {
                    aps: {
                        'content-available': 1,
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        return response;
    } catch (error) {
        console.error("Firebase Send Error:", error.message);
        throw error;
    }
};

module.exports = {
    sendPushNotification,
    initFirebase
};
