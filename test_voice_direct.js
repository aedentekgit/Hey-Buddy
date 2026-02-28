const WebSocket = require('ws');
require('dotenv').config({ path: './backend/.env' });

const apiKey = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log("Connecting to:", url.split('?')[0]);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log("✅ WebSocket Open");
    const setup = {
        setup: {
            model: "models/gemini-2.0-flash",
            generationConfig: {
                responseModalities: ["AUDIO"]
            }
        }
    };
    ws.send(JSON.stringify(setup));
});

ws.on('message', (data) => {
    const resp = JSON.parse(data.toString());
    console.log("📥 Message:", JSON.stringify(resp).substring(0, 100));

    if (resp.setupComplete || resp.setup_complete) {
        console.log("🆗 Setup Complete");
        const clientContent = {
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: "Say hello world" }]
                }],
                turnComplete: true
            }
        };
        ws.send(JSON.stringify(clientContent));
    }

    if (resp.serverContent?.modelTurn?.parts) {
        const parts = resp.serverContent.modelTurn.parts;
        parts.forEach(p => {
            if (p.inlineData) console.log("🔊 Received Audio Data!");
            if (p.text) console.log("💬 Received Text:", p.text);
        });
    }

    if (resp.serverContent?.turnComplete) {
        console.log("🏁 Turn Complete");
        ws.close();
    }
});

ws.on('error', (err) => console.error("❌ Error:", err));
ws.on('close', () => console.log("🛑 Closed"));

setTimeout(() => {
    console.log("Timeout");
    ws.close();
    process.exit(0);
}, 10000);
