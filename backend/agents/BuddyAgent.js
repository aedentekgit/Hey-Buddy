const EventEmitter = require('events');
const GeminiLiveService = require('../services/geminiLiveService');
const { toolHandlers } = require('../services/geminiService');
const User = require('../models/User');
const contextService = require('../services/contextService');

const { getPersonality } = require('../utils/personality');

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
        console.log(`[BuddyAgent] 🚀 New Session (Gemini): ${socket.id} (User: ${userId}, Standby: ${standby})`);

        // Initialize Gemini Live Service
        this.ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
        this.initialize(language);
    }

    async initialize(targetLanguage) {
        try {
            // 1. Start DB fetches in parallel
            const contextStartTime = Date.now();
            const contextPromise = contextService.getContext(this.userId, this.conversationId, 'UTC');
            const userPromise = User.findById(this.userId).select('timezone voicePreferences');

            this.setupListeners();

            // 2. Wait for user data to determine personality
            const [user, context] = await Promise.all([userPromise, contextPromise]);
            console.log(`[BuddyAgent] Context & User data fetched in ${Date.now() - contextStartTime}ms`);

            const timeZone = user?.timezone || 'UTC';
            const voicePrefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };
            const personality = getPersonality(voicePrefs.gender || 'female', voicePrefs.tone || 'soft');

            this.userContext = context.userContext;
            this.userContext.timeZone = timeZone; // Ensure consistency

            // 3. Build System Instruction
            const systemInstruction = `SYSTEM IDENTITY:
                - Your name is Buddy.
                - PERSONALITY: ${personality.description}
                - WRITING STYLE: ${personality.writingStyle}
                - REAL-TIME CAPABILITY: You can look up real-time news and current events using the 'google_search' tool. Use it whenever you need to provide up-to-date information.
                
                VOICE CONTEXT: You are communicating with the user using the '${personality.voice}' voice. Your responses MUST reflect this persona's tone.

                USER CONTEXT:
                - Current User Date: ${this.userContext.localDate}
                - User Timezone: ${timeZone}
                - User Language Preference: ${this.language}
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found.'}
                
                STRICT RULES:
                1. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
                   - Schedule/Tasks -> Use 'list_reminders' with date="today" if not in UPCOMING list.
                   - Facts/Notes/History -> Use 'search_memories' or 'list_memories'.
                
                2. NO HALLUCINATION: If the tool result is empty, say so. Do NOT invent data. ALWAYS use 'google_search' for real-time news, current affairs, or information not in your training data.
                
                3. DATE, LOCATION & ACTION SENSITIVITY:
                   - "Today" is ${this.userContext.localDate}.
                   - You MUST resolve relative dates like "tomorrow", "yesterday", or "next Monday" into the exact YYYY-MM-DD format using today's date. 
                   - NEVER ask the user for confirmation if they give a relative date and time (e.g. "tomorrow at 5pm"). Calculate it yourself and call the tool IMMEDIATELY.
                   - NEVER ask "Do you mean [Date]?", just assume you are correct and trigger the 'create_reminder' tool right away.
                   - If a user mentions a place (e.g., "at school", "in Periyar bus stand"), you MUST extract this into the 'location' parameter when calling 'create_reminder'.

                5. MULTILINGUAL SUPPORT: 
                   - You are a native speaker of multiple languages including **Tamil**, Hindi, Spanish, French, etc. 
                   - You MUST respond in the language the user speaks OR explicitly requests (e.g., "speak in Tamil").
                   - If the user switches language, you MUST switch with them immediately.
                   - NEVER refuse a request to speak a different language. You are fully capable of it.
                
                6. VOICE & TTS OPTIMIZATION: 
                   - Your responses are spoken aloud. 
                   - NEVER use bullet points like "*" or "-". Use words like "First", "Next", "Also", "Finally" to list items.
                   - NEVER include markdown characters like "\`\`\`", "**", or "__".
                   - NEVER include technical terms like "json" or "markdown" in your speech.
                   - Keep responses concise and avoid using more than one emoji per turn.
                   - Speak in a natural, conversational way.
                
                Be professional, sympathetic, and concise.`;

            // 4. Connect with instruction and voice
            const aiConnectStart = Date.now();
            this.ai.connect(systemInstruction, personality.voice);
            this.ai.on('ready', () => {
                console.log(`[BuddyAgent] AI Ready in ${Date.now() - aiConnectStart} ms(Total init: ${Date.now() - contextStartTime}ms)`);
            });

        } catch (err) {
            console.error('[BuddyAgent] Initialization failed:', err);
            this.socket.emit('error', 'Agent initialization failed.');
        }
    }

    setupListeners() {
        this.ai.on('ready', () => {
            console.log(`[BuddyAgent] ✅ Gemini Ready for ${this.userId}`);
        });

        this.ai.on('error', (err) => {
            console.error(`[BuddyAgent] ❌ Gemini error:`, err);
            this.socket.emit('error', 'Gemini error');
            this.socket.emit('response_done');
        });

        this.ai.on('audio_delta', (base64) => {
            // Send audio back to client if not interrupted by user speech and NOT in standby
            if (!this.isInterrupted && !this.isStandby) {
                // console.log('[BuddyAgent] 🔊 Sending audio delta');
                this.socket.emit('audio_out', base64);
            }
        });

        this.ai.on('text_delta', (text) => {
            console.log(`[BuddyAgent] 💬 AI Delta: ${text} `);
            this.currentOutputText += text;
            if (!this.isStandby) {
                this.socket.emit('caption', text); // caption = AI speaking or typing
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

        this.ai.on('turn_started', () => {
            this.isInterrupted = false;
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
            this.ai.sendToolResponse(results);
        });
    }

    /**
     * Handle raw audio chunks from the client
     */
    handleIncomingAudio(audioBuffer) {
        if (!this.ai.isConnected) return;
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
            console.log(`[BuddyAgent] ⚠️ AI not connected yet, queueing text: ${text}`);
            if (this.ai) {
                this.ai.once('ready', () => {
                    console.log(`[BuddyAgent] ⌨️ Sending queued text input: ${text} `);
                    this.ai.sendText(text);
                });
            } else {
                this.socket.emit('error', 'AI not initialized');
                this.socket.emit('response_done');
            }
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
        this.ai.cancelResponse();
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
        this.ai.sendText(text);
    }

    cleanup() {
        console.log(`[BuddyAgent] 🛑 Cleaning up session: ${this.userId} `);
        this.ai.disconnect();
        this.removeAllListeners();
    }
}

module.exports = BuddyAgent;
