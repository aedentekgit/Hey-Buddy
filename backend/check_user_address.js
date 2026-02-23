const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const checkUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://82.29.167.22:27017/staging_Heybuddy');
        const users = await User.find({});
        users.forEach(u => {
            console.log('---');
            console.log('Email:', u.email);
            console.log('Address:', u.address);
            console.log('CurrentLocation:', u.currentLocation);
        });
        process.exit();
    } catch (error) {
        console.error('Error checking users:', error.message);
        process.exit(1);
    }
};

checkUsers();
