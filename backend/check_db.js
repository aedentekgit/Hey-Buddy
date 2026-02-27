const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ email: 'admin@buddy.com' });
        if (user) {
            console.log("Tokens for admin@buddy.com:", user.fcmTokens);
        } else {
            console.log("User not found.");
        }
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await mongoose.disconnect();
    }
}
test();
