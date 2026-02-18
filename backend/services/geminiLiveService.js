const WebSocket = require('ws');
const EventEmitter = require('events');
const { buddyTools } = require('./geminiService');

/**
 * GeminiLiveService: Manages the WebSocket connection to Gemini Multimodal Live API.
 */
class GeminiLiveService extends EventEmitter {
    constructor(apiKey) {
        super();
        this.apiKey = apiKey;
        this.ws = null;
        this.isConnected = false;
        this.model = "models/gemini-2.0-flash-exp-image-generation";
    }

    connect(systemInstruction = null) {
        console.log('[Gemini Live] Connecting...');
        this.systemInstructionOverride = systemInstruction;
        // Standard URL for Gemini Multimodal Live WebSocket
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log('[Gemini Live] ✅ Connected to Gemini Live API');
            this.isConnected = true;
            this.sendSetup();
            this.emit('ready');
        });

        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                // console.log('[Gemini Live] 📥 Message:', JSON.stringify(response).substring(0, 100));
                this.handleResponse(response);
            } catch (err) {
                console.error('[Gemini Live] ❌ Error parsing message:', err, data.toString());
            }
        });

        this.ws.on('error', (err) => {
            console.error('[Gemini Live] ❌ WebSocket Error:', err);
        });

        this.ws.on('close', (code, reason) => {
            console.log(`[Gemini Live] 🛑 Connection closed: ${code} - ${reason}`);
            this.isConnected = false;
        });
    }

    sendSetup() {
        console.log('[Gemini Live] 📤 Sending setup...');

        // Transform tools to use function_declarations (snake_case) as required by the Live API JSON protocol
        const liveTools = buddyTools.map(tool => ({
            function_declarations: tool.functionDeclarations || tool.function_declarations
        }));

        const systemInstruction = this.systemInstructionOverride || `You are Buddy, a professional health and personal assistant.
                You have access to the user's memories and health reminders.
                STRICT RULE: Only answer based on provided tools result. Do NOT hallucinate.`;

        const setupMessage = {
            setup: {
                model: this.model,
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } }
                    }
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                },
                tools: liveTools
            }
        };
        this.ws.send(JSON.stringify(setupMessage));
    }

    handleResponse(response) {
        if (response.setupComplete || response.setup_complete) {
            console.log('[Gemini Live] 🆗 Setup complete');
        }

        // Handle Server Content (Audio/Interim Transcripts)
        const serverContent = response.serverContent || response.server_content;
        if (serverContent) {
            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            const part = modelTurn?.parts?.[0];

            // Audio Data
            if (part?.inlineData?.data || part?.inline_data?.data) {
                const audioData = part?.inlineData?.data || part?.inline_data?.data;
                this.emit('audio_delta', audioData);
            }

            // Transcripts (Turn-based)
            if (serverContent.inputTranscription || serverContent.input_transcription) {
                const transcription = serverContent.inputTranscription || serverContent.input_transcription;
                this.emit('text_delta', transcription.text);
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                this.emit('response_done');
            }

            if (serverContent.interrupted) {
                this.emit('interrupted');
            }
        }

        // Handle Tool Calls (if configured)
        const toolCall = response.toolCall || response.tool_call;
        if (toolCall) {
            this.emit('call_tool', toolCall);
        }
    }

    sendAudio(base64Chunk) {
        if (!this.isConnected) return;
        const message = {
            realtime_input: {
                media_chunks: [
                    {
                        data: base64Chunk,
                        mime_type: "audio/pcm"
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    sendToolResponse(functionResponses) {
        if (!this.isConnected) return;
        const message = {
            tool_response: {
                function_responses: functionResponses
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    cancelResponse() {
        // Multi-modal live handles interruption via the stream or by sending a specific message
        // For now, we'll just stop sending audio and clearing local queues is handled by BuddyAgent
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }
}

module.exports = GeminiLiveService;
