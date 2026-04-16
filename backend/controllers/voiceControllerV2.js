const axios = require('axios');
const contextService = require('../services/contextService');
const aiController = require('./ai/aiController');
const Reminder = require('../models/Reminder');
const LocationReminder = require('../models/LocationReminder');
const { createGoogleCalendarEvent } = require('../services/googleCalendarService');
const GeminiLiveService = require('../services/geminiLiveService');
const ttsService = require('../services/ttsService');
const User = require('../models/User');
// const { geocodeAddress } = require('../services/smartReminderService'); // Moved inside function to avoid circular dependency

const { getPersonality } = require('../utils/personality');
const geminiService = require('../services/geminiService');
const config = require('../config/env');
const mongoose = require('mongoose'); // Added for ObjectId operations

/**
 * Buddy 2.0 Voice Controller
 * Orchestrates the full NLU -> Context -> Response flow
 */
exports.processVoice = async (req, res) => {
    try {
        const startTime = Date.now();
        const { text, image = null, language = 'auto', conversationId = null, timeZone = 'UTC' } = req.body;

        // Use req.user._id if available, else fall back to req.decodedUserId (valid JWT but user not in this DB)
        // This prevents the Python AI from treating a JWT-verified user as a guest just because
        // their account doesn't exist in this specific DB instance (e.g. staging APK + prod account)
        const userId = req.user?._id || req.decodedUserId || null;
        const userFound = !!req.user;
        const isTokenVerifiedUser = !!userId && !req.user; // JWT valid but no DB record

        console.log(`[VoiceV2] Request from User: ${userId} | DB Found: ${userFound} | Token-Only: ${isTokenVerifiedUser}`);

        const logBody = { ...req.body };
        if (logBody.image) logBody.image = '[BASE64_IMAGE_DATA_OMITTED]';
        console.log('Body:', JSON.stringify(logBody));

        if (!text) {
            return res.status(400).json({ success: false, message: "No text captured." });
        }

        console.log(`[VoiceV2] Processing via Gemini: "${text}" for user ${userId} (TimeZone: ${timeZone})`);

        // 1. Get Context and Voice Prefs + AI Config
        // OPTIMIZATION: Use req.user (already fetched by middleware) to avoid round-trips
        const [context, aiConfig] = await Promise.all([
            contextService.getContext(userId, conversationId, timeZone, req.user),
            aiController.getAiConfig()
        ]);

        const user = req.user;

        // Build an authoritative context string for the AI (used for tool calls like UPDATE_REMINDER)
        let memoryString = "=== AUTHORITATIVE USER CONTEXT ===\n";

        if (context.userContext && context.userContext.localDate) {
            memoryString += `Current User Date: ${context.userContext.localDate}\n`;
            memoryString += `Time Zone: ${context.userContext.timeZone}\n\n`;
        }

        if (context.memories && context.memories.length > 0) {
            memoryString += "Saved Memories & Facts:\n";
            context.memories.forEach(m => {
                memoryString += `- [ID: ${m.id}] [Category: ${m.category}] ${m.content}\n`;
            });
            memoryString += "\n";
        }

        const userPrefs = user?.voicePreferences || {};
        const gender = userPrefs.gender || 'male';
        const tone = userPrefs.tone || 'normal';

        // 1.5. Build Reminders Context for AI
        let reminderString = "";
        if (context.reminders && context.reminders.length > 0) {
            reminderString += "Upcoming Reminders (Time & Location based):\n";
            context.reminders.forEach(r => {
                const label = r.type === 'location' ? 'Location-based Task' : 'Time-based Task';
                const locInfo = r.location ? ` (at ${r.location})` : '';
                const dateTime = (r.date || r.time) ? `${r.date || ''} ${r.time || ''}` : '[Whenever I arrive]';
                reminderString += `- ${label}: ${r.title}${locInfo} scheduled for ${dateTime} [ID: ${r.id}]\n`;
            });
            reminderString += "\n";
        } else {
            reminderString += "No upcoming reminders scheduled.\n\n";
        }

        // 2. Generate AI Response via Python Gateway
        let aiResponse = { reply: "I'm sorry, I'm having trouble thinking right now.", type: 'chat' };
        let sessionIdRes = conversationId;
        let audio = null; // To be populated from Python

        try {
            const aiServiceUrl = config.AI_SERVICE_URL;
            console.log(`[VoiceV2] Proxying to Python Brain: ${aiServiceUrl}/chat/realtime | Gender: ${gender} | Tone: ${tone}`);
            const pythonResponse = await axios.post(`${aiServiceUrl}/chat/realtime`, {
                message: text,
                session_id: conversationId || null,
                tts: true, // REQUEST RYAN AUDIO!
                api_key: aiConfig.apiKey,
                provider: aiConfig.provider,
                model: aiConfig.model,
                userId: userId ? userId.toString() : null,
                memory_context: memoryString + reminderString, // Include reminders + IDs in context!
                gender: gender,
                tone: tone
            }, {
                headers: { 'X-API-Key': config.BUDDY_API_KEY },
                timeout: 30000
            }); // 30s timeout for deep search

            if (pythonResponse.data && pythonResponse.data.response) {
                aiResponse = {
                    reply: pythonResponse.data.response,
                    type: pythonResponse.data.type || 'chat',
                    screen: pythonResponse.data.screen || null
                };
                sessionIdRes = pythonResponse.data.session_id;
                audio = pythonResponse.data.audio; // CAPTURE THE RYAN VOICE
                console.log(`[VoiceV2] Python Brain Replied with Audio: ${aiResponse.reply.substring(0, 50)}...`);
            }
        } catch (e) {
            console.error('[VoiceV2] Error connecting to Python AI Service:', e.message);
            // Fallback: If Python fails, use a gentle message
            aiResponse = {
                reply: "I'm having a little trouble connecting to my deep search brain. I can still help with your basics though!",
                type: 'chat'
            };
        }

        // 3. Save Interaction 
        const updatedConversationId = await (userId ? contextService.saveInteraction(userId, sessionIdRes, text, aiResponse.reply) : Promise.resolve(sessionIdRes));

        // 4. Fallback Audio generation ONLY if Python didn't provide it
        if (!audio) {
            try {
                const userPrefs = user?.voicePreferences || {};
                const gender = userPrefs.gender || 'male'; // Default to male
                const tone = userPrefs.tone || 'soft';
                const ttsResult = await ttsService.generateAudio(aiResponse.reply, gender, tone, language);
                if (ttsResult && ttsResult.audio) {
                    audio = ttsResult.audio;
                }
            } catch (audioErr) {
                console.warn('[VoiceV2] Local fallback audio failed:', audioErr.message);
            }
        }


        // 4. Return result
        const prefs = user?.voicePreferences || { gender: 'male', tone: 'normal' };
        const platform = req.headers['x-platform'] || 'web';

        res.status(200).json({
            success: true,
            data: {
                ...aiResponse,
                audio: audio,
                resolvedVoiceConfig: require('../utils/personality').resolveVoiceConfig(prefs, platform)
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
                const User = require('../models/User');
                const user = await User.findById(userId);
                const coords = await geocodeAddress(reminderData.location, user?.currentLocation);
                if (coords) {
                    reminderData.coordinates = coords;
                    console.log('[SaveReminder] Auto-geocoded location:', coords);
                }
            } catch (err) {
                console.warn('[SaveReminder] Auto-geocoding failed:', err.message);
            }
        }

        const reminderType = String(reminderData?.reminderType || '').toLowerCase();
        const timeStr = String(reminderData?.time || '');
        const looksLikeArrivalTrigger = /whenever|arrive/i.test(timeStr);
        const shouldSaveAsLocationReminder =
            reminderType === 'location' || looksLikeArrivalTrigger;

        if (shouldSaveAsLocationReminder) {
            if (!reminderData?.title || !reminderData?.location) {
                return res.status(400).json({
                    success: false,
                    message: "Location reminders require at least a title and a location."
                });
            }

            const allowedStatuses = new Set(['on_track', 'risk_alert', 'completed', 'cancelled']);
            const incomingStatus = String(reminderData?.status || '').toLowerCase();

            // Save geo-trigger rules in the dedicated LocationReminder collection so
            // they show up under the Location Reminders UI (web + mobile).
            const reminder = await LocationReminder.create({
                userId,
                title: reminderData.title,
                description: reminderData.description || reminderData.notes || '',
                location: reminderData.location,
                coordinates: reminderData.coordinates || { lat: null, lng: null },
                date: reminderData.date || '',
                time: reminderData.time || '',
                status: allowedStatuses.has(incomingStatus) ? incomingStatus : 'on_track',
                warningLevel: reminderData.warningLevel || 'medium',
                bufferTime: reminderData.bufferTime ?? 15,
                notifyPhone: reminderData.notifyPhone ?? true,
                notifyFamily:
                    reminderData.notifyFamily ?? reminderData.alerts?.notifyFamily ?? false,
                notifyEmergency:
                    reminderData.notifyEmergency ?? reminderData.alerts?.notifyEmergency ?? false,
                notifyEmail: true,
                earlyWarningSet:
                    reminderData.earlyWarningSet ?? reminderData.smartFeatures?.earlyWarning ?? true,
                trafficAware:
                    reminderData.trafficAware ?? reminderData.smartFeatures?.trafficAware ?? true,
                itemExitGuards:
                    reminderData.itemExitGuards ?? reminderData.smartFeatures?.itemExitGuards ?? true,
                geofenceRadius: reminderData.geofenceRadius ?? 500
            });

            console.log('[SaveReminder] Saved location reminder to DB:', reminder._id);
            return res.status(201).json({ success: true, data: reminder });
        }

        // Default: time-based reminders live in the Reminder collection.
        const normalizedReminderType =
            reminderType === 'contact' ? 'contact' : 'time';

        const reminder = await Reminder.create({
            userId,
            ...reminderData,
            reminderType: normalizedReminderType
        });

        // Background Google Calendar Sync
        const { syncReminder } = require('../services/googleCalendarService');
        syncReminder(req.user, reminder).then(async (googleEventId) => {
            if (googleEventId) {
                await Reminder.findByIdAndUpdate(reminder._id, {
                    googleEventId,
                    source: 'google'
                });
                console.log(`[SaveReminder] Updated with Google Event ID: ${googleEventId}`);
            }
        }).catch(err => console.error('[SaveReminder] Background sync error:', err));


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
        const gender = req.query.gender || userPrefs.gender || 'male';
        const tone = req.query.tone || userPrefs.tone || 'normal';
        const language = req.query.language || 'en-US';
        const text = req.query.text || "Hi! I am Buddy. I am ready to help you.";
        const platform = req.headers['x-platform'] || 'web';

        // 1. Properly map tone to a distinct configuration in the backend
        let pitch = 1.0;
        let speechRate = platform === 'mobile' ? 0.5 : 1.0;

        if (gender === 'male') { pitch = 0.8; } else { pitch = 1.1; }
        if (tone === 'soft') { speechRate = platform === 'mobile' ? 0.4 : 0.85; pitch -= 0.1; }
        else if (tone === 'energetic') { speechRate = platform === 'mobile' ? 0.6 : 1.15; pitch += 0.1; }

        const resolvedConfig = { pitch, speechRate };

        // 2. Try TTS Service for high quality server audio, but if it fails, the config is still sent!
        let result = null;
        try {
            result = await ttsService.generateAudio(text, gender, tone, language);
        } catch (e) {
            console.warn('[Preview] TTS failed, falling back to client native synthesis', e.message);
        }

        res.status(200).json({
            success: true,
            audio: result ? result.audio : null,
            voiceName: result ? result.voiceName : 'Native Voice',
            resolvedVoiceConfig: resolvedConfig
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

        // Use Gemini to get 3 interesting points (all local)
        const prompt = `Act as a news curator for ${cityStr}. Provide exactly 3 short, interesting news points (max 12 words each) relevant to ${cityStr} or its surrounding region ONLY.
        
        You must return EXACTLY 3 lines of text, one point per line, with no bullet points, no markdown, NO EMOJIS, and absolutely no conversational filler. Do not apologize. Use your web_search tool to ensure these are real, current headlines for today. Focus exclusively on ${cityStr}.`;

        const aiResponse = await geminiService.generateResponse(prompt, userId, { userContext: { timeZone: 'Asia/Kolkata' } });

        // Match only strings that look like news (Gemini might return a list)
        let news = [];
        try {
            // Strip any markdown blocks and split by new lines
            const cleanReply = aiResponse.reply.replace(/```(json)?/gi, '').replace(/[\[\]]/g, '');
            const textLines = cleanReply.split('\n').filter(l => l.trim().length > 5);
            news = textLines.slice(0, 3).map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').replace(/^["']|["']$/g, '').trim());

            // If the AI apologized or failed to generate 3 points, force the fallback
            if (news.length === 0 || news[0].toLowerCase().includes("sorry") || news[0].toLowerCase().includes("unable") || news[0].toLowerCase().includes("as an ai")) {
                throw new Error("AI returned apology or failure message");
            }
        } catch (e) {
            const displayPlace = (cityStr === 'your location' || cityStr === 'your area') ? 'your area' : cityStr;
            news = [
                `Local weather updates for ${displayPlace} today`, 
                `Upcoming cultural events in ${displayPlace}`, 
                `New infrastructure developments ongoing near ${displayPlace}`
            ];
        }

        res.status(200).json({ success: true, city: cityStr, news });
    } catch (error) {
        console.error('[News] Error:', error);
        res.status(500).json({ success: false, message: "Failed to fetch local news." });
    }
};
