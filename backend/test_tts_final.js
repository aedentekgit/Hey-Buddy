const ttsService = require('./services/ttsService');
require('dotenv').config({ path: './.env' });

async function test() {
    console.log("Starting TTS Test...");
    try {
        const result = await ttsService.generateAudio("Hello, this is a test of the updated voice model.");
        if (result.audio) {
            console.log("✅ Success! Audio length:", result.audio.length);
        } else {
            console.log("❌ Failed: No audio returned.");
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}
test();
