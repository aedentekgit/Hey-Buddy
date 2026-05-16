const mongoose = require('mongoose');
const Settings = require('./backend/models/Settings');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, 'backend/.env') });

const checkSettings = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) throw new Error('MONGODB_URI is required.');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const settings = await Settings.findOne();
        if (!settings) {
            console.log('No settings found');
        } else {
            console.log('--- Google Maps Settings ---');
            console.log('Enabled:', settings.googleMaps?.enabled);
            console.log('API Key:', settings.googleMaps?.apiKey ? settings.googleMaps.apiKey.substring(0, 10) + '...' : 'MISSING');
            console.log('---------------------------');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkSettings();
