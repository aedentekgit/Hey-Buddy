const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load models
const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function diagnose() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI.split('@')[1]); // Log host only for safety
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- DB Diagnosis ---');

        const adminUser = await User.findOne({ email: 'admin@buddy.com' });
        if (!adminUser) {
            console.log('ERROR: Active Admin user not found!');
            process.exit(1);
        }
        console.log('Current Admin ID:', adminUser._id);

        const totalReminders = await Reminder.countDocuments({});
        const adminReminders = await Reminder.countDocuments({ userId: adminUser._id });
        const orphanedReminders = await Reminder.countDocuments({ userId: { $ne: adminUser._id } });

        console.log('Total Reminders in DB:', totalReminders);
        console.log('Reminders owned by current Admin:', adminReminders);
        console.log('Orphaned Reminders (Different owners):', orphanedReminders);

        if (orphanedReminders > 0 && adminReminders === 0) {
            console.log('\nACTION REQUIRED: There is data, but it belongs to old IDs.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Diagnosis Failed:', err.message);
        process.exit(1);
    }
}

diagnose();
