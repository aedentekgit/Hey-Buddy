const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');
const User = require('./models/User');

async function debugPopulation() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const userId = "6970970931bae19816f8e636"; // Sabarish

    const reminders = await Reminder.find({
        $or: [
            { userId: userId },
            { 'sharedWith.user': userId }
        ]
    })
        .populate('userId', 'name email profilePicture')
        .populate('sharedWith.user', 'name email profilePicture')
        .limit(5);

    reminders.forEach(r => {
        console.log(`Reminder: ${r.title}`);
        console.log(`Creator: ${JSON.stringify(r.userId)}`);
        r.sharedWith.forEach((s, i) => {
            console.log(`  Shared[${i}].user: ${JSON.stringify(s.user)}`);
        });
    });

    process.exit(0);
}

debugPopulation();
