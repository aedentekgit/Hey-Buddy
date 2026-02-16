const mongoose = require('mongoose');
const User = require('./models/User');
const Reminder = require('./models/Reminder');
const dotenv = require('dotenv');

dotenv.config();

const testSave = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://82.29.167.22:27017/staging_Heybuddy');
        console.log('Connected to MongoDB');

        // Find a user
        const user = await User.findOne();
        if (!user) {
            console.error('No user found');
            process.exit(1);
        }
        console.log('Using User:', user._id);

        const reminderData = {
            title: "Test Manual Save 1",
            intent: "manual_creation",
            condition: undefined, // Simulating undefined from frontend
            priority: undefined,
            bufferTime: undefined
        };

        // Logic from controller
        const validConditions = ['distance_check', 'time_only', 'none'];
        let sanitizedCondition = reminderData.condition;
        if (!validConditions.includes(sanitizedCondition)) {
            sanitizedCondition = 'none';
        }

        console.log("Creating reminder with:", {
            userId: user._id,
            title: reminderData.title,
            condition: sanitizedCondition
        });

        const savedReminder = await Reminder.create({
            userId: user._id,
            title: reminderData.title,
            intent: reminderData.intent || 'generic',
            time: reminderData.time || null,
            date: reminderData.date || null,
            location: reminderData.location || null,
            condition: sanitizedCondition,
            priority: reminderData.priority || 'medium',
            bufferTime: reminderData.bufferTime || 15,
            geofenceRadius: reminderData.geofenceRadius || 500,
            repeat: reminderData.repeat || false,
            googleEventId: null
        });

        console.log("SUCCESS! Saved Reminder:", savedReminder);

    } catch (error) {
        console.error("FAILED:", error);
    } finally {
        await mongoose.disconnect();
    }
};

testSave();
