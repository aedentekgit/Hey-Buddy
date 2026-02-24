const EventEmitter = require('events');
const GeminiLiveService = require('../services/geminiLiveService');
const { toolHandlers } = require('../services/geminiService');
const User = require('../models/User');
const contextService = require('../services/contextService');

/**
 * BuddyAgent: The core state machine for a real-time voice session.
 */
class BuddyAgent extends EventEmitter {
    constructor(userId, socket, language = 'auto') {
        super();
        this.userId = userId;
        this.socket = socket;
        this.language = language;
        this.isInterrupted = false;
        this.createdAt = Date.now();
        console.log(`[BuddyAgent] 🚀 New Session (Gemini): ${socket.id} (User: ${userId}, Lang: ${language})`);

        // Initialize Gemini Live Service
        this.ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
        this.initialize(language);
    }

    async initialize(targetLanguage) {
        try {
            // 1. Fetch User Data for Timezone and Voice preferences
            const user = await User.findById(this.userId);
            const timeZone = user?.timezone || 'UTC';
            const voicePrefs = user?.voicePreferences || { gender: 'female', tone: 'soft' };

            // 2. Map preferences to Gemini Live voices
            // Gemini Voices: Aoede (Warm/Female), Kore (Bright/Female), Fenrir (Strong/Male), Charon (Deep/Male), Puck (Friendly/Male)
            let selectedVoice = 'Aoede'; // Default high quality female
            const gender = (voicePrefs.gender || 'female').toLowerCase();
            const tone = (voicePrefs.tone || 'soft').toLowerCase();

            if (gender === 'male') {
                if (tone === 'soft') selectedVoice = 'Charon';
                else if (tone === 'energetic') selectedVoice = 'Fenrir';
                else selectedVoice = 'Puck';
            } else {
                // Female options are Aoede and Kore
                if (tone === 'energetic') selectedVoice = 'Kore';
                else selectedVoice = 'Aoede';
            }

            console.log(`[BuddyAgent] Selected voice: ${selectedVoice} for user gender: ${gender}, tone: ${tone}`);

            // 3. Fetch Initial Context
            const context = await contextService.getContext(this.userId, null, timeZone);
            this.userContext = context.userContext;

            console.log(`[BuddyAgent] Context Loaded: ${context.memories.length} memories, ${context.reminders.length} reminders`);

            // 4. Setup Tone and System Instruction
            let toneRule = "Speak with a balanced, clear, and professional tone.";
            if (tone === 'soft') {
                toneRule = "Speak softly, using gentle, empathetic language to convey a comforting and calm presence.";
            } else if (tone === 'energetic') {
                toneRule = "Speak energetically, using lively, enthusiastic language with a fast-paced, high-spirited attitude.";
            }

            const systemInstruction = `You are Buddy, a professional health and personal assistant.
                
                VOICE & TONE PROFILE:
                ${toneRule}

                USER CONTEXT:
                - Current User Date: ${this.userContext.localDate}
                - User Timezone: ${this.userContext.timeZone}
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found.'}
                
                STRICT RULES:
                1. REMINDERS vs MEMORIES are separated.
                   - Schedule/Tasks -> Use 'list_reminders'.
                   - Facts/Notes/History -> Use 'search_memories' or 'list_memories'.
                
                2. NO HALLUCINATION: If the tool result is empty, say so. Do NOT invent data.
                
                3. MULTILINGUAL & MULTIMODAL:
                   - DETECT the user's language automatically. Respond in the SAME language they used.
                   - If the user types, respond with text. If the user speaks, respond naturally.
                   - Always be professional, sympathetic, and concise.`;

            this.setupListeners();
            this.ai.connect(systemInstruction, selectedVoice);

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
            this.socket.emit('caption', text); // caption = AI speaking or typing
        });

        this.ai.on('user_transcript', (text) => {
            this.socket.emit('user_transcript', text); // Real-time feedback of what user said
        });

        this.ai.on('user_transcript', (text) => {
            console.log(`[BuddyAgent] 🎙️ User Transcription: ${text}`);
            this.socket.emit('user_caption', text);
        });

        this.ai.on('response_done', () => {
            console.log(`[BuddyAgent] 🏁 Turn complete`);
            this.socket.emit('response_done');
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
