const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * OpenAIRealtimeService: Manages the low-level WebSocket connection to OpenAI.
 */
class OpenAIRealtimeService extends EventEmitter {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
    }

    connect(instructions = null, voice = 'alloy', useTools = true, model = 'gpt-4o-realtime-preview') {
        const url = `wss://api.openai.com/v1/realtime?model=${model}`;
        console.log(`[OpenAI Service] 🤖 Dynamic Initialization: ${model} (Voice: ${voice})...`);
        this.instructionsOverride = instructions;
        this.voiceOverride = voice;

        this.ws = new WebSocket(url, {
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "OpenAI-Beta": "realtime=v1",
            },
        });

        this.ws.on('open', () => {
            console.log('[OpenAI Service] ✅ Connected to Realtime API');
            this.isConnected = true;
            this.sendSessionUpdate();

            // Initial Greeting
            this.send({
                type: "response.create",
                response: {
                    instructions: "You are Buddy. Greet the user with: 'Hey there! Buddy here. How can I help you today?'",
                }
            });

            this.emit('ready');
        });

        this.ws.on('message', (data) => {
            try {
                const event = JSON.parse(data);
                this.handleEvent(event);
            } catch (err) {
                console.error('[OpenAI Service] ❌ Error parsing message:', err);
            }
        });

        this.ws.on('error', (err) => {
            console.error('[OpenAI Service] ❌ WebSocket Error:', err);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`[OpenAI Service] 🛑 Connection closed: ${code} - ${reason}`);
            this.isConnected = false;
        });
    }

    sendSessionUpdate() {
        const event = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: this.instructionsOverride || "You are 'Buddy', a helpful assistant.",
                voice: this.voiceOverride || "alloy",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: { model: "whisper-1" },
                turn_detection: { type: "server_vad" },
            }
        };
        this.send(event);
    }

    handleEvent(event) {
        switch (event.type) {
            case 'response.audio.delta':
                this.emit('audio_delta', event.delta);
                break;
            case 'response.audio_transcript.delta':
                this.emit('text_delta', event.delta);
                break;
            case 'response.done':
                // Check for errors in the response
                if (event.response?.status === 'failed') {
                    console.error('[OpenAI Service] ❌ Response Failed:', JSON.stringify(event.response.status_details?.error, null, 2));
                }
                this.emit('response_done');
                break;
            case 'conversation.item.input_audio_transcription.completed':
                // Log the final transcription for confirmation
                console.log(`[OpenAI] 👤 User: ${event.transcript}`);
                break;
            case 'input_audio_buffer.speech_started':
                this.emit('speech_started');
                break;
            case 'error':
                console.error('[OpenAI Service] ❌ OpenAI Error:', JSON.stringify(event.error, null, 2));
                break;
        }
    }

    sendAudio(base64Chunk) {
        if (!this.isConnected) return;
        this.send({
            type: "input_audio_buffer.append",
            audio: base64Chunk
        });
    }

    cancelResponse() {
        if (!this.isConnected) return;
        this.send({ type: "response.cancel" });
    }

    send(event) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(event));
        } else {
            console.warn('[OpenAI Service] ⚠️ Cannot send event, socket not open');
        }
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }
}

module.exports = OpenAIRealtimeService;
