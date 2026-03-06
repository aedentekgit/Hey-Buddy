const mongoose = require('mongoose');
const Settings = require('../models/Settings');
require('dotenv').config();

const updateMobileVersion = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const updateData = {
            'mobileApp.latestAppVersion': '1.0.5',
            'mobileApp.mandatoryUpdate': true,
            'mobileApp.updateUrl': 'http://82.29.167.22:5001/uploads/BUDDY-MOBILE-LATEST.apk'
        };

        const settings = await Settings.findOneAndUpdate(
            {},
            { $set: updateData },
            { new: true, upsert: true }
        );

        console.log('Successfully updated mobile app settings to version 1.0.5');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error updating settings:', error);
        process.exit(1);
    }
};

updateMobileVersion();
