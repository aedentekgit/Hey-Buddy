const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User'); // MUST REGISTER USER SCHEMA FIRST
const Reminder = require('./models/Reminder');

async function checkLatest() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const latest = await Reminder.findOne().sort({ updatedAt: -1 })
        .populate('userId', 'name email profilePicture')
        .populate('sharedWith.user', 'name email profilePicture');

    if (latest) {
        console.log(`Latest Reminder: ${latest.title} (${latest._id})`);
        console.log(`Creator: ${latest.userId ? latest.userId.name : 'NULL'}`);
        console.log("Shared With Count:", latest.sharedWith.length);
        latest.sharedWith.forEach((s, i) => {
            console.log(`  [${i}] User Obj: ${JSON.stringify(s.user)}`);
        });
        console.log("Raw sharedWith JSON in DB:", JSON.stringify(latest.sharedWith));
    } else {
        console.log("No reminders found.");
    }
    process.exit(0);
}

checkLatest();
