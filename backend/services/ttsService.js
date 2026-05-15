const GeminiLiveService = require('./geminiLiveService');
const { getPersonality } = require('../utils/personality');
const Settings = require('../models/Settings');

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
        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        const apiKey = settings?.ai?.geminiApiKey || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Gemini API Key for TTS not configured.");

        return new Promise((resolve, reject) => {
            const ai = new GeminiLiveService(apiKey);
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

            ai.on('close', (code, reason) => {
                clearTimeout(timeout);
                reject(new Error(`TTS Connection Closed: ${code} - ${reason}`));
            });

            const systemInstruction = `Read this naturally: [TEXT]`;
            ai.connect(systemInstruction, personality.voice, false);
        });
    }

    /**
     * Helper to wrap raw PCM data in a WAV header
     */
    _addWavHeader(pcmBuffer, sampleRate = 24000, numChannels = 1) {
        const header = Buffer.allocUnsafe(44);
        const writeString = (off, str) => { for (let i = 0; i < str.length; i++) header[off + i] = str.charCodeAt(i); };

        writeString(0, 'RIFF');
        header.writeUInt32LE(36 + pcmBuffer.length, 4);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        header.writeUInt32LE(16, 16); // subchunk1size (PCM)
        header.writeUInt16LE(1, 20);  // audio format (PCM)
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * 2, 28); // byte rate
        header.writeUInt16LE(numChannels * 2, 32); // block align
        header.writeUInt16LE(16, 34); // bits per sample
        writeString(36, 'data');
        header.writeUInt32LE(pcmBuffer.length, 40);

        return Buffer.concat([header, pcmBuffer]);
    }

    /**
     * Higher-level method to generate audio for a given personality.
     * Includes fallback to Google TTS if Gemini fails.
     */
    /**
     * Call the Python backend's edge-tts endpoint for high-quality audio
     */
    async _callPythonTTS(text, gender = 'male', tone = 'normal') {
        try {
            const axios = require('axios');
            const config = require('../config/env');
            const aiServiceUrl = config.AI_SERVICE_URL || 'http://localhost:8000';
            const apiKey = config.BUDDY_API_KEY || '';

            console.log(`[TTS] Proxying to Python edge-tts for text: "${text.substring(0, 30)}..." | Gender: ${gender} | Tone: ${tone}`);
            const response = await axios.post(`${aiServiceUrl}/tts`,
                {
                    text: text,
                    gender: gender,
                    tone: tone
                },
                {
                    headers: { 'X-API-Key': apiKey },
                    responseType: 'arraybuffer'
                }
            );

            return {
                audio: Buffer.from(response.data).toString('base64'),
                voiceName: 'Ryan (edge-tts)'
            };
        } catch (err) {
            console.error('[TTS] Python edge-tts failed:', err.message);
            return null;
        }
    }

    /**
     * Higher-level method to generate audio for a given personality.
     * Includes fallback to Google TTS if Gemini fails.
     */
    async generateAudio(text, gender = 'male', tone = 'normal', language = 'en-US') {
        try {
            const personality = getPersonality(gender, tone);

            // 1. If the voice is 'Ryan' (our new default), use the Python edge-tts service directly
            // This ensures perfect parity with the web version!
            if (personality.voice === 'Ryan') {
                const pyAudio = await this._callPythonTTS(text, gender, tone);
                if (pyAudio) return pyAudio;
                // Fall through if Python fails
            }

            // 2. Try Gemini Live Service (for Aoede, Charon, etc)
            const ai = await this._createSession(personality, language).catch(e => {
                console.warn("[TTS] Gemini Session Failed:", e.message);
                return null;
            });

            if (!ai) {
                // Return null delegates to native client (with pitch/rate) or we could try Google fallback
                console.log("[TTS] Gemini unavailable, trying Google fallback or native...");
                return await this._googleFallback(text, language);
            }

            const audioChunks = [];
            ai.on('audio_delta', (data) => {
                audioChunks.push(Buffer.from(data, 'base64'));
            });

            const success = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 8000);
                ai.on('response_done', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });
                ai.sendText(text);
            });

            ai.disconnect();

            if (success && audioChunks.length > 0) {
                const fullPcm = Buffer.concat(audioChunks);
                const wavData = this._addWavHeader(fullPcm, 24000, 1);
                return {
                    audio: wavData.toString('base64'),
                    voiceName: personality.voice
                };
            }

            return await this._googleFallback(text, language);

        } catch (error) {
            console.error('[TTS] Error in generateAudio:', error.message);
            return null;
        }
    }

    async _googleFallback(text, language) {
        try {
            console.log(`[TTS] Starting Google fallback for: "${text.substring(0, 30)}..." with lang: ${language}`);
            const params = new URLSearchParams({
                ie: 'UTF-8',
                q: text,
                tl: language,
                client: 'tw-ob',
            });
            const url = `https://translate.google.com/translate_tts?${params.toString()}`;
            const axios = require('axios');
            const resp = await axios.get(url, { responseType: 'arraybuffer' });
            return {
                audio: Buffer.from(resp.data).toString('base64'),
                voiceName: `Google Fallback (${language})`
            };
        } catch (e) {
            console.error("[TTS] Google fallback failed:", e.message);
            return null;
        }
    }
}

module.exports = new TTSService();
