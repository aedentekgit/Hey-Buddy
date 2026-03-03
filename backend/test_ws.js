const WebSocket = require('ws');
require('dotenv').config();
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log("Connected");
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-2.0-flash",
            generation_config: {
                response_modalities: ["AUDIO", "TEXT"],
                speech_config: {
                    voice_config: {
                        prebuilt_voice_config: {
                            voice_name: "Aoede"
                        }
                    }
                }
            }
        }
    }));
});
ws.on('message', data => console.log(data.toString()));
ws.on('close', (c, r) => console.log("Closed", c, r.toString()));
