require('dotenv').config();
const ttsService = require('./services/ttsService');

async function testTTS() {
    console.log('Testing long TTS Service...');
    try {
        const result = await ttsService.generateAudio('How are you doing today? Just testing latency.', 'female', 'soft', 'en-US');
        console.log('Success:', !!result.audio);
    } catch (e) {
        console.error('Error in TTS:', e);
    }
}
testTTS();
