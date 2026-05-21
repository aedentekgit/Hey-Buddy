const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const Settings = require('../../models/Settings');
const User = require('../../models/User');

async function run() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected successfully.");

        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        console.log("\n=== System Settings ===");
        if (settings) {
            console.log("Found settings ID:", settings._id);
            console.log("AI Config:", JSON.stringify(settings.ai, null, 2));
        } else {
            console.log("No Settings document found!");
        }

        const users = await User.find().limit(5);
        console.log("\n=== Users Sample ===");
        users.forEach(u => {
            console.log(`- User: ${u.email || u.name || u._id} | VoicePrefs:`, JSON.stringify(u.voicePreferences));
        });

        process.exit(0);
    } catch (e) {
        console.error("Error running diagnosis:", e);
        process.exit(1);
    }
}

run();
