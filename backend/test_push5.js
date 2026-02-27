const mongoose = require('mongoose');
const User = require('./models/User');
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
                title: "Buddy AI",
                body: "This is a voice test reminder"
            },
            data: {
                body: "This is a voice test reminder",
                type: "reminder_alert"
            },
            token: token,
            android: {
                priority: 'high',
            }
        };
        const settings = require('./uploads/1770016713719-heybuddy-8abaf-firebase-adminsdk-fbsvc-c28d68812b.json');
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(settings) });
        
        const res = await admin.messaging().send(message);
        console.log("Success:", res);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
test();
