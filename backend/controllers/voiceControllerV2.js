const nluService = require('../services/nluService');
const geminiService = require('../services/geminiService');
const contextService = require('../services/contextService');
const Reminder = require('../models/Reminder');
const { createGoogleCalendarEvent } = require('../services/googleCalendarService');
const GeminiLiveService = require('../services/geminiLiveService');
const ttsService = require('../services/ttsService');
const User = require('../models/User');
// const { geocodeAddress } = require('../services/smartReminderService'); // Moved inside function to avoid circular dependency

const { getPersonality } = require('../utils/personality');

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

        // 3. Save Context & Generate Audio in Parallel
        const processingStartTime = Date.now();
        const [updatedConversationId, ttsResult] = await Promise.all([
            contextService.saveInteraction(userId, conversationId, text, aiResponse.reply),
            (async () => {
                const voicePrefs = context.userContext?.voicePreferences || { gender: 'female', tone: 'soft' };
                try {
                    return await ttsService.generateAudio(aiResponse.reply, voicePrefs.gender, voicePrefs.tone);
                } catch (err) {
                    console.warn('[VoiceV2] TTS Generation failed:', err.message);
                    return { audio: null };
                }
            })()
        ]);

        const audio = ttsResult?.audio || null;
        console.log(`[VoiceV2] Post-AI processing (Save + TTS) completed in ${Date.now() - processingStartTime}ms`);

        console.log(`[VoiceV2] TOTAL processing time: ${Date.now() - startTime}ms`);

        // 5. Return result (ready for Steps 7 & 8 on frontend)
        res.status(200).json({
            success: true,
            data: {
                ...aiResponse,
                audio: audio
            },
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
        let { reminderData, saveTo } = req.body;
        const userId = req.user?._id;

        console.log('--- [SaveReminder Request] ---');
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('User ID:', userId);

        if (!userId) {
            console.warn('[SaveReminder] No userId found in request!');
            return res.status(401).json({ success: false, message: "User not authenticated." });
        }

        // AUTO-GEOCODE: If location is provided but coordinates are missing, 
        // try to geocode it on the backend as a safety net
        if (reminderData.location && (!reminderData.coordinates?.lat || !reminderData.coordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../services/smartReminderService');
                const coords = await geocodeAddress(reminderData.location);
                if (coords) {
                    reminderData.coordinates = coords;
                    console.log('[SaveReminder] Auto-geocoded location:', coords);
                }
            } catch (err) {
                console.warn('[SaveReminder] Auto-geocoding failed:', err.message);
            }
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
        const userPrefs = req.user?.voicePreferences || {};
        const gender = req.query.gender || userPrefs.gender || 'female';
        const tone = req.query.tone || userPrefs.tone || 'soft';
        const text = req.query.text || "Hi! I am Buddy. I am ready to help you.";

        const result = await ttsService.generateAudio(text, gender, tone);

        res.status(200).json({
            success: true,
            audio: result.audio,
            voiceName: result.voiceName
        });

    } catch (error) {
        console.error('[Preview] Error:', error);
        res.status(500).json({ success: false, message: error.message || "Failed to generate voice preview." });
    }
};
