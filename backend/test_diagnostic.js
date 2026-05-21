const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the backend .env file
dotenv.config();

const Settings = require('./models/Settings');
const GeminiLiveService = require('./services/geminiLiveService');

async function runDiagnostics() {
    try {
        console.log("Connecting to MongoDB using:", process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected successfully.");

        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        if (!settings) {
            console.error("No settings found in the database!");
            return;
        }

        console.log("--- DB Settings ---");
        console.log("Active Model:", settings.ai?.activeModel);
        console.log("Active Voice Model:", settings.ai?.activeVoiceModel);
        console.log("Gemini API Key exists:", !!settings.ai?.geminiApiKey);
        if (settings.ai?.geminiApiKey) {
            console.log("Gemini API Key prefix:", settings.ai.geminiApiKey.substring(0, 8) + "...");
        }

        const apiKey = settings.ai?.geminiApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("No Gemini API key available!");
            return;
        }

        let activeVoiceStr = settings.ai?.activeVoiceModel || 'gemini-2.0-flash';
        if (activeVoiceStr.includes('2.5')) activeVoiceStr = 'gemini-2.0-flash';
        const voiceModelName = activeVoiceStr.includes('/') ? activeVoiceStr.split('/')[1] : activeVoiceStr;
        const modelPath = `models/${voiceModelName}`;

        console.log(`\nTesting Gemini Live WebSocket with model: ${modelPath}...`);
        const ai = new GeminiLiveService(apiKey);
        
        ai.on('ready', () => {
            console.log("✅ WebSocket connection successful! Setup accepted.");
            ai.disconnect();
            process.exit(0);
        });

        ai.on('error', (err) => {
            console.error("❌ WebSocket Error:", err);
            ai.disconnect();
            process.exit(1);
        });

        ai.on('close', (code, reason) => {
            console.log(`🛑 WebSocket Closed: ${code} - ${reason}`);
            process.exit(1);
        });

        ai.connect("Hello", "Puck", false, modelPath);

        // Set a timeout
        setTimeout(() => {
            console.error("⏳ Connection timed out after 10 seconds.");
            ai.disconnect();
            process.exit(1);
        }, 10000);

    } catch (err) {
        console.error("Diagnostics error:", err);
        process.exit(1);
    }
}

runDiagnostics();
