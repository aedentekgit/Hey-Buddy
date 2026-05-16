const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Settings = require('./models/Settings');

const syncGoogleSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const webClientId = process.env.GOOGLE_CLIENT_ID;
        if (!webClientId) {
            console.error('GOOGLE_CLIENT_ID not found in .env');
            process.exit(1);
        }

        const settings = await Settings.findOne();
        if (!settings) {
            console.error('Settings document not found in database');
            process.exit(1);
        }

        console.log('Old Client ID:', settings.googleAuth?.webClientId);
        console.log('Syncing New Client ID:', webClientId);

        if (!settings.googleAuth) settings.googleAuth = {};
        settings.googleAuth.webClientId = webClientId;
        settings.googleAuth.enabled = true; // Ensure it's enabled for testing

        await settings.save();
        console.log('✅ Google Settings synced successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

syncGoogleSettings();
