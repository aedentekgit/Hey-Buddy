const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const Reminder = require('./models/Reminder');

async function run() {
  try {
    await mongoose.connect('mongodb://buddy_admin:HeyBuddySecure123!@82.29.167.22:27017/staging_Heybuddy?authSource=admin');
    console.log('Connected');
    
    const settings = await Settings.findOne();
    console.log('--- SETTINGS ---');
    console.log(JSON.stringify(settings?.googleMaps, null, 2));
    
    const reminders = await Reminder.find({ title: /Pick up daughter/i }).sort({ createdAt: -1 }).limit(1);
    console.log('--- LATEST REMINDER ---');
    console.log(JSON.stringify(reminders[0], null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
