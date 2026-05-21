const GeminiLiveService = require('./geminiLiveService');
const { getPersonality } = require('../utils/personality');
const Settings = require('../models/Settings');
const { getFallbackKey } = require('../utils/configHelper');

/**
 * ttsService: Generates high-quality AI audio from text.
 * Uses Gemini Live API with voice selection, with retry logic
 * and exponential backoff to handle transient WebSocket failures.
 */
class TTSService {
    constructor() {
        this.activeSessions = new Map();
        this._lastGeminiCallMs = 0;
    }

    /**
     * Internal method to establish a Gemini Live WebSocket connection.
     * Includes a minimum inter-call delay to avoid rapid connection storms.
     */
    async _createSession(personality, language = 'en-US') {
        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        const apiKey = settings?.ai?.geminiApiKey || getFallbackKey('GEMINI_API_KEY');

        if (!apiKey) throw new Error("Gemini API Key for TTS not configured.");

        // Enforce a minimum 500ms gap between WebSocket connections to avoid rate limits
        const now = Date.now();
        const elapsed = now - this._lastGeminiCallMs;
        if (elapsed < 500) {
            await new Promise(r => setTimeout(r, 500 - elapsed));
        }
        this._lastGeminiCallMs = Date.now();

        // Resolve the voice model from Settings
        const activeVoiceStr = settings?.ai?.activeVoiceModel || 'google/gemini-2.5-flash-native-audio-latest';
        const voiceModelName = activeVoiceStr.includes('/') ? activeVoiceStr.split('/')[1] : activeVoiceStr;
        const modelPath = `models/${voiceModelName}`;
        console.log(`[TTS] Creating session with model: ${modelPath}, voice: ${personality.voice}`);

        return new Promise((resolve, reject) => {
            const ai = new GeminiLiveService(apiKey);
            const timeout = setTimeout(() => {
                ai.disconnect();
                reject(new Error("TTS Connection Timeout"));
            }, 10000); // 10s timeout — give WebSocket enough time to handshake

            ai.on('ready', () => {
                clearTimeout(timeout);
                resolve(ai);
            });

            ai.on('error', (err) => {
                console.error("[TTS] Gemini Live WebSocket Error:", err);
                clearTimeout(timeout);
                reject(err);
            });

            ai.on('close', (code, reason) => {
                console.log(`[TTS] Gemini Live WebSocket Closed: Code ${code}, Reason: ${reason}`);
                clearTimeout(timeout);
                reject(new Error(`TTS Connection Closed: ${code} - ${reason}`));
            });

            ai.connect(null, personality.voice, false, modelPath);
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
     * Attempt a single Gemini TTS generation. Returns { audio, format, voiceName } or null.
     */
    async _tryGeminiGeneration(text, personality, language) {
        const ai = await this._createSession(personality, language).catch(e => {
            console.warn("[TTS] Gemini Session Failed:", e.message);
            return null;
        });

        if (!ai) return null;

        const audioChunks = [];
        ai.on('audio_delta', (data) => {
            audioChunks.push(Buffer.from(data, 'base64'));
        });

        const success = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 8000); // 8s for audio generation
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
                format: 'wav',
                voiceName: personality.voice
            };
        }

        return null;
    }

    /**
     * Higher-level method to generate audio for a given personality.
     * Uses Gemini Live with up to 2 retries before falling to Google TTS.
     */
    async generateAudio(text, gender = 'male', tone = 'normal', language = 'en-US', voiceId = null) {
        try {
            // Shallow copy to avoid modifying the global PERSONALITIES object
            const personality = { ...getPersonality(gender, tone) };
            
            if (voiceId) {
                personality.voice = voiceId;
            }

            // Try Gemini Live with retries (up to 2 attempts)
            const MAX_RETRIES = 2;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                console.log(`[TTS] Gemini attempt ${attempt}/${MAX_RETRIES} for voice: ${personality.voice}`);
                const result = await this._tryGeminiGeneration(text, personality, language);
                if (result) {
                    console.log(`[TTS] ✅ Gemini succeeded on attempt ${attempt} | Voice: ${result.voiceName}`);
                    return result;
                }

                // Brief delay before retry (exponential backoff: 500ms, 1500ms)
                if (attempt < MAX_RETRIES) {
                    const delay = 500 * attempt;
                    console.log(`[TTS] Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            // All Gemini attempts failed — fall back to Google Translate TTS
            console.log("[TTS] All Gemini attempts failed, trying Google fallback...");
            return await this._googleFallback(text, language);

        } catch (error) {
            console.error('[TTS] Error in generateAudio:', error.message);
            return null;
        }
    }

    async _googleFallback(text, language) {
        try {
            console.log(`[TTS] Starting Google fallback for: "${text.substring(0, 30)}..." with lang: ${language}`);
            const query = new URLSearchParams({
                ie: 'UTF-8',
                q: text.slice(0, 200),
                tl: language,
                client: 'tw-ob'
            });
            const url = `https://translate.google.com/translate_tts?${query.toString()}`;
            const axios = require('axios');
            const resp = await axios.get(url, { responseType: 'arraybuffer' });
            return {
                audio: Buffer.from(resp.data).toString('base64'),
                format: 'mp3',  // Google Translate returns MP3
                voiceName: `Google Fallback (${language})`
            };
        } catch (e) {
            console.error("[TTS] Google fallback failed:", e.message);
            return null;
        }
    }
}

module.exports = new TTSService();
