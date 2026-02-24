const nluService = require('../services/nluService');
const geminiService = require('../services/geminiService');
const contextService = require('../services/contextService');
const Reminder = require('../models/Reminder');
const { createGoogleCalendarEvent } = require('../services/googleCalendarService');
const GeminiLiveService = require('../services/geminiLiveService');

/**
 * Buddy 2.0 Voice Controller
 * Orchestrates the full NLU -> Context -> Response flow
 */
exports.processVoice = async (req, res) => {
    try {
        const startTime = Date.now();
        const { text, image = null, language = 'auto', conversationId = null, timeZone = 'UTC' } = req.body;
        const userId = req.user?._id;

        console.log('--- [VoiceV2 Request Start] ---');
        console.log('Body:', JSON.stringify(req.body));
        console.log('User ID:', userId);
        console.log('Auth Header:', req.headers.authorization ? 'Present' : 'Missing');

        if (!text) {
            return res.status(400).json({ success: false, message: "No text captured." });
        }

        console.log(`[VoiceV2] Processing via Gemini: "${text}" for user ${userId} (TimeZone: ${timeZone})`);

        // 1. Get Context (Step 5)
        const contextStartTime = Date.now();
        const context = await contextService.getContext(userId, conversationId, timeZone);
        console.log(`[VoiceV2] Context retrieved in ${Date.now() - contextStartTime}ms`);

        // 2. Generate Response (Steps 4 & 6)
        console.log('[VoiceV2] Calling Gemini Service...');
        const aiStartTime = Date.now();
        const aiResponse = await geminiService.generateResponse(text, userId, context, language, image);
        console.log(`[VoiceV2] AI response generated in ${Date.now() - aiStartTime}ms`);

        // 3. Save Context (Step 5)
        const saveStartTime = Date.now();
        const updatedConversationId = await contextService.saveInteraction(
            userId,
            conversationId,
            text,
            aiResponse.reply
        );
        console.log(`[VoiceV2] Interaction saved in ${Date.now() - saveStartTime}ms`);

        console.log(`[VoiceV2] TOTAL processing time: ${Date.now() - startTime}ms`);

        // 4. Return result (ready for Steps 7 & 8 on frontend)
        res.status(200).json({
            success: true,
            data: aiResponse,
            meta: {
                conversationId: updatedConversationId,
                language: language
            }
        });

    } catch (error) {
        console.error('[VoiceV2] Fatal Error:', error);
        res.status(500).json({ success: false, message: "Internal processing error." });
    }
};

/**
 * Keep the existing reminder saving logic for compatibility
 */
exports.saveReminder = async (req, res) => {
    try {
        const { reminderData, saveTo } = req.body;
        const userId = req.user?._id;

        console.log('--- [SaveReminder Request] ---');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('User ID:', userId);

        if (!userId) {
            console.warn('[SaveReminder] No userId found in request!');
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        let googleEventId = null;
        if (saveTo === 'google' || saveTo === 'both') {
            try {
                console.log('[SaveReminder] Attempting Google Calendar Sync...');
                googleEventId = await createGoogleCalendarEvent(userId, reminderData);
                console.log('[SaveReminder] Google Event Created:', googleEventId);
            } catch (err) {
                console.error("[SaveReminder] Google Calendar Sync failed:", err.message);
                // We continue saving to Buddy even if Google fails
            }
        }

        console.log('[SaveReminder] Saving to DB...');
        const reminder = await Reminder.create({
            userId,
            ...reminderData,
            googleEventId,
            source: googleEventId ? 'google' : 'buddy'
        });

        console.log('[SaveReminder] Successfully saved to DB:', reminder._id);
        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        console.error('[SaveReminder] Fatal Error:', error);
        res.status(500).json({ success: false, message: "Failed to save reminder.", error: error.message });
    }
};

/**
 * Preview Voice Assistant Personality
 */
exports.previewVoice = async (req, res) => {
    try {
        const { gender = 'female', tone = 'soft' } = req.query;

        // Map to voice name
        let voiceName = 'Aoede'; // Default
        if (gender === 'male') {
            if (tone === 'soft') voiceName = 'Charon';
            else if (tone === 'energetic') voiceName = 'Fenrir';
            else voiceName = 'Puck';
        } else {
            if (tone === 'energetic') voiceName = 'Kore';
            else voiceName = 'Aoede';
        }

        console.log(`[Preview] Generating preview for voice: ${voiceName} (${gender}, ${tone})`);

        const ai = new GeminiLiveService(process.env.GEMINI_API_KEY);
        let audioChunks = [];
        let isDone = false;

        const cleanup = () => {
            ai.disconnect();
            ai.removeAllListeners();
        };

        const timeout = setTimeout(() => {
            if (!isDone) {
                isDone = true;
                cleanup();
                res.status(504).json({ success: false, message: "Voice preview timed out." });
            }
        }, 15000); // 15s timeout

        ai.on('audio_delta', (base64) => {
            if (!isDone) {
                console.log(`[Preview] Received audio chunk: ${base64.length} bytes`);
                audioChunks.push(Buffer.from(base64, 'base64'));
            }
        });

        ai.on('error', (err) => {
            console.error('[Preview] AI Error:', err);
            if (!isDone) {
                isDone = true;
                clearTimeout(timeout);
                cleanup();
                res.status(500).json({ success: false, message: "AI connection error." });
            }
        });

        ai.on('response_done', () => {
            if (!isDone) {
                isDone = true;
                clearTimeout(timeout);
                cleanup();

                // Concatenate buffers and convert back to base64
                const fullAudio = Buffer.concat(audioChunks).toString('base64');

                res.status(200).json({
                    success: true,
                    audio: fullAudio,
                    voiceName
                });
            }
        });

        ai.on('ready', () => {
            console.log('[Preview] Socket ready, waiting for setup...');
        });

        ai.on('setup_complete', () => {
            console.log('[Preview] Setup complete, sending preview text...');
            let phrase = "Hi there! I am Buddy, your personal assistant. This is a sample of how I will sound.";
            if (tone === 'soft') {
                phrase = "Hello there. I am Buddy, your personal assistant. I will speak softly and calmly. This is a sample of my voice.";
            } else if (tone === 'energetic') {
                phrase = "Hi there! I am Buddy, your personal assistant! I'm super excited to help you out! This is a sample of how I'll sound!";
            }
            ai.sendText(phrase);
        });

        let toneRule = "Speak with a balanced, clear, and professional tone.";
        if (tone === 'soft') {
            toneRule = "Speak softly, using gentle, empathetic language to convey a comforting and calm presence.";
        } else if (tone === 'energetic') {
            toneRule = "Speak energetically, using lively, enthusiastic language with a fast-paced, high-spirited attitude.";
        }
        ai.connect(`You are Buddy, a friendly health assistant. ${toneRule} Keep it very short.`, voiceName);

    } catch (error) {
        console.error('[Preview] Error:', error);
        res.status(500).json({ success: false, message: "Failed to generate voice preview." });
    }
};
