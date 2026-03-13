const mongoose = require('mongoose');
require('dotenv').config();

const Reminder = require('./models/Reminder');
const User = require('./models/User');

async function simulateUpdate() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const latest = await Reminder.findOne({ title: "FINAL TEST: Collaborative Task" });
    if (!latest) {
        console.log("Reminder not found.");
        process.exit(1);
    }

    const targetUser = await User.findOne({ email: "sabarishthavamani@gmail.com" });
    if (!targetUser) {
        console.log("Target user not found.");
        process.exit(1);
    }

    console.log(`Starting update for reminder ${latest._id}`);
    console.log(`Adding user ${targetUser._id} (${targetUser.name})`);

    // Simulate the controller logic
    const updateData = {
        sharedWith: [{ user: targetUser._id, permissions: 'view' }]
    };

    const oldSharedWithIds = (latest.sharedWith || [])
        .map(s => s.user ? s.user.toString() : null)
        .filter(Boolean);

    // Sanitize
    updateData.sharedWith = updateData.sharedWith.filter(s => {
        const uid = s.user && typeof s.user === 'object' ? s.user._id : s.user;
        return uid && uid !== 'null' && uid !== 'undefined';
    });

    latest.sharedWith = updateData.sharedWith;
    const updated = await latest.save();
    console.log(`Saved. Shared count: ${updated.sharedWith.length}`);

    const newSharedWithIds = updated.sharedWith
        .map(s => s.user ? s.user.toString() : null)
        .filter(Boolean);

    const newlyAdded = newSharedWithIds.filter(id => !oldSharedWithIds.includes(id));
    console.log(`Newly Added: ${newlyAdded.length}`);

    process.exit(0);
}

simulateUpdate();
