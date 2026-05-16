const admin = require('firebase-admin');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const testInit = async () => {
    try {
        console.log("Connecting to:", process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        const Settings = require('./models/Settings');
        const settings = await Settings.findOne();

        if (!settings || !settings.notification || !settings.notification.serviceAccountJson) {
            throw new Error("Service account path missing in DB");
        }

        console.log("Path in DB:", settings.notification.serviceAccountJson);
        const jsonPath = path.join(__dirname, settings.notification.serviceAccountJson);
        console.log("Full Path:", jsonPath);

        const serviceAccount = require(jsonPath);
        console.log("Successfully required JSON. Project ID:", serviceAccount.project_id);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("Firebase Admin Initialized Successfully!");
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

testInit();
