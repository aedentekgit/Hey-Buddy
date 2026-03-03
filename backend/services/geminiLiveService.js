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
        this.model = "models/gemini-2.5-flash-native-audio-latest";
    }


    connect(systemInstruction = null, voice = 'Aoede', useTools = true, modelOverride = null) {
        if (modelOverride) this.model = modelOverride;
        console.log(`[Gemini Live] Connecting to ${this.model} with voice: ${voice} (Tools: ${useTools})...`);
        this.systemInstructionOverride = systemInstruction;
        this.voiceOverride = voice;
        this.useTools = useTools;
        // Standard URL for Gemini Multimodal Live WebSocket
        const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log(`[Gemini Live] ✅ Connected to Gemini Live API (${this.model})`);
            this.isConnected = true;
            this.sendSetup();
        });

        this.ws.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                // console.log('[Gemini Live] 📥 Message received:', JSON.stringify(response, null, 2));
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
            this.emit('close', code, reason);
        });
    }

    sendSetup() {
        const modelName = this.model;
        console.log(`[Gemini Live] 📤 Sending setup with model: ${modelName}...`);

        const systemInstruction = this.systemInstructionOverride || `You are Buddy, a professional health and personal assistant. Never narrate your thought process or mention the internal tools you are using to the user. Simply execute the tools silently and provide a brief, professional confirmation to the user.`;

        const setupMessage = {
            setup: {
                model: modelName,
                generation_config: {
                    response_modalities: ["AUDIO"],
                    speech_config: {
                        voice_config: {
                            prebuilt_voice_config: {
                                voice_name: this.voiceOverride || "Aoede"
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                },
                tools: this.useTools ? buddyTools.map(t => ({
                    function_declarations: t.functionDeclarations
                })) : []
            }
        };
        console.log('[Gemini Live] 🚀 Setup Payload:', JSON.stringify(setupMessage, null, 2));
        this.ws.send(JSON.stringify(setupMessage));
    }

    handleResponse(response) {
        if (response.setupComplete || response.setup_complete) {
            console.log('[Gemini Live] 🆗 Setup complete for model:', this.model);
            this.emit('setup_complete');
            this.emit('ready'); // Now we are actually ready
        }

        if (response.error) {
            console.error('[Gemini Live] ❌ Gemini Server Error:', this.model, JSON.stringify(response.error, null, 2));
            this.emit('error', response.error);
        }

        // Handle Server Content (Audio/Interim Transcripts)
        const serverContent = response.serverContent || response.server_content;
        if (serverContent) {
            // If we haven't seen this turn yet, emit turn_started
            if (!this.inTurn) {
                this.inTurn = true;
                this.emit('turn_started');
            }

            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            const parts = modelTurn?.parts || [];

            for (const part of parts) {
                // Audio Data
                if (part?.inlineData?.data || part?.inline_data?.data) {
                    const audioData = part?.inlineData?.data || part?.inline_data?.data;
                    this.emit('audio_delta', audioData);
                }

                // AI Text Output
                if (part?.text) {
                    this.emit('text_delta', part.text);
                }
            }

            // User Speech Transcripts (Interim)
            if (serverContent.inputTranscription || serverContent.input_transcription) {
                const transcription = serverContent.inputTranscription || serverContent.input_transcription;
                this.emit('user_transcript', transcription.text);
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                this.inTurn = false;
                this.emit('response_done');
            }

            if (serverContent.interrupted) {
                this.inTurn = false;
                this.emit('interrupted');
            }
        }

        // Handle Tool Calls (if configured)
        const toolCall = response.toolCall || response.tool_call;
        if (toolCall) {
            this.emit('call_tool', toolCall);
        }

        // Handle Non-Stream / Client Content Completions
        if (response.generationComplete || response.generation_complete) {
            this.inTurn = false;
            this.emit('response_done');
        }
    }

    sendAudio(base64Chunk) {
        if (!this.isConnected) return;
        const message = {
            realtimeInput: {
                mediaChunks: [
                    {
                        data: base64Chunk,
                        mimeType: "audio/pcm"
                    }
                ]
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    sendText(text) {
        if (!this.isConnected) return;
        const message = {
            clientContent: {
                turns: [
                    {
                        role: "user",
                        parts: [{ text: text }]
                    }
                ],
                turnComplete: true
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    sendToolResponse(functionResponses) {
        if (!this.isConnected) return;
        const message = {
            toolResponse: {
                functionResponses: functionResponses
            }
        };
        this.ws.send(JSON.stringify(message));
    }

    cancelResponse() {
        // Multi-modal live handles interruption by sending a new turn or via specific server messages
        // Here we just ensure we are ready for a new turn.
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }
}

module.exports = GeminiLiveService;
