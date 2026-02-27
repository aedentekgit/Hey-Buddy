const mongoose = require('mongoose');
const User = require('./models/User');
const { sendPushNotification } = require('./services/notificationService');
const admin = require('firebase-admin');
const path = require('path');

async function test() {
    try {
        await mongoose.connect('mongodb://localhost:27017/buddy');
        const user = await User.findOne({ "fcmTokens.0": { $exists: true } });
        if (!user) return console.log("No token.");
        const token = user.fcmTokens[0];
        console.log("Using Token:", token);
        
        // Data + Notification message
        const message = {
            notification: {
                title: "Voice Test",
                body: "This is a voice test from the background isolate"
            },
            data: {
                title: "Voice Test",
                body: "This is a voice test from the background isolate",
                type: "test"
            },
            token: token,
            android: {
                priority: 'high',
            }
        };
        const settings = require('./uploads/1770016713719-heybuddy-8abaf-firebase-adminsdk-fbsvc-c28d68812b.json');
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(settings) });
        
        const res = await admin.messaging().send(message);
        console.log("Success Data+Notification:", res);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
test();
