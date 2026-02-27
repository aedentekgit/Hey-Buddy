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
    constructor(userId, socket, language = 'auto', conversationId = null) {
        super();
        this.userId = userId;
        this.socket = socket;
        this.language = language;
        this.conversationId = conversationId;
        this.isInterrupted = false;
        this.createdAt = Date.now();
        this.currentInputText = '';
        this.currentOutputText = '';
        console.log(`[BuddyAgent] 🚀 New Session (Gemini): ${socket.id} (User: ${userId}, Lang: ${language})`);

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
                
                VOICE CONTEXT: You are communicating with the user using the '${personality.voice}' voice. Your responses MUST reflect this persona's tone.

                USER CONTEXT:
                - Current User Date: ${this.userContext.localDate}
                - User Timezone: ${timeZone}
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found.'}
                
                STRICT RULES:
                1. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
                   - Schedule/Tasks -> Use 'list_reminders' with date="today" if not in UPCOMING list.
                   - Facts/Notes/History -> Use 'search_memories' or 'list_memories'.
                
                2. NO HALLUCINATION: If the tool result is empty, say so. Do NOT invent data.
                
                3. MULTILINGUAL & CONCISE:
                   - Respond in the SAME language the user used.
                   - Be professional, sympathetic, and concise.`;

            // 4. Connect with instruction and voice
            const aiConnectStart = Date.now();
            this.ai.connect(systemInstruction, personality.voice);
            this.ai.on('ready', () => {
                console.log(`[BuddyAgent] AI Ready in ${Date.now() - aiConnectStart}ms (Total init: ${Date.now() - contextStartTime}ms)`);
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

        this.ai.on('audio_delta', (base64) => {
            // Send audio back to client if not interrupted by user speech
            if (!this.isInterrupted) {
                this.socket.emit('audio_out', base64);
            }
        });

        this.ai.on('text_delta', (text) => {
            // console.log(`[BuddyAgent] 💬 AI Delta: ${text}`);
            this.currentOutputText += text;
            this.socket.emit('caption', text); // caption = AI speaking or typing
        });

        // Combine the duplicate user_transcript handlers
        this.ai.on('user_transcript', (text) => {
            console.log(`[BuddyAgent] 🎙️ User Transcription: ${text}`);
            this.currentInputText = text;
            this.socket.emit('user_transcript', text);
            this.socket.emit('user_caption', text);
        });

        this.ai.on('turn_started', () => {
            this.isInterrupted = false;
            this.turnStartTime = Date.now();
            console.log('[BuddyAgent] AI started thinking...');
        });

        this.ai.on('response_done', async () => {
            console.log(`[BuddyAgent] 🏁 Turn complete in ${Date.now() - this.turnStartTime}ms`);
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
            console.log(`[BuddyAgent] 🛑 Audio generation interrupted by Gemini (User Voice Activity Detected)`);
            this.interrupt();
        });

        this.ai.on('call_tool', async (toolCall) => {
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;
            if (!functionCalls) return;

            console.log(`[BuddyAgent] 🛠️ Executing tools for ${this.userId}:`, functionCalls.map(f => f.name));

            const results = [];
            for (const call of functionCalls) {
                const handler = toolHandlers[call.name];
                const callId = call.id || call.call_id;

                if (handler) {
                    try {
                        const toolResult = await handler(this.userId, call.args, this.userContext);
                        results.push({
                            name: call.name,
                            id: callId,
                            response: { result: toolResult }
                        });
                    } catch (err) {
                        results.push({
                            name: call.name,
                            id: callId,
                            response: { error: err.message }
                        });
                    }
                } else {
                    results.push({
                        name: call.name,
                        id: callId,
                        response: { error: `Tool ${call.name} not found.` }
                    });
                }
            }

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
        if (!this.ai.isConnected) return;
        this.isInterrupted = false;
        this.lastInputType = 'text';
        this.currentInputText = text;

        console.log(`[BuddyAgent] ⌨️ Handling text input: ${text}`);
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

    say(text) {
        console.log(`[BuddyAgent] 🎙️ AI Injecting Speech: ${text}`);
        this.isInterrupted = false;
        this.ai.sendText(text);
    }

    cleanup() {
        console.log(`[BuddyAgent] 🛑 Cleaning up session: ${this.userId}`);
        this.ai.disconnect();
        this.removeAllListeners();
    }
}

module.exports = BuddyAgent;
