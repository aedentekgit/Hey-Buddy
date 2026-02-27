const admin = require('firebase-admin');
const path = require('path');

async function test() {
    try {
        const serviceAccount = require('./uploads/1770016713719-heybuddy-8abaf-firebase-adminsdk-fbsvc-c28d68812b.json');
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        const token = "d-yNTwqiQpaZsCYQinI4To:APA91bGlm1-Nh9Affg7W1NSsSvMoFm4a7CaueCaWuwvRx3zXI6XjiKtBqYEAwz56_ug4DQVKjVZG7SE6Esy7uOoYox7PV6_baAxuHLL5x8VQ6tB-W4YC_Ak";
        
        const message = {
            notification: {
                title: "Buddy Voice Test",
                body: "This is a background voice reminder test."
            },
            data: {
                body: "This is a background voice reminder test.",
                type: "reminder_alert"
            },
            token: token,
            android: {
                priority: 'high',
            }
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
        process.exit(0);
    } catch (error) {
        console.error('Error sending message:', error);
        process.exit(1);
    }
}

test();
