const EventEmitter = require('events');
const GeminiLiveService = require('../services/geminiLiveService');
const { toolHandlers } = require('../services/geminiService');
const User = require('../models/User');
const contextService = require('../services/contextService');

/**
 * BuddyAgent: The core state machine for a real-time voice session.
 */
class BuddyAgent extends EventEmitter {
    constructor(userId, socket) {
        super();
        this.userId = userId;
        this.socket = socket;
        this.isInterrupted = false;
        this.userContext = null;

        console.log(`[BuddyAgent] 🚀 New Session (Gemini): ${socket.id} (User: ${userId})`);

        // Initialize Gemini Live Service
        this.ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
        this.initialize();
    }

    async initialize() {
        try {
            // 1. Fetch User Data for Timezone context
            const user = await User.findById(this.userId);
            const timeZone = user?.timezone || 'UTC';

            // 2. Fetch Initial Context
            const context = await contextService.getContext(this.userId, null, timeZone);
            this.userContext = context.userContext;

            console.log(`[BuddyAgent] Context Loaded: ${context.memories.length} memories, ${context.reminders.length} reminders`);

            // 3. Setup System Instruction
            const systemInstruction = `You are Buddy, a professional health and personal assistant.
                
                USER CONTEXT:
                - Current User Date: ${this.userContext.localDate}
                - User Timezone: ${this.userContext.timeZone}
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found.'}
                
                STRICT RULES:
                1. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
                   - Requests about schedule or tasks MUST use 'list_reminders' if not in the list above.
                   - Requests about facts, past events, or preferences MUST use 'search_memories' or 'list_memories' if not in the list above.
                
                2. NO HALLUCINATION:
                   - If user asks for today's reminders and they aren't in the context, call 'list_reminders' with date="today".
                   - If context and tool response say there are no reminders/facts, say so clearly. Do NOT invent data.
                
                3. Truth is in the Tools/Context. If neither shows the data, it does NOT exist.`;

            this.setupListeners();
            this.ai.connect(systemInstruction);

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
            if (!this.isInterrupted) {
                this.socket.emit('audio_out', base64);
            }
        });

        this.ai.on('text_delta', (text) => {
            console.log(`[BuddyAgent] 💬 AI Delta: ${text}`);
            this.socket.emit('caption', text);
        });

        this.ai.on('response_done', () => {
            console.log(`[BuddyAgent] 🏁 Turn complete`);
            this.socket.emit('response_done');
        });

        this.ai.on('speech_started', () => {
            console.log(`[BuddyAgent] 👄 Speech detected`);
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
                        // PASS USER CONTEXT HERE
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

        // Convert Buffer to Base64 for Gemini
        const base64 = Buffer.from(audioBuffer).toString('base64');
        this.ai.sendAudio(base64);
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

    cleanup() {
        console.log(`[BuddyAgent] 🛑 Cleaning up session: ${this.userId}`);
        this.ai.disconnect();
        this.removeAllListeners();
    }
}

module.exports = BuddyAgent;
