const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');
const User = require('./models/User');

async function testPermission() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const latest = await Reminder.findOne().sort({ updatedAt: -1 });
    if (!latest) {
        console.log("No reminders.");
        process.exit(0);
    }

    const owner = await User.findById(latest.userId);
    console.log(`Reminder: ${latest.title}`);
    console.log(`Stored userId: "${latest.userId}" (type: ${typeof latest.userId})`);

    // Simulate what's in req.user._id
    const simulatedUserId = latest.userId;
    console.log(`Simulated req.user._id: "${simulatedUserId}" (type: ${typeof simulatedUserId})`);

    const isOwner = latest.userId.toString() === simulatedUserId.toString();
    console.log(`isOwner check (r.userId.toString() === userId.toString()): ${isOwner}`);

    // Check if it's a Mongoose ObjectId or String
    console.log(`Is latest.userId an instance of mongoose.Types.ObjectId? ${latest.userId instanceof mongoose.Types.ObjectId}`);

    process.exit(0);
}

testPermission();
