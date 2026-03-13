const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');
const User = require('./models/User');

async function findShared() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Find any reminder with shared users
    const r = await Reminder.findOne({ "sharedWith.0": { $exists: true } })
        .populate('sharedWith.user', 'name email profilePicture');

    if (r) {
        console.log(`Found Shared Reminder: ${r.title}`);
        r.sharedWith.forEach((s, i) => {
            console.log(`  User ${i}: ${JSON.stringify(s.user)}`);
        });
    } else {
        console.log("No shared reminders found in DB.");
    }
    process.exit(0);
}

findShared();
