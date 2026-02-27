const mongoose = require('mongoose');
const User = require('./models/User');
const Reminder = require('./models/Reminder');
const { initFirebase, sendPushNotification } = require('./services/notificationService');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await initFirebase();

        const user = await User.findOne({ email: "admin@buddy.com" });
        const reminder = await Reminder.findOne({ userId: user._id, title: "Pick up daughter from school" });

        console.log("Tokens to try:", user.fcmTokens);

        for (let i = 0; i < user.fcmTokens.length; i++) {
            const token = user.fcmTokens[i];
            console.log(`[TEST] Sending to token ${i}: ${token}`);
            try {
                const res = await sendPushNotification(token, `Reminder: ${reminder.title}`, reminder.title, { type: 'reminder_alert' });
                console.log(`[TEST] Token ${i} Success:`, res);
            } catch (err) {
                console.log(`[TEST] Token ${i} Failed:`, err.code || err.message);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
