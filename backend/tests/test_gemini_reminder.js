require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const { generateResponse } = require('./services/geminiService');
const contextService = require('./services/contextService');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);

    // Create a dummy user context
    const mockUserId = new mongoose.Types.ObjectId().toHexString();

    const text = "Remind me to take my medicine at 9pm";

    console.log("Processing text:", text);
    const result = await generateResponse(text, mockUserId, {
        userContext: {
            localDate: "2026-02-24",
            timeZone: "Asia/Kolkata",
            voicePreferences: { tone: "soft", gender: "female" }
        },
        memories: [],
        reminders: []
    });

    console.log("Response:", result);
    process.exit(0);
}
run();
