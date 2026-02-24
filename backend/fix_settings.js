const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const dotenv = require('dotenv');

dotenv.config();

const seedSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_db');
        console.log('Connected to MongoDB to fix settings...');

        const existingSettings = await Settings.findOne();
        
        const defaultSettings = {
            general: {
                companyName: 'Buddy AI',
                address: 'Digital India',
                phone: '+91 99999 99999',
                emails: ['admin@buddy.com'],
                timeZone: 'Asia/Kolkata'
            },
            appearance: {
                themeMode: 'night',
                accentColor: '#0075ff'
            },
            isConfigured: true
        };

        if (!existingSettings) {
            const settings = new Settings(defaultSettings);
            await settings.save();
            console.log('Default settings created successfully');
        } else {
            // Update existing if fields are missing
            existingSettings.general.companyName = existingSettings.general.companyName || 'Buddy AI';
            existingSettings.general.address = existingSettings.general.address || 'Digital India';
            existingSettings.general.phone = existingSettings.general.phone || '+91 99999 99999';
            existingSettings.isConfigured = true;
            await existingSettings.save();
            console.log('Existing settings updated with missing required fields');
        }

        console.log('Settings fix complete!');
        process.exit();
    } catch (error) {
        console.error('Error fixing settings:', error.message);
        process.exit(1);
    }
};

seedSettings();
