const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');

async function inspectReminder() {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await Reminder.findOne({ title: "Pickup son" });
    if (r) {
        console.log("Raw sharedWith:", JSON.stringify(r.sharedWith));
    }
    process.exit(0);
}

inspectReminder();
