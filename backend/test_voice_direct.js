const WebSocket = require('ws');
require('dotenv').config({ path: './.env' });

const apiKey = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log("✅ WebSocket Open");
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-2.5-flash-native-audio-latest",
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
        }
    }));
});

ws.on('message', (data) => {
    const resp = JSON.parse(data.toString());
    console.log("📥 Message:", JSON.stringify(resp));
    if (resp.setupComplete || resp.setup_complete) {
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{ role: "user", parts: [{ text: "Hello" }] }],
                turnComplete: true
            }
        }));
    }
    if (resp.serverContent?.modelTurn?.parts?.some(p => p.inlineData)) {
        console.log("🔊 SUCCESS! RECEIVED AUDIO DATA.");
        ws.close();
    }
});

ws.on('error', (err) => console.error("❌ WebSocket Error:", err));
ws.on('close', (code, reason) => console.log(`🛑 Closed: ${code} - ${reason}`));
