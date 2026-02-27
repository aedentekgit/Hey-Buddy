const admin = require('firebase-admin');

async function test() {
    try {
        const settings = require('./uploads/1770016713719-heybuddy-8abaf-firebase-adminsdk-fbsvc-c28d68812b.json');
        if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(settings) });
        
        // Use standard FCM Token format
        const token = "d-yNTwqiQpaZsCYQinI4To:APA91bGlm1-Nh9Affg7W1NSsSvMoFm4a7CaueCaWuwvRx3zXI6XjiKtBqYEAwz56_ug4DQVKjVZG7SE6Esy7uOoYox7PV6_baAxuHLL5x8VQ6tB-W4YC_Ak";
        
        const message = {
            notification: {
                title: "Voice Test Notification",
                body: "Testing exactly the voice."
            },
            data: {
                body: "Testing exactly the voice.",
                type: "test"
            },
            token: token,
            android: {
                priority: 'high',
            }
        };
        
        const res = await admin.messaging().send(message);
        console.log("Success:", res);
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}
test();
