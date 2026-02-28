const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: './.env' });

async function testFastTTS() {
    console.time("TTS_LATENCY");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-native-audio-latest" });

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Hi, I am Buddy, your assistant. How can I help you today?" }] }],
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

        const audioPart = result.response.candidates[0].content.parts.find(p => p.inlineData);
        if (audioPart) {
            console.log("✅ Audio received! length:", audioPart.inlineData.data.length);
        } else {
            console.log("❌ No audio in response.");
            console.log("Response:", JSON.stringify(result.response, null, 2));
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
    console.timeEnd("TTS_LATENCY");
}

testFastTTS();
