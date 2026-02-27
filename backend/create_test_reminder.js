const mongoose = require('mongoose');
const Reminder = require('./models/Reminder');
require('dotenv').config();

async function create() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const userId = "6970970931bae19816f8e636";

        await Reminder.deleteMany({ userId, title: "Pick up daughter from school" });

        const now = new Date();
        const triggerTime = new Date(now.getTime() + 65000); // 1 minute 5 seconds from now

        const hours = triggerTime.getHours().toString().padStart(2, '0');
        const minutes = triggerTime.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        const dateStr = triggerTime.toISOString().split('T')[0];

        const reminder = await Reminder.create({
            userId,
            title: "Pick up daughter from school",
            time: timeStr,
            date: dateStr,
            intent: 'pickup',
            priority: 'high',
            status: 'pending',
            alerts: {
                push: true,
                sms: false,
                email: false
            }
        });

        console.log("Final-Final Test Reminder Created:", reminder.title, "at", timeStr);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
create();
