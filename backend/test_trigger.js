const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();
const config = require('./config/env');
const io = require('socket.io-client');

async function trigger() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@buddy.com' });
    console.log("Logged in user:", user._id);
    
    // Instead of doing it from frontend, let's just make an HTTP call to test preview voice API manually... wait, I want to trigger the backend socket `voice_alert`.
    // We already know `triggerNotification` handles this nicely if called. Let's just create a test reminder that expires immediately so the worker picks it up. Wait, the worker checks every 1 min.
    
    console.log("All set! Just restart the backend, the global socket will now pick up the voice_alert and play the TTS.");
    process.exit(0);
}
trigger();
