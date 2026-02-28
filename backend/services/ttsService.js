const GeminiLiveService = require('./geminiLiveService');
const { getPersonality } = require('../utils/personality');

/**
 * ttsService: Generates high-quality AI audio from text.
 * Optimized for low latency by allowing pre-buffered connections.
 */
class TTSService {
    constructor() {
        this.activeSessions = new Map();
    }

    /**
     * Internal method to establish a connection
     */
    async _createSession(personality, language = 'en-US') {
        return new Promise((resolve, reject) => {
            const ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
            const timeout = setTimeout(() => {
                ai.disconnect();
                reject(new Error("TTS Connection Timeout"));
            }, 5000);

            ai.on('setup_complete', () => {
                clearTimeout(timeout);
                resolve(ai);
            });

            ai.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            ai.on('close', (code, reason) => {
                clearTimeout(timeout);
                reject(new Error(`WebSocket Closed: ${code} - ${reason}`));
            });

            const systemInstruction = `You are Buddy. Read the provided text naturally in the language it is written in (${language}). Be expressive but professional.`;
            ai.connect(systemInstruction, personality.voice, false);
        });
    }

    /**
     * Generates audio for a given text.
     */
    async generateAudio(text, gender = 'female', tone = 'soft', language = 'en-US', prewarmedAi = null) {
        const startTime = Date.now();
        const personality = getPersonality(gender, tone);

        console.log(`[TTS] Starting generation for "${text.substring(0, 20)}..." in ${language}`);

        let ai;
        try {
            // Setup session (use pre-warmed if available)
            if (prewarmedAi) {
                console.log(`[TTS] Using pre-warmed session`);
                ai = prewarmedAi;
            } else {
                ai = await this._createSession(personality, language);
                console.log(`[TTS] Session established statically in ${Date.now() - startTime}ms`);
            }

            return new Promise((resolve, reject) => {
                let audioChunks = [];
                let isDone = false;

                const cleanup = () => {
                    if (ai) {
                        ai.disconnect();
                        ai.removeAllListeners();
                    }
                    clearTimeout(totalTimeout);
                };

                const totalTimeout = setTimeout(() => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        reject(new Error("TTS Audio Timeout"));
                    }
                }, 20000);

                ai.on('audio_delta', (base64) => {
                    audioChunks.push(Buffer.from(base64, 'base64'));
                });

                ai.on('response_done', () => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        const fullAudio = Buffer.concat(audioChunks).toString('base64');
                        console.log(`[TTS] Total generation took ${Date.now() - startTime}ms`);
                        resolve({
                            audio: fullAudio,
                            voiceName: personality.voice
                        });
                    }
                });

                ai.on('error', (err) => {
                    cleanup();
                    reject(err);
                });

                ai.sendText(text);
            });
        } catch (err) {
            if (ai) ai.disconnect();
            throw err;
        }
    }
}

module.exports = new TTSService();
