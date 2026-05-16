import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import api from "./api";

let messaging = null;
let notificationConfig = null;

export const initNotifications = async () => {
    try {
        if (messaging && notificationConfig) {
            return { messaging, vapidKey: notificationConfig.vapidKey };
        }

        // 1. Fetch config from server
        const response = await api.get('/settings/public');
        const settings = response.data.data.notification;

        if (!settings?.enabled || !settings.firebaseApiKey || !settings.firebaseProjectId) {
            console.warn("Firebase not fully configured in settings");
            return null;
        }

        const firebaseConfig = {
            apiKey: settings.firebaseApiKey,
            authDomain: settings.firebaseAuthDomain,
            projectId: settings.firebaseProjectId,
            storageBucket: settings.firebaseStorageBucket,
            messagingSenderId: settings.firebaseMessageSenderId,
            appId: settings.firebaseAppId,
            measurementId: settings.firebaseMeasurementId
        };

        // 2. Initialize Firebase
        const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
        messaging = getMessaging(app);
        notificationConfig = { vapidKey: settings.firebasePublicVapidKey };

        return { messaging, vapidKey: notificationConfig.vapidKey };
    } catch (error) {
        console.error("Failed to init Firebase:", error);
        return null;
    }
};

export const requestNotificationPermission = async () => {
    try {
        const { messaging, vapidKey } = await initNotifications() || {};
        if (!messaging) return null;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, { vapidKey });
            console.log("Device Token:", token);
            // In a real app, you would send this token to your server
            return token;
        }
        return null;
    } catch (error) {
        console.error("Permission Error:", error);
        return null;
    }
};

export const saveTokenToServer = async (token) => {
    try {
        await api.post('/users/fcm-token', { token });
        console.log("Token saved to server");
    } catch (error) {
        console.error("Failed to save token to server:", error);
    }
};

export const onMessageListener = (callback) => {
    if (!messaging) return;
    return onMessage(messaging, (payload) => {
        callback(payload);
    });
};
