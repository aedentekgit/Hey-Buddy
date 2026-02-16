const EventEmitter = require('events');
const OpenAIRealtimeService = require('../services/realtimeAI');

/**
 * BuddyAgent: The core state machine for a real-time voice session.
 */
class BuddyAgent extends EventEmitter {
    constructor(userId, socket) {
        super();
        this.userId = userId;
        this.socket = socket;
        this.isInterrupted = false;

        console.log(`[BuddyAgent] 🚀 New Session: ${socket.id} (User: ${userId})`);

        // Initialize OpenAI Realtime Service
        this.ai = new OpenAIRealtimeService(process.env.OPENAI_API_KEY);
        this.setupListeners();
        this.ai.connect();
    }

    setupListeners() {
        this.ai.on('ready', () => {
            console.log(`[BuddyAgent] ✅ OpenAI Ready for ${this.userId}`);
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
        });

        this.ai.on('speech_started', () => {
            console.log(`[BuddyAgent] 👄 Speech detected`);
        });
    }

    /**
     * Handle raw audio chunks from the client
     */
    handleIncomingAudio(audioBuffer) {
        if (!this.ai.isConnected) return;
        this.isInterrupted = false;

        // Convert Buffer to Base64 for OpenAI
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
