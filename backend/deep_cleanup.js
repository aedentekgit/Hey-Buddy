const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');

async function deepCleanup() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    // Find all reminders with any null users in sharedWith
    const reminders = await Reminder.find({ "sharedWith.user": null });
    console.log(`Found ${reminders.length} reminders with ghost users.`);

    for (const r of reminders) {
        const originalCount = r.sharedWith.length;
        r.sharedWith = r.sharedWith.filter(s => s.user != null);
        await r.save();
        console.log(`Cleaned up "${r.title}": ${originalCount} -> ${r.sharedWith.length} users.`);
    }

    process.exit(0);
}

deepCleanup();
