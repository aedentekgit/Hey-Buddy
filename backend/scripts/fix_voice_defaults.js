const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function fixUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const userId = '6970970931bae19816f8e636';
        const user = await User.findById(userId);

        if (user) {
            console.log('Current user prefs:', user.voicePreferences);
            user.voicePreferences = {
                gender: 'male',
                tone: 'normal'
            };
            await user.save();
            console.log('Updated user prefs to male/normal');
        } else {
            console.log('User not found');
        }

        // Also update all users to be sure
        const result = await User.updateMany(
            {},
            { $set: { "voicePreferences.gender": "male", "voicePreferences.tone": "normal" } }
        );
        console.log(`Updated all ${result.modifiedCount} users to male/normal`);

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

fixUser();
