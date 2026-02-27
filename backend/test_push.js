const mongoose = require('mongoose');
const { sendPushNotification } = require('./services/notificationService');

async function test() {
    try {
        await mongoose.connect('mongodb://localhost:27017/buddy');
        const token = "d-yNTwqiQpaZsCYQinI4To:APA91bGlm1-Nh9Affg7W1NSsSvMoFm4a7CaueCaWuwvRx3zXI6XjiKtBqYEAwz56_ug4DQVKjVZG7SE6Esy7uOoYox7PV6_baAxuHLL5x8VQ6tB-W4YC_Ak";
        const res = await sendPushNotification(token, "Buddy Reminder TEST", "This is a test notification in the background.", { type: "test" });
        console.log("Success:", res);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await mongoose.disconnect();
    }
}
test();
