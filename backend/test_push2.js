const mongoose = require('mongoose');
const User = require('./models/User');
const { sendPushNotification } = require('./services/notificationService');

async function test() {
    try {
        await mongoose.connect('mongodb://localhost:27017/buddy');
        const user = await User.findOne({ "fcmTokens.0": { $exists: true } });
        if (!user) {
            console.log("No user with FMC token found.");
            return;
        }
        const token = user.fcmTokens[user.fcmTokens.length - 1]; // Get latest token
        console.log("Using Token:", token);
        const res = await sendPushNotification(token, "Buddy Reminder TEST", "This is a test notification in the background.", { type: "test" });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await mongoose.disconnect();
    }
}
test();
