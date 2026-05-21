const GeminiLiveService = require('./services/GeminiLiveService');
const dotenv = require('dotenv');
dotenv.config();

async function testGemini() {
    const ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
    ai.on('ready', () => {
        console.log("WebSocket Ready! The setup message was accepted.");
        ai.disconnect();
    });
    ai.on('error', (err) => {
        console.error("WebSocket Error:", err);
    });
    ai.on('close', (code, reason) => {
        console.log("WebSocket Closed:", code, reason);
    });
    
    // Connect with camelCase vs snake_case
    console.log("Attempting connect...");
    ai.connect("Hello", "Puck", false, "models/gemini-2.0-flash-exp");
}

testGemini();
