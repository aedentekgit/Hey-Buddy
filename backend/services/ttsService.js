const GeminiLiveService = require('./geminiLiveService');
const { getPersonality } = require('../utils/personality');

/**
 * ttsService: Generates high-quality AI audio from text using Gemini Multimodal Live voices.
 */
const ttsService = {
    generateAudio: async (text, gender = 'female', tone = 'soft') => {
        return new Promise((resolve, reject) => {
            try {
                const personality = getPersonality(gender, tone);
                const ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
                let audioChunks = [];
                let isDone = false;

                const cleanup = () => {
                    ai.disconnect();
                    ai.removeAllListeners();
                    clearTimeout(timeout);
                };

                const timeout = setTimeout(() => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        reject(new Error("TTS generation timed out."));
                    }
                }, 10000); // 10s timeout

                ai.on('audio_delta', (base64) => {
                    if (!isDone) {
                        audioChunks.push(Buffer.from(base64, 'base64'));
                    }
                });

                ai.on('error', (err) => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        reject(err);
                    }
                });

                ai.on('close', () => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        reject(new Error("Connection closed before response was received."));
                    }
                });

                ai.on('response_done', () => {
                    if (!isDone) {
                        isDone = true;
                        cleanup();
                        if (audioChunks.length === 0) {
                            reject(new Error("No audio chunks received."));
                        } else {
                            const fullAudio = Buffer.concat(audioChunks).toString('base64');
                            resolve({
                                audio: fullAudio,
                                voiceName: personality.voice
                            });
                        }
                    }
                });

                ai.on('setup_complete', () => {
                    ai.sendText(text);
                });

                const systemInstruction = `You are Buddy. Speak the following text naturally.`;
                ai.connect(systemInstruction, personality.voice, false);
            } catch (err) {
                reject(err);
            }
        });
    }
};

module.exports = ttsService;
