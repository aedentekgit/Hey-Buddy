const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const ttsService = require('./services/ttsService');

async function testTTS() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    console.log("Generating audio for Fenrir...");
    const result1 = await ttsService.generateAudio("Hello, I am Fenrir.", "male", "normal", "en-US", "Fenrir");
    
    console.log("Generating audio for Aoede...");
    const result2 = await ttsService.generateAudio("Hello, I am Aoede.", "female", "normal", "en-US", "Aoede");

    if (!result1 || !result2) {
        console.log("Failed to generate audio.");
        process.exit(1);
    }

    const len1 = result1.audio.length;
    const len2 = result2.audio.length;
    console.log(`Fenrir Length: ${len1}, VoiceName: ${result1.voiceName}`);
    console.log(`Aoede Length: ${len2}, VoiceName: ${result2.voiceName}`);

    if (result1.audio === result2.audio) {
        console.log("❌ Audio output is EXACTLY the same for both voices.");
    } else {
        console.log("✅ Audio output is DIFFERENT.");
    }
    
    process.exit(0);
}

testTTS().catch(console.error);
