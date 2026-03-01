const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });
const Reminder = require('../models/Reminder');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await Reminder.findOne({ title: 'CRITICAL SYSTEM TEST REMINDER' });
    console.log("Found Reminder:", r);
    process.exit(0);
}
test();
