const admin = require('firebase-admin');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const sendTest = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Settings = require('./models/Settings');
        const settings = await Settings.findOne();

        const relativePath = settings.notification.serviceAccountJson.startsWith('/')
            ? settings.notification.serviceAccountJson.substring(1)
            : settings.notification.serviceAccountJson;

        const jsonPath = path.join(__dirname, relativePath);
        const serviceAccount = require(jsonPath);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        // Current token from staging DB for 'aedentek@gmail.com'
        const token = "fH-UFxVGujMINNRblc9h_e:APA91bGgFEvcfXwH5Ncn65877tsDiLa_kaY2hxgCEiSgxcptV-iDoawf4n577QHC1FkhtA5MZ9Bp9eNULQ0-ghfpuZN___67-BH_Np-uJ7Q4FQpnax_hXTQ";

        const message = {
            notification: {
                title: 'Hey Buddy! 🚀',
                body: 'Notification system is now 100% active and running! 🎉'
            },
            data: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                type: 'test'
            },
            token: token
        };

        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
        process.exit(0);
    } catch (e) {
        console.error("Failed to send notification:", e);
        process.exit(1);
    }
}

sendTest();
