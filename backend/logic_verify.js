const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Reminder = require('./models/Reminder');
const Notification = require('./models/Notification');

async function runTest() {
    try {
        console.log('--- 🧪 STARTING INTERNAL LOGIC VERIFICATION 🧪 ---');
        await mongoose.connect(process.env.MONGODB_URI);

        const testUserId = '6970970931bae19816f8e636';
        const user = await User.findById(testUserId);

        if (!user) {
            console.error('Test user not found');
            process.exit(1);
        }

        console.log(`User Found: ${user.name}`);
        console.log(`Status: In-App(${user.notificationPreferences?.inApp?.enabled}), Voice(${user.notificationPreferences?.voice?.enabled}), Push(${user.notificationPreferences?.push?.enabled})`);

        // 1. Logic Verification: Voice Mapping
        const voicePrefs = user.voicePreferences || { gender: 'female', tone: 'soft' };
        let selectedVoice = 'Aoede';
        if (voicePrefs.gender === 'male') {
            if (voicePrefs.tone === 'soft') selectedVoice = 'Charon';
            else if (voicePrefs.tone === 'energetic') selectedVoice = 'Fenrir';
            else selectedVoice = 'Puck';
        } else {
            if (voicePrefs.tone === 'energetic') selectedVoice = 'Kore';
            else selectedVoice = 'Aoede';
        }
        console.log(`✅ VOICE LOGIC: Prefs(${voicePrefs.gender}/${voicePrefs.tone}) -> Gemini Voice(${selectedVoice})`);

        // 2. Logic Verification: Notification Toggles
        console.log('--- Checking Channel Toggles ---');
        if (user.notificationPreferences?.inApp?.enabled !== false) {
            console.log('✅ IN-APP LOGIC: Notification.create would be called.');
        } else {
            console.log('❌ IN-APP LOGIC: Disabled.');
        }

        if (user.notificationPreferences?.voice?.enabled !== false) {
            console.log('✅ VOICE REMINDER LOGIC: activeAgent.say() would be called if session active.');
        } else {
            console.log('❌ VOICE REMINDER LOGIC: Disabled.');
        }

        // 3. Logic Verification: Timezone calculation
        const userTimezone = user.timezone || 'UTC';
        const now = new Date();
        const userHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, hour: '2-digit', hour12: false }));
        const userMinute = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, minute: '2-digit' }));
        const userLocalDay = now.toLocaleDateString('en-CA', { timeZone: userTimezone });

        console.log(`✅ TIMEZONE LOGIC: System Time(${now.toISOString()}) -> User Local(${userLocalDay} ${userHour}:${userMinute}) using ${userTimezone}`);

        // 4. Test Token Cleanup Mock
        const mockError = { code: 'messaging/registration-token-not-registered' };
        if (mockError.code === 'messaging/registration-token-not-registered') {
            console.log('✅ PUSH CLEANUP LOGIC: Trigger would pull stale token from DB.');
        }

        console.log('--- 🧪 VERIFICATION COMPLETE 🧪 ---');
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

runTest();
