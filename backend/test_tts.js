require('dotenv').config();
const ttsService = require('./services/ttsService');

(async () => {
    try {
        console.log("Generating audio for Female Soft...");
        const result1 = await ttsService.generateAudio("Hello, I am soft female voice.", "female", "soft");
        console.log(result1 ? `Success! Size: ${result1.audio.length}, Voice: ${result1.voiceName}` : "Failed.");

        console.log("Generating audio for Male Energetic...");
        const result2 = await ttsService.generateAudio("Hello, I am energetic male voice!", "male", "energetic");
        console.log(result2 ? `Success! Size: ${result2.audio.length}, Voice: ${result2.voiceName}` : "Failed.");
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
})();
