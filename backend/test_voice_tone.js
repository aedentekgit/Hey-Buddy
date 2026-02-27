const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testPrefs() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@buddy.com' });
    if (!user) {
        console.log("User not found!");
        process.exit(1);
    }
    console.log("Current Prefs:", user.notificationPreferences?.voice, user.voicePreferences);

    // Change Preferences
    user.voicePreferences = { gender: 'male', tone: 'energetic' };
    await user.save();

    console.log("Updated Voice Prefs to Male, Energetic.");
    process.exit(0);
}
testPrefs();
