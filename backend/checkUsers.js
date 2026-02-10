const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_db');
        const users = await User.find({});
        console.log('Total users:', users.length);
        users.forEach(u => {
            console.log(`- ${u.email}: ${u.role}`);
        });
        process.exit();
    } catch (error) {
        console.error('Error checking users:', error.message);
        process.exit(1);
    }
};

checkUsers();
