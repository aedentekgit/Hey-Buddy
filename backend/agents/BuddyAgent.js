const Settings = require('../models/Settings');
const axios = require('axios');
const EventEmitter = require('events');
const GeminiLiveService = require('../services/geminiLiveService');
const User = require('../models/User');
const contextService = require('../services/contextService');
const { getAiConfig } = require('../controllers/ai/aiController');

const { getPersonality } = require('../utils/personality');
const config = require('../config/env');

/**
 * BuddyAgent: Unified Orchestrator for Mobile Voice Sessions.
 * Now routes all "Thinking" to the Python AI service for web-platform consistency.
 */
class BuddyAgent extends EventEmitter {
    constructor(userId, socket, language = 'auto', conversationId = null, standby = false) {
        super();
        this.userId = userId;
        this.socket = socket;
        this.language = language;
        this.conversationId = conversationId;
        this.isStandby = standby;
        this.isInterrupted = false;
        this.createdAt = Date.now();
        this.currentInputText = '';
        this.currentOutputText = '';
        this.isConnecting = false;
        this.isThinking = false;

        console.log(`[BuddyAgent] 🚀 New Unified Session: ${socket.id} (User: ${userId})`);

        // Initialize AI Hub (Gemini for Ears, Python for Brain)
        this.ai = null;
        this.initialize(language);
    }

    async initialize(targetLanguage) {
        if (this.isConnecting && this.ai) return;
        this.isConnecting = true;

        try {
            // 1. Fetch AI Config and User Data
            const [user, dbSettings, aiConfig] = await Promise.all([
                User.findById(this.userId).select('timezone voicePreferences'),
                Settings.findOne().select('+ai.geminiApiKey'),
                getAiConfig()
            ]);

            this.aiConfig = aiConfig;
            const geminiKey = dbSettings?.ai?.geminiApiKey || process.env.GEMINI_API_KEY;

            // 2. Initialize Gemini (USED ONLY FOR STT NOW)
            if (!this.ai && geminiKey) {
                this.ai = new GeminiLiveService(geminiKey);
                this.setupListeners();
            }

            const timeZone = user?.timezone || 'UTC';
            const voicePrefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };
            const personality = getPersonality(voicePrefs.gender || 'female', voicePrefs.tone || 'soft');

            this.personality = personality;
            this.timeZone = timeZone;

            // 3. Connect Ears (Gemini STT)
            // We give it a strict system instruction to ONLY transcribe to keep latency low
            // and prevent it from trying to be the brain.
            const sttInstruction = "You are the 'Ears' of Buddy. Listen to the user and transcribe their words exactly. DO NOT RESPOND. Just provide transcripts.";
            const modelPath = 'models/gemini-2.0-flash'; // High speed for STT

            if (this.ai) {
                this.ai.connect(sttInstruction, personality.voice, true, modelPath);
            }

        } catch (err) {
            this.isConnecting = false;
            console.error('[BuddyAgent] Unified Initialization failed:', err);
            this.socket.emit('error', `Agent initialization failed: ${err.message}`);
        }
    }

    setupListeners() {
        this.ai.on('ready', () => {
            this.isConnecting = false;
            console.log(`[BuddyAgent] ✅ Ears Connected for ${this.userId}`);
        });

        this.ai.on('error', (err) => {
            console.error(`[BuddyAgent] ❌ Ears Error:`, err);
        });

        this.ai.on('user_transcript', (text) => {
            const transcript = text.toLowerCase().trim();
            if (!transcript) return;

            console.log(`[BuddyAgent] 🎙️ Transcript: "${text}"`);
            this.currentInputText = text;

            // Emit to UI
            this.socket.emit('user_transcript', text);
            this.socket.emit('user_caption', text);

            // Trigger Python Brain
            this.processMessage(text);
        });

        this.ai.on('interrupted', () => {
            console.log(`[BuddyAgent] 🛑 User Interruption`);
            this.interrupt();
        });
    }

    /**
     * The NEW Unified Brain: Calls the Python AI service
     */
    async processMessage(text) {
        if (this.isThinking) return;
        this.isThinking = true;

        try {
            console.log(`[BuddyAgent] 🧠 Thinking (Python Mode): "${text}"`);
            this.socket.emit('turn_started');
            this.isInterrupted = false;
            this.currentOutputText = '';

            const aiServiceUrl = config.AI_SERVICE_URL;

            // 1. Prepare Payload (Match Web Dashboard)
            const payload = {
                message: text,
                session_id: this.conversationId || `mobile_${this.userId}_${Date.now()}`,
                tts: true, // We want Python to generate audio too!
                api_key: this.aiConfig.apiKey,
                provider: this.aiConfig.provider,
                model: this.aiConfig.model,
                userId: this.userId.toString()
            };

            // 2. Stream from Python
            const response = await axios.post(`${aiServiceUrl}/chat/realtime/stream`, payload, {
                responseType: 'stream'
            });

            let buffer = '';
            response.data.on('data', (chunk) => {
                if (this.isInterrupted) return;

                buffer += chunk.toString();
                let lines = buffer.split('\n');

                // Keep the last (possibly incomplete) line in the buffer
                buffer = lines.pop();

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine.startsWith('data: ')) continue;

                    try {
                        const data = JSON.parse(cleanLine.substring(6));

                        // 1. Handle Text Chunks
                        if (data.chunk) {
                            this.currentOutputText += data.chunk;
                            this.socket.emit('caption', data.chunk);
                        }

                        // 2. Handle Audio Chunks (Premium MP3 sentences)
                        if (data.audio) {
                            this.socket.emit('audio_out', data.audio);
                        }

                        // 3. Handle Session Sync
                        if (data.session_id) {
                            this.conversationId = data.session_id;
                        }

                        // 4. Check for Finalization
                        if (data.done === true) {
                            this.finishTurn();
                        }
                    } catch (e) {
                        // console.error('[BuddyAgent] JSON Parse Error on line:', cleanLine);
                    }
                }
            });

            response.data.on('end', () => {
                this.finishTurn();
            });

            response.data.on('error', (err) => {
                console.error('[BuddyAgent] Python Stream Error:', err);
                this.socket.emit('error', 'Python brain error');
                this.isThinking = false;
            });

        } catch (err) {
            console.error('[BuddyAgent] Failed to reach Python Brain:', err.message);
            this.socket.emit('error', 'AI Service unreachable');
            this.isThinking = false;
        }
    }

    finishTurn() {
        if (!this.isThinking) return;
        this.isThinking = false;
        this.socket.emit('response_done');
        this.socket.emit('conversation_updated', { conversationId: this.conversationId });
        console.log(`[BuddyAgent] 🏁 Response Finished`);
    }

    handleIncomingAudio(audioBuffer) {
        if (this.ai && this.ai.isConnected) {
            const base64 = Buffer.from(audioBuffer).toString('base64');
            this.ai.sendAudio(base64);
        }
    }

    handleText(text) {
        console.log(`[BuddyAgent] ⌨️ Handling text input: ${text}`);
        this.processMessage(text);
    }

    interrupt() {
        this.isInterrupted = true;
        this.isThinking = false;
        if (this.ai) this.ai.cancelResponse();
        this.socket.emit('clear_audio_queue');
        this.socket.emit('response_done');
    }

    cleanup() {
        console.log(`[BuddyAgent] 🛑 Cleanup session: ${this.userId}`);
        if (this.ai) this.ai.disconnect();
        this.removeAllListeners();
    }
}

module.exports = BuddyAgent;
