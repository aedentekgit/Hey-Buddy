const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: './.env' });

async function testAudio() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-native-audio-latest" });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Hello! Say hello clearly." }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Aoede"
                        }
                    }
                }
            }
        });

        const response = result.response;
        const parts = response.candidates[0].content.parts;
        const audioPart = parts.find(p => p.inlineData);

        if (audioPart) {
            console.log("✅ Success! Received audio data length:", audioPart.inlineData.data.length);
        } else {
            console.log("❌ No audio data in response.");
            console.log("Response parts:", JSON.stringify(parts, null, 2));
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
}
testAudio();
