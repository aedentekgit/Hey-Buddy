const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkSettings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const SettingsSchema = new mongoose.Schema({
            general: Object
        }, { strict: false });

        const Settings = mongoose.model('Settings', SettingsSchema, 'settings');
        const settings = await Settings.findOne();

        console.log('--- Settings General ---');
        console.log(JSON.stringify(settings?.general, null, 2));

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkSettings();
