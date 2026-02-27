const { sendPushNotification } = require('./services/notificationService');
const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const token = "d-yNTwqiQpaZsCYQinI4To:APA91bGlm1-Nh9Affg7W1NSsSvMoFm4a7CaueCaWuwvRx3zXI6XjiKtBqYEAwz56_ug4DQVKjVZG7SE6Esy7uOoYox7PV6_baAxuHLL5x8VQ6tB-W4YC_Ak";
        console.log("Sending to Token:", token);
        const res = await sendPushNotification(token, "Buddy Final Test", "This is the final voice reminder test. It should speak clearly.");
        console.log("Result:", res);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
test();
