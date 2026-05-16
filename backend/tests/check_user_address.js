const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const checkUsers = async () => {
    try {
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
        await mongoose.connect(process.env.MONGODB_URI);
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
