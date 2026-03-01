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
            }, 3000); // Shorter timeout for faster fallback

            ai.on('ready', () => {
                clearTimeout(timeout);
                resolve(ai);
            });

            ai.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            const systemInstruction = `Read this naturally: [TEXT]`;
            ai.connect(systemInstruction, personality.voice, false);
        });
    }

    /**
     * Generates audio for a given text.
     */
    async generateAudio(text, gender = 'female', tone = 'soft', language = 'en-US', prewarmedAi = null) {
        const startTime = Date.now();
        const personality = getPersonality(gender, tone);

        // FALLBACK: If text is too short or we need speed, we can use a simpler TTS.
        // But for now, we'll try Gemini Live first and fallback to google-tts-api if it fails.

        let ai;
        try {
            if (prewarmedAi) {
                ai = prewarmedAi;
            } else {
                ai = await this._createSession(personality, language);
            }

            return new Promise((resolve, reject) => {
                let audioChunks = [];
                let isDone = false;

                const totalTimeout = setTimeout(async () => {
                    if (!isDone) {
                        isDone = true;
                        if (ai) ai.disconnect();
                        console.log("[TTS] Gemini timed out, falling back to Google TTS");
                        try {
                            const googleTTS = require('google-tts-api');
                            const url = googleTTS.getAudioUrl(text, { lang: language.split('-')[0], slow: false, host: 'https://translate.google.com' });
                            const axios = require('axios');
                            const response = await axios.get(url, { responseType: 'arraybuffer' });
                            resolve({ audio: Buffer.from(response.data).toString('base64'), voiceName: 'Google' });
                        } catch (e) {
                            reject(new Error("TTS Audio Timeout and Fallback Failed"));
                        }
                    }
                }, 5000);

                ai.on('audio_delta', (base64) => {
                    audioChunks.push(Buffer.from(base64, 'base64'));
                });

                ai.on('response_done', () => {
                    if (!isDone) {
                        isDone = true;
                        clearTimeout(totalTimeout);
                        if (ai) ai.disconnect();
                        const fullAudio = Buffer.concat(audioChunks).toString('base64');
                        resolve({ audio: fullAudio, voiceName: personality.voice });
                    }
                });

                ai.on('error', async (err) => {
                    if (!isDone) {
                        isDone = true;
                        clearTimeout(totalTimeout);
                        if (ai) ai.disconnect();
                        // Fallback logic here too...
                        resolve(null);
                    }
                });

                ai.sendText(text);
            });
        } catch (err) {
            console.warn("[TTS] Gemini Session Failed, trying Google TTS:", err.message);
            try {
                const googleTTS = require('google-tts-api');
                const url = googleTTS.getAudioUrl(text, { lang: language.split('-')[0], slow: false, host: 'https://translate.google.com' });
                const axios = require('axios');
                const resp = await axios.get(url, { responseType: 'arraybuffer' });
                return { audio: Buffer.from(resp.data).toString('base64'), voiceName: 'Google' };
            } catch (e) {
                return null;
            }
        }
    }
}

module.exports = new TTSService();
