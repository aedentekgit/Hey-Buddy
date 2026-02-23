const mongoose = require('mongoose');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const updatePic = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://82.29.167.22:27017/staging_Heybuddy');

        // Use an existing file found in uploads/profiles
        const existingPic = "/uploads/profiles/698f125f80bad2202177f08c-1771280093314.jpg";

        const result = await User.updateOne(
            { email: "admin@buddy.com" },
            { $set: { profilePicture: existingPic } }
        );

        console.log('Update result:', result);
        process.exit();
    } catch (error) {
        console.error('Error updating pic:', error.message);
        process.exit(1);
    }
};

updatePic();
