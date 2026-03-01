const axios = require('axios');
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

        // 1. Get Context and Voice Prefs (Parallelized)
        const [context, user] = await Promise.all([
            contextService.getContext(userId, conversationId, timeZone),
            userId ? User.findById(userId).select('voicePreferences') : Promise.resolve(null)
        ]);

        // 2. Generate AI Response
        const aiResponse = await geminiService.generateResponse(text, userId, context, language, image);

        // 3. Save Interaction and return immediately (Client uses High-Speed Local TTS)
        const updatedConversationId = await (userId ? contextService.saveInteraction(userId, conversationId, text, aiResponse.reply) : Promise.resolve(conversationId));

        const audio = null; // Disable server-side TTS wait for "Very Very Fast" response speed


        // 4. Return result
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
        console.error('[Voice] Error:', error);
        res.status(500).json({ success: false, message: "Voice processing failed.", error: error.message });
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
        if (req.user.googleRefreshToken) {
            try {
                console.log('[SaveReminder] Automatic Google Sync Triggered...');
                googleEventId = await createGoogleCalendarEvent(userId, reminderData);
                console.log('[SaveReminder] Google Event Created:', googleEventId);
            } catch (err) {
                console.error("[SaveReminder] Google Calendar Sync failed:", err.message);
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
        const language = req.query.language || 'en-US';
        const text = req.query.text || "Hi! I am Buddy. I am ready to help you.";

        const result = await ttsService.generateAudio(text, gender, tone, language);

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

/**
 * Get 3 local current affairs points based on location
 */
exports.getLocalNews = async (req, res) => {
    try {
        let lat = req.query.lat;
        let lon = req.query.lon;
        let userId = req.user?._id;

        // Fallback to user profile location if not provided in query
        if ((!lat || !lon) && userId) {
            const user = await User.findById(userId);
            if (user && user.currentLocation) {
                lat = user.currentLocation.lat;
                lon = user.currentLocation.lng;
            }
        }

        let cityStr = "your location";
        if (lat && lon) {
            try {
                const geoRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                    headers: { 'User-Agent': 'HeyBuddy-Health-Assistant/1.0' }
                });
                const geoData = geoRes.data;
                cityStr = geoData.address?.city || geoData.address?.town || geoData.address?.village || geoData.address?.state || "your area";
            } catch (err) {
                console.warn("[News] Geo failed:", err.message);
            }
        }

        // Use Gemini to get 3 interesting local/regional news points
        const prompt = `Act as a news curator for ${cityStr}. Provide exactly 3 short, interesting current affairs or news points (max 12 words each) relevant to this location or its region. Format them as an array of strings. Ensure they are recent (around February 2026). Include emojis.`;

        const aiResponse = await geminiService.generateResponse(prompt, userId, { userContext: { timeZone: 'Asia/Kolkata' } });

        // Match only strings that look like news (Gemini might return a list)
        let news = [];
        try {
            // Very basic extraction if Gemini doesn't return clean array
            const textLines = aiResponse.reply.split('\n').filter(l => l.trim().length > 5);
            news = textLines.slice(0, 3).map(l => l.replace(/^\d+\.\s*/, '').replace(/^- \s*/, '').trim());
        } catch (e) {
            news = ["Local weather updates for your area today 🌤️", "Upcoming cultural events in your city center 🎭", "New infrastructure developments ongoing nearby 🚧"];
        }

        res.status(200).json({ success: true, city: cityStr, news });
    } catch (error) {
        console.error('[News] Error:', error);
        res.status(500).json({ success: false, message: "Failed to fetch local news." });
    }
};
