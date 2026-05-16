const mongoose = require('mongoose');
const User = require('../models/User');
const Reminder = require('../models/Reminder');
require('dotenv').config({ path: './.env' });

async function createTestReminder() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@buddy.com' });

    // Schedule for 1 minute from now
    const now = new Date();
    // Use user's timezone if any
    const userTimezone = user.timezone || 'Asia/Kolkata'; // Assuming IST

    // Add 2 minutes to current time
    now.setMinutes(now.getMinutes() + 2);

    const tzDateStr = now.toLocaleDateString('en-CA', { timeZone: userTimezone }); // YYYY-MM-DD
    const tzTimeStr = now.toLocaleTimeString('en-US', { timeZone: userTimezone, hour: '2-digit', minute: '2-digit' }); // 01:53 AM

    const reminder = await Reminder.create({
        userId: user._id,
        title: "CRITICAL SYSTEM TEST REMINDER",
        date: tzDateStr,
        time: tzTimeStr,
        intent: "manual_creation",
        status: "pending",
        notified: false,
        alerts: { push: true, sms: false, email: false }
    });

    console.log(`Test Reminder Created: ${reminder.title} at ${tzDateStr} ${tzTimeStr}`);
    process.exit(0);
}

createTestReminder();
