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
    async generateAudio(text, gender = 'female', tone = 'soft', language = 'en-US') {
        try {
            const personality = getPersonality(gender, tone);
            const ai = await this._createSession(personality, language).catch(e => {
                console.warn("[TTS] Gemini Session Failed:", e.message);
                return null;
            });

            if (!ai) {
                // Returning null delegates TTS to the Native Frontend/Mobile Client so that Pitch/Prosody are preserved!
                console.log("[TTS] Delegating to native client TTS engine (Gemini unavailable)");
                return null;
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

            console.log("[TTS] Gemini failed to produce audio, delegating to native client TTS...");
            return null;

        } catch (error) {
            console.error('[TTS] Error in generateAudio:', error.message);
            return null;
        }
    }

    async _googleFallback(text, language) {
        try {
            console.log(`[TTS] Starting Google fallback for: "${text.substring(0, 30)}..." with lang: ${language}`);
            const googleTTS = require('google-tts-api');
            const url = googleTTS.getAudioUrl(text, {
                lang: language,
                slow: false,
                host: 'https://translate.google.com'
            });
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
