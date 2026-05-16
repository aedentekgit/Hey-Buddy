const mongoose = require('mongoose');
const User = require('./models/User');
const Reminder = require('./models/Reminder');
const { initFirebase } = require('./services/notificationService');
const { triggerNotification } = require('./services/reminderWorker');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await initFirebase();

        const user = await User.findOne({ _id: "6970970931bae19816f8e636" });
        const reminder = await Reminder.findOne({ userId: user._id, title: "Pick up daughter from school" });

        if (!user || !reminder) {
            console.log("Missing user or reminder.");
            process.exit(1);
        }

        console.log("Found User:", user.email);
        console.log("Found Reminder:", reminder.title);

        // Mock IO
        const mockIo = {
            to: (room) => ({
                emit: (event, data) => {
                    console.log(`[Mock IO] Emitted to room ${room}: event ${event}`, data);
                }
            })
        };

        await triggerNotification(reminder, user, mockIo);

        console.log("Trigger Notification finished successfully.");
        process.exit(0);
    } catch (e) {
        console.error("DEBUG ERROR:", e);
        process.exit(1);
    }
}
test();
