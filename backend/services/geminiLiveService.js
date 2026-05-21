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
        this.model = null; // Set dynamically from Admin Dashboard
    }


    connect(systemInstruction = null, voice = 'Aoede', useTools = true, modelOverride = null) {
        // Map unsupported voice names to Gemini-compatible ones
        const VOICE_MAP = {
            'en-GB-RyanNeural': 'Puck',
            'Ryan': 'Puck',
            'Sonia': 'Aoede',
            'Aria': 'Aoede',
            'en-US-ChristopherNeural': 'Charon',
            'en-US-GuyNeural': 'Fenrir'
        };

        const resolvedVoice = VOICE_MAP[voice] || voice;

        // Use provided model or throw error—No more hardcoded fallbacks in backend
        if (modelOverride) this.model = modelOverride;
        if (!this.model) {
            this.emit('error', 'No AI model selected in settings.');
            return;
        }

        // Ensure we only use supported native audio models for Live API to prevent Code 1008 rejection
        const supportedModels = [
            'models/gemini-2.5-flash-native-audio-latest',
            'models/gemini-2.5-flash-native-audio-preview-09-2025'
        ];
        
        let targetModel = this.model;
        if (!targetModel.startsWith('models/')) {
            targetModel = `models/${targetModel}`;
        }
        
        if (!supportedModels.includes(targetModel)) {
            console.log(`[Gemini Live] Model "${this.model}" is unsupported for Multimodal Live on this tier. Forcing "models/gemini-2.5-flash-native-audio-latest".`);
            this.model = 'models/gemini-2.5-flash-native-audio-latest';
        } else {
            this.model = targetModel;
        }

        console.log(`[Gemini Live] 🔗 Dynamic Initialization: ${this.model} (Voice: ${resolvedVoice})...`);
        this.systemInstructionOverride = systemInstruction;
        this.voiceOverride = resolvedVoice;
        this.useTools = useTools;
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
                console.log('[Gemini Live] 📥 Raw Response:', JSON.stringify(response));
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
            this.emit('close', code, reason || code);
            this.emit('turn_complete'); // Ensure thinking clears
        });
    }

    sendSetup() {
        const modelName = this.model;
        console.log(`[Gemini Live] 📤 Sending setup with model: ${modelName}...`);

        const systemInstruction = this.systemInstructionOverride || `You are Buddy, a professional health and personal assistant. 1. DO NOT THINK ALOUD OR NARRATE ACTIONS (CRITICAL): You must execute your tool calls perfectly silently. NEVER output transitional phrases like "I will search google for...", "Initiating search", or "I am starting research". NEVER say "I've decided to use...". Just reply naturally like a human WITHOUT explaining what you are doing. 2. NO INTERNAL REASONING: NEVER include your internal thoughts, planning, or focus in the response. (e.g., "My next step is", "I'll then prepare"). 3. NO SEARCH COMMENTARY: When using Google Search, DO NOT explain that you are searching. Just provide the final answer immediately. 4. NO MARKDOWN HEADERS: NEVER use bold headers like "**Noting Contextual Details**" or emojis. Just give a direct, final, simple answer.`;

        const setupMessage = {
            setup: {
                model: modelName,
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: this.voiceOverride || "Aoede"
                            }
                        }
                    }
                },
                system_instruction: {
                    parts: [{ text: systemInstruction }]
                },
                tools: this.useTools ? [
                    ...buddyTools.map(t => ({
                        function_declarations: t.functionDeclarations
                    }))
                ] : []
            }
        };
        console.log('[Gemini Live] 🚀 Setup Payload:', JSON.stringify(setupMessage, null, 2));
        this.ws.send(JSON.stringify(setupMessage));
    }

    handleResponse(response) {
        console.log('[Gemini Live] 📥 Raw Response:', JSON.stringify(response));
        if (response.setupComplete || response.setup_complete) {
            console.log('[Gemini Live] 🆗 Setup complete for model:', this.model);
            this.emit('setup_complete');
            this.emit('ready'); // Now we are actually ready
        }

        if (response.error) {
            console.error('[Gemini Live] ❌ Gemini Server Error:', this.model, JSON.stringify(response.error, null, 2));
            this.emit('error', response.error);
            this.emit('turn_complete'); // Stop thinking circle
        }

        // Handle Usage Metadata
        const usage = response.usageMetadata || response.usage_metadata;
        if (usage) {
            // console.log('[Gemini Live] 📊 Usage Metadata:', usage);
            this.emit('usage', usage.totalTokenCount || usage.total_token_count);
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
                        mimeType: "audio/pcm;rate=16000"
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
        this.isConnected = false;
        if (this.ws) {
            // Remove all listeners before closing to prevent ghost events
            this.ws.removeAllListeners();
            try {
                this.ws.close();
            } catch (e) {
                // Ignore close errors on already-closed sockets
            }
            this.ws = null;
        }
    }
}

module.exports = GeminiLiveService;