const WebSocket = require('ws');
require('dotenv').config();

const model = 'models/gemini-2.5-flash-native-audio-latest';
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
const ws = new WebSocket(url);

ws.on('open', () => {
    ws.send(JSON.stringify({
        setup: {
            model: model,
            generation_config: { response_modalities: ["AUDIO"] },
            system_instruction: { parts: [{ text: "Read this naturally." }] }
        }
    }));
});
ws.on('message', (d) => {
    const data = JSON.parse(d.toString());
    if (data.setupComplete) {
        console.log("Setup complete, sending text request...");
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{ role: "user", parts: [{ text: "Hello, I am testing the audio generation!" }] }],
                turnComplete: true
            }
        }));
    } else if (data.serverContent) {
        console.log("Received server content:", JSON.stringify(data.serverContent).substring(0, 100));
    } else {
        console.log("Other message:", JSON.stringify(data).substring(0, 100));
    }
});
ws.on('close', (code, r) => console.log('Closed:', code, r.toString()));
ws.on('error', e => console.error(e));
setTimeout(() => ws.close(), 10000);
