const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');

async function cleanup() {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await Reminder.findOne({ title: "Pickup son" });
    if (r) {
        r.sharedWith = r.sharedWith.filter(s => s.user != null);
        await r.save();
        console.log("Cleaned up null users from 'Pickup son'");
    }
    process.exit(0);
}

cleanup();
