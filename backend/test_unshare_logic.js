const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');
const User = require('./models/User');

async function testUnshare() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const adminId = "6970970931bae19816f8e636"; // Sabarish
    const otherId = "69a586b3f14dbce4a4db413b"; // usertest

    // Create a reminder to test unshare
    const reminder = await Reminder.create({
        userId: adminId,
        title: "UNSHARE TEST",
        sharedWith: [{ user: otherId, permissions: 'view' }]
    });

    console.log("Created reminder with shared user:", otherId);

    // Try to filter out the user
    reminder.sharedWith = reminder.sharedWith.filter(s => s.user.toString() !== otherId);
    await reminder.save();

    const updated = await Reminder.findById(reminder._id);
    if (updated.sharedWith.length === 0) {
        console.log("✅ SUCCESS: filter() worked on String-based IDs.");
    } else {
        console.log("❌ FAIL: filter() failed. Current sharedWith:", updated.sharedWith);
    }

    await Reminder.deleteOne({ _id: reminder._id });
    process.exit(0);
}

testUnshare();
