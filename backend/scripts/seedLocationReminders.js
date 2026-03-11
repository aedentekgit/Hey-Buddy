const mongoose = require('mongoose');
const LocationReminder = require('../models/LocationReminder');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const seedData = [
    {
        title: "Pickup Medicine at Apollo",
        location: "Apollo Pharmacy, Madurai Main Road",
        date: "2026-03-10",
        time: "06:30 PM",
        status: "risk_alert",
        warningLevel: "high",
        bufferTime: 20,
        description: "Need to pick up the monthly prescription for Father."
    },
    {
        title: "Evening Walk at Eco Park",
        location: "MGR Eco Park, Madurai",
        date: "2026-03-10",
        time: "05:00 PM",
        status: "on_track",
        warningLevel: "low",
        bufferTime: 10,
        description: "Daily exercise routine."
    },
    {
        title: "Grocery Shopping",
        location: "Reliance Smart, Anna Nagar",
        date: "2026-03-11",
        time: "11:00 AM",
        status: "on_track",
        warningLevel: "medium",
        bufferTime: 15,
        description: "Buy fruits, milk, and bread."
    },
    {
        title: "Visit Temple",
        location: "Meenakshi Amman Temple, Madurai",
        date: "2026-03-12",
        time: "07:00 AM",
        status: "on_track",
        warningLevel: "medium",
        bufferTime: 30,
        description: "Early morning prayer."
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        // Find the first user to assign these to
        const user = await mongoose.connection.db.collection('users').findOne({});
        if (!user) {
            console.error('No users found in database. Please create a user first.');
            process.exit(1);
        }

        console.log(`Seeding reminders for user: ${user.email || user._id}`);

        // Clear existing location reminders for this user to avoid duplicates if re-run
        // await LocationReminder.deleteMany({ userId: user._id });

        const remindersWithUser = seedData.map(r => ({
            ...r,
            userId: user._id
        }));

        await LocationReminder.insertMany(remindersWithUser);
        console.log('Successfully seeded 4 location reminders!');

    } catch (error) {
        console.error('Seeding error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

seed();
