const Settings = require('../models/Settings');
const axios = require('axios');
const EventEmitter = require('events');
const GeminiLiveService = require('../services/geminiLiveService');
const { toolHandlers } = require('../services/geminiService');
const User = require('../models/User');
const contextService = require('../services/contextService');

const { getPersonality } = require('../utils/personality');
const config = require('../config/env');

/**
 * BuddyAgent: The core state machine for a real-time voice session.
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
        console.log(`[BuddyAgent] 🚀 New Session (Gemini): ${socket.id} (User: ${userId}, Standby: ${standby})`);

        // Initialize Gemini Live Service
        this.ai = null;
        this.initialize(language);
    }

    async initialize(targetLanguage) {
        if (this.isConnecting && this.ai) return;
        this.isConnecting = true;

        try {
            // 1. Start DB fetches in parallel
            const contextStartTime = Date.now();
            const contextPromise = contextService.getContext(this.userId, this.conversationId, 'UTC');
            const userPromise = User.findById(this.userId).select('timezone voicePreferences');
            const settingsPromise = Settings.findOne().select('+ai.geminiApiKey ai.activeModel ai.activeVoiceModel');

            // 2. Wait for all data
            const [user, context, dbSettings] = await Promise.all([userPromise, contextPromise, settingsPromise]);

            // 3. SUPPLEMENT: Fetch Semantic Memory from Python FAISS
            let semanticMemories = context.memories || [];
            try {
                const aiServiceUrl = config.AI_SERVICE_URL;
                console.log(`[BuddyAgent] Fetching semantic memory for context...`);
                const memResp = await axios.get(`${aiServiceUrl}/tools/memory`, {
                    params: { query: context.history.length > 0 ? context.history[context.history.length - 1].content : 'personal facts', k: 8 }
                });
                if (memResp.data && memResp.data.results) {
                    semanticMemories = [...new Set([...semanticMemories, ...memResp.data.results])];
                }
            } catch (memErr) {
                console.warn(`[BuddyAgent] Semantic memory fetch failed, using basic context.`);
            }

            console.log(`[BuddyAgent] Context, User & Settings fetched in ${Date.now() - contextStartTime}ms`);

            // 4. Initialize AI Engine (Gemini / OpenAI)
            if (!this.ai) {
                const activeModel = dbSettings?.ai?.activeModel || '';
                const geminiKey = dbSettings?.ai?.geminiApiKey || process.env.GEMINI_API_KEY;
                const openaiKey = dbSettings?.ai?.openaiApiKey || process.env.OPENAI_API_KEY;

                if (activeModel.includes('openai') && openaiKey) {
                    const OpenAIRealtimeService = require('../services/realtimeAI');
                    this.ai = new OpenAIRealtimeService(openaiKey);
                } else if (geminiKey) {
                    this.ai = new GeminiLiveService(geminiKey);
                } else {
                    throw new Error("No AI Engine configured.");
                }
                this.setupListeners();
            }

            const timeZone = user?.timezone || 'UTC';
            const voicePrefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };
            const personality = getPersonality(voicePrefs.gender || 'female', voicePrefs.tone || 'soft');

            this.userContext = context.userContext;
            this.userContext.timeZone = timeZone;

            // 5. Build System Instruction (Mirrored from Python 2.0)
            const systemInstruction = `SYSTEM IDENTITY:
- Your name is Buddy.
- PERSONALITY: ${personality.description}
- WRITING STYLE: ${personality.writingStyle}
- TONE: Warm, intelligent, brief, a little witty. Never robotic.

- VOICEOVER MODE: You are communicating via VOICE. Keep replies naturally short (1-3 sentences) unless asked for more.
- YOUR FINAL HUMAN-LIKE ANSWER MUST START WITH THE MARKER "[ACK]". Output absolutely NOTHING before "[ACK]".

USER CONTEXT:
- Current User Date: ${this.userContext.localDate}
- User Timezone: ${timeZone}
- User Language Preference: ${this.language}

RELEVANT MEMORIES (Strict Facts):
${semanticMemories.length > 0 ? semanticMemories.join('\n') : 'No specific memories found.'}

UPCOMING REMINDERS:
${context.reminders.length > 0 ? context.reminders.map(r => '- ' + r.title + ' at ' + r.time).join('\n') : 'No upcoming reminders found.'}

CAPABILITIES & TOOLS:
1. WEB SEARCH: Use 'web_search' for any real-time info, sports, news, or deep research. Do not narrate that you are searching.
2. MEMORY: Use 'save_memory' for facts and 'search_memories' for history.
3. REMINDERS: Use 'create_reminder' and 'list_reminders' for scheduling.
4. NAVIGATION: Use 'navigate_to' to move the user between app screens.

STRICT RULES:
- NEVER THINK ALOUD. Zero narration of tool choice.
- NO HALLUCINATION. If a tool returns nothing, say you don't know.
- TAMIL/HINDI SUPPORT: You are a native speaker. Switch to the user's language immediately.
- Resolution: Resolve "tomorrow" or "next Friday" to exact YYYY-MM-DD using today's date (${this.userContext.localDate}).`;

            // 4. Resolve the exact model identifier for the selected protocol
            let targetModel = null;
            const activeModel = dbSettings?.ai?.activeModel;

            // This is the EXACT whitelist supported by Multimodal Live WebSocket
            const LIVE_MODELS = [
                'gemini-1.5-flash-002',
                'gemini-2.0-flash-exp',
                'gemini-2.0-flash',
                'gemini-1.5-flash-001',
                'gemini-2.5-flash-native-audio'
            ];

            if (activeModel) {
                const modelId = activeModel.split('/').pop().split(':')[0];

                if (this.ai instanceof GeminiLiveService) {
                    // AUTO-FALLBACK: Use gemini-2.0-flash for speed and reliability, NOT a thinking model
                    const dbVoiceModelRaw = dbSettings?.ai?.activeVoiceModel || 'google/gemini-2.0-flash';
                    const voiceModelId = dbVoiceModelRaw.split('/').pop().split(':')[0];

                    // Check for strict Live API compatibility
                    const isCompatible = LIVE_MODELS.some(m => voiceModelId === m || voiceModelId.startsWith(m + '-'));

                    if (isCompatible) {
                        targetModel = `models/${voiceModelId}`;
                    } else {
                        console.warn(`[BuddyAgent] ⚠️ Incompatible Voice Model detected: "${voiceModelId}". Falling back to gemini-2.0-flash.`);
                        targetModel = 'models/gemini-1.5-flash';
                    }
                    console.info(`[BuddyAgent] 🧠 Resolving "${modelId}" -> "${targetModel}" (Voice Optimization)`);
                } else {
                    // OpenAI Realtime mapping
                    targetModel = modelId.includes('gpt-4o') ? 'gpt-4o-realtime-preview' : modelId;
                }
            }


            const aiConnectStart = Date.now();
            console.log(`[BuddyAgent] 🔌 Dynamic Connection Start: ${targetModel} (Service: ${this.ai.constructor.name})`);
            this.ai.connect(systemInstruction, personality.voice, true, targetModel);

        } catch (err) {
            this.isConnecting = false;
            console.error('[BuddyAgent] Initialization failed:', err);
            this.socket.emit('error', `Agent initialization failed: ${err.message}`);
            this.socket.emit('response_done'); // Clear 'Thinking' state
        }
    }

    setupListeners() {
        this.ai.on('ready', () => {
            this.isConnecting = false;
            console.log(`[BuddyAgent] ✅ AI Service Ready for ${this.userId}`);
        });

        this.ai.on('error', (err) => {
            console.error(`[BuddyAgent] ❌ Gemini error:`, err);
            this.socket.emit('error', 'Gemini error');
            this.socket.emit('response_done');
        });

        this.ai.on('close', (code, reason) => {
            console.warn(`[BuddyAgent] 🔌 Gemini connection closed (Code: ${code}, Reason: ${reason})`);
            this.socket.emit('error', `Connection closed: ${reason || code}`);
            this.socket.emit('response_done');
            this.socket.emit('turn_completed');
        });

        this.ai.on('audio_delta', (base64) => {
            // Send audio back to client if not interrupted, NOT in standby, AND NOT discarding thinking/reasoning
            if (!this.isInterrupted && !this.isStandby && !this.isDiscardingReasoning) {
                // console.log('[BuddyAgent] 🔊 Sending audio delta');
                this.socket.emit('audio_out', base64);
            }
        });

        this.ai.on('text_delta', (text) => {
            // [ACK] Marker Protocol: Discard everything until we see '[ACK]'
            if (!this.hasAckArrived) {
                this.pendingOutputBuffer = (this.pendingOutputBuffer || '') + text;
                const ackIndex = this.pendingOutputBuffer.indexOf('[ACK]');

                if (ackIndex !== -1) {
                    this.hasAckArrived = true;
                    // Start processing from after the [ACK]
                    text = this.pendingOutputBuffer.substring(ackIndex + 5);
                    this.pendingOutputBuffer = '';
                    console.log(`[BuddyAgent] 🎯 ACK Received. Starting clean output.`);
                } else {
                    // Still in reasoning block
                    if (this.pendingOutputBuffer.length > 500) {
                        // Safety: if the AI is rambling forever without ACK, just clear buffer
                        this.pendingOutputBuffer = this.pendingOutputBuffer.substring(400);
                    }
                    return;
                }
            }

            const cleanText = text
                .replace(/\*\*/g, '')
                .replace(/\n{2,}/g, '\n')
                .trim();

            if (!cleanText) return;

            console.log(`[BuddyAgent] 💬 AI Delta: ${cleanText}`);
            this.currentOutputText += cleanText;

            if (!this.isStandby) {
                this.socket.emit('caption', cleanText);
            }
        });
        // Wake word detection logic
        this.lastWakeWordDetected = 0;
        const WAKE_WORD_COOLDOWN = 5000; // 5 seconds between wake events

        this.ai.on('user_transcript', (text) => {
            console.log(`[BuddyAgent] 🎙️ User Transcription: ${text} `);

            // High-Precision Wake Word Detection
            const transcript = text.toLowerCase().trim();

            // Phrases that confirm intent to talk to Buddy
            const WAKE_WORD_PHRASES = [
                'hey buddy', 'hi buddy', 'hello buddy', 'okay buddy',
                'hey body', 'hi body', 'hey bloody', 'hi bloody', // Phonetic variants
                'hey buddy!', 'hi buddy!'
            ];

            const isWakeWordDetected = WAKE_WORD_PHRASES.some(phrase => {
                // Must be the exact phrase or start with the phrase followed by a space/punctuation
                return transcript === phrase || transcript.startsWith(phrase + ' ') || transcript.startsWith(phrase + ',');
            });

            if (isWakeWordDetected) {
                const now = Date.now();
                if (now - this.lastWakeWordDetected > WAKE_WORD_COOLDOWN) {
                    this.lastWakeWordDetected = now;
                    console.log(`[BuddyAgent] 🔔 Confirmed Wake Word: "${text}"`);

                    if (this.isStandby) {
                        this.isStandby = false;
                        console.log(`[BuddyAgent] 🚀 Session Activated via Wake Word`);
                        this.socket.emit('wake_word_detected', { transcript: text, timestamp: now });
                    }
                }
            }

            this.currentInputText = text;

            // Only send captions if active
            if (!this.isStandby) {
                this.socket.emit('user_transcript', text);
                this.socket.emit('user_caption', text);
            }
        });

        this.ai.on('turn_started', () => {
            this.isInterrupted = false;
            this.isDiscardingReasoning = false; // Internal reset
            this.hasAckArrived = false; // Reset Marker Protocol
            this.pendingOutputBuffer = '';
            this.turnStartTime = Date.now();
            console.log('[BuddyAgent] AI started thinking...');
            this.socket.emit('turn_started');
        });

        this.ai.on('response_done', async () => {
            const duration = this.turnStartTime ? Date.now() - this.turnStartTime : 0;
            console.log(`[BuddyAgent] 🏁 Turn complete in ${duration} ms`);
            this.socket.emit('response_done');

            // Save conversation history
            if (this.currentOutputText || this.currentInputText) {
                const input = this.currentInputText.trim() || '[Voice Input]';
                const output = this.currentOutputText.trim() || '[Audio Response]';

                try {
                    this.conversationId = await contextService.saveInteraction(
                        this.userId,
                        this.conversationId,
                        input,
                        output
                    );
                    this.socket.emit('conversation_updated', { conversationId: this.conversationId });
                } catch (e) {
                    console.error('[BuddyAgent] Failed to save conversation history', e);
                }

                // Reset for next turn
                this.currentInputText = '';
                this.currentOutputText = '';
            }
        });

        this.ai.on('speech_started', () => {
            console.log(`[BuddyAgent] 👄 Speech detected`);
        });



        this.ai.on('interrupted', () => {
            console.log(`[BuddyAgent] 🛑 Audio generation interrupted by Gemini(User Voice Activity Detected)`);
            this.interrupt();
        });

        this.ai.on('call_tool', async (toolCall) => {
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;
            if (!functionCalls) return;

            console.log(`[BuddyAgent] 🛠️ Executing tools for ${this.userId}: `, functionCalls.map(f => f.name));

            const results = [];
            for (const call of functionCalls) {
                const handler = toolHandlers[call.name];
                const callId = call.id || call.call_id;

                if (handler) {
                    try {
                        const toolResult = await handler(this.userId, call.args, this.userContext);
                        console.log(`[BuddyAgent] ✅ Tool ${call.name} result: `, JSON.stringify(toolResult).substring(0, 100));
                        results.push({
                            name: call.name,
                            id: callId,
                            response: { result: toolResult }
                        });
                    } catch (err) {
                        console.error(`[BuddyAgent] ❌ Tool ${call.name} failed: `, err.message);
                        results.push({
                            name: call.name,
                            id: callId,
                            response: { error: err.message }
                        });
                    }
                } else {
                    console.warn(`[BuddyAgent] ⚠️ Tool ${call.name} not found`);
                    results.push({
                        name: call.name,
                        id: callId,
                        response: { error: `Tool ${call.name} not found.` }
                    });
                }
            }

            console.log(`[BuddyAgent] 📤 Sending ${results.length} tool responses to Gemini`);
            this.isDiscardingReasoning = false; // After a tool result, we expect REAL output
            this.ai.sendToolResponse(results);
        });

        this.ai.on('usage', async (tokens) => {
            try {
                // Increment the global token usage in settings
                await Settings.findOneAndUpdate({}, { $inc: { 'ai.totalTokensUsed': tokens } });
                // console.log(`[BuddyAgent] 📊 Tracked ${tokens} tokens for User ${this.userId}`);
            } catch (err) {
                console.error('[BuddyAgent] Failed to update global token usage:', err);
            }
        });
    }

    /**
     * Handle raw audio chunks from the client
     */
    handleIncomingAudio(audioBuffer) {
        if (!this.ai || !this.ai.isConnected) return;
        this.isInterrupted = false;
        this.lastInputType = 'voice';

        // Convert Buffer to Base64 for Gemini
        const base64 = Buffer.from(audioBuffer).toString('base64');
        this.ai.sendAudio(base64);
    }

    /**
     * Handle text messages from the client
     */
    handleText(text) {
        this.isInterrupted = false;
        this.lastInputType = 'text';
        this.currentInputText = text;

        if (this.isStandby) {
            console.log(`[BuddyAgent] 🚀 Session Activated via Text Input`);
            this.isStandby = false;
        }

        if (!this.ai || !this.ai.isConnected) {
            console.log(`[BuddyAgent] ⚠️ AI not connected, attempting to reconnect for text: ${text}`);

            // Re-initialize if not already in progress
            if (!this.isConnecting || !this.ai) {
                this.initialize(this.language);
            }

            // Wait for ready state before sending
            const onReady = () => {
                console.log(`[BuddyAgent] ⌨️ Sending queued text input: ${text} `);
                this.ai.sendText(text);
                this.ai.removeListener('error', onError);
            };

            const onError = (err) => {
                this.socket.emit('error', 'AI could not reconnect.');
                this.socket.emit('response_done');
                this.ai.removeListener('ready', onReady);
            };

            this.ai.once('ready', onReady);
            this.ai.once('error', onError);

            return;
        }

        console.log(`[BuddyAgent] ⌨️ Handling text input: ${text} `);
        this.ai.sendText(text);
    }

    /**
     * Stop AI output immediately (User started speaking)
     */
    interrupt() {
        console.log(`[BuddyAgent] ⏹️ User Interrupted`);
        this.isInterrupted = true;
        if (this.ai) {
            this.ai.cancelResponse();
        }
        this.socket.emit('clear_audio_queue');
    }

    activate() {
        if (this.isStandby) {
            console.log(`[BuddyAgent] 🚀 Manually activated via socket event`);
            this.isStandby = false;
        }
    }

    say(text) {
        console.log(`[BuddyAgent] 🎙️ AI Injecting Speech: ${text} `);
        this.isInterrupted = false;
        if (this.ai) {
            this.ai.sendText(text);
        }
    }

    cleanup() {
        console.log(`[BuddyAgent] 🛑 Cleaning up session: ${this.userId} `);
        if (this.ai) {
            this.ai.disconnect();
        }
        this.removeAllListeners();
    }
}

module.exports = BuddyAgent;
