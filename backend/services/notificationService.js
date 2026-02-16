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
        // We need the full absolute path
        const jsonPath = path.join(__dirname, '..', settings.notification.serviceAccountJson);

        const serviceAccount = require(jsonPath);

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("Firebase Admin Initialized");
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
            token: token
        };

        const response = await admin.messaging().send(message);
        return response;
    } catch (error) {
        console.error("Firebase Send Error:", error);
        throw error;
    }
};

module.exports = {
    sendPushNotification,
    initFirebase
};
