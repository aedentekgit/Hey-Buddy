const axios = require('axios');
const config = require('../../config/env');
const Settings = require('../../models/Settings');
const Memory = require('../../models/Memory');
const User = require('../../models/User');
const { getContext } = require('../../services/contextService');
const reminderController = require('../reminderController');
const locationReminderController = require('../locationReminderController');
const recordController = require('../recordController');

let cachedAiConfig = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds

const getAiConfig = async () => {
    const now = Date.now();
    if (cachedAiConfig && (now - lastCacheTime < CACHE_DURATION_MS)) {
        return cachedAiConfig;
    }

    const settings = await Settings.findOne().select('+ai.geminiApiKey +ai.openaiApiKey +ai.claudeApiKey +ai.deepseekApiKey +ai.groqApiKey');

    // Defaults
    const aiConfig = {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini'
    };

    if (!settings || !settings.ai) return aiConfig;

    const aiSettings = settings.ai;
    const activeModelStr = aiSettings.activeModel || 'openai/gpt-4o-mini';
    const [provider, modelName] = activeModelStr.split('/');

    aiConfig.provider = provider || 'openai';
    // Strip OpenRouter-style ":free"/":latest" suffixes and fix deprecated model names
    let resolvedModel = (modelName || 'gpt-4o-mini').split(':')[0];
    // Allow newer models to pass through without being downgraded to 1.5
    const MODEL_ALIASES = {
        'gemini-flash-1.5-8b': 'gemini-1.5-flash-8b',
        'gemini-pro-latest': 'gemini-1.5-pro',
    };
    if (MODEL_ALIASES[resolvedModel]) resolvedModel = MODEL_ALIASES[resolvedModel];
    aiConfig.model = resolvedModel;

    // Map to the correct key from Database
    if ((aiConfig.provider === 'openai' || aiConfig.provider === 'openai') && aiSettings.openaiApiKey) {
        aiConfig.apiKey = aiSettings.openaiApiKey;
    } else if ((aiConfig.provider === 'gemini' || aiConfig.provider === 'google') && aiSettings.geminiApiKey) {
        aiConfig.apiKey = aiSettings.geminiApiKey;
    } else if (aiConfig.provider === 'groq' && aiSettings.groqApiKey) {
        aiConfig.apiKey = aiSettings.groqApiKey;
    } else if ((aiConfig.provider === 'anthropic' || aiConfig.provider === 'claude') && aiSettings.claudeApiKey) {
        aiConfig.apiKey = aiSettings.claudeApiKey;
    } else if (aiConfig.provider === 'deepseek' && aiSettings.deepseekApiKey) {
        aiConfig.apiKey = aiSettings.deepseekApiKey;
    }
    
    // Attach all available keys for Omni-Fallback
    aiConfig.allKeys = {
        groq: aiSettings.groqApiKey || null,
        gemini: aiSettings.geminiApiKey || null,
        openai: aiSettings.openaiApiKey || null,
        claude: aiSettings.claudeApiKey || null,
        deepseek: aiSettings.deepseekApiKey || null
    };

    // Voice Config Integration - Default to Gemini 2.0 Flash for Live Voice Support
    const activeVoiceStr = aiSettings.activeVoiceModel || 'google/gemini-2.0-flash-exp';
    const [voiceProvider, voiceModelName] = activeVoiceStr.split('/');

    aiConfig.voiceProvider = voiceProvider || 'google';
    aiConfig.voiceModel = voiceModelName || 'gemini-1.5-flash';

    // Voice API Key Mapping
    if (aiConfig.voiceProvider === 'google') {
        aiConfig.voiceApiKey = aiSettings.geminiApiKey || process.env.GEMINI_API_KEY;
    }

    // Always include Groq key as fallback (used by Python when primary provider fails)
    aiConfig.groqApiKey = aiSettings.groqApiKey || process.env.GROQ_API_KEY || null;

    cachedAiConfig = aiConfig;
    lastCacheTime = now;

    return aiConfig;
};

exports.getAiConfig = getAiConfig;

exports.proxyChatToPython = async (req, res) => {
    let pythonEndpoint = '';
    try {
        const { message, session_id, tts } = req.body;

        // Use req.user._id if found in DB, else use decoded JWT userId as fallback
        const isGuest = !req.user;
        const userId = req.user ? req.user._id : (req.decodedUserId || `guest_session_${Date.now()}`);

        const requestPath = req.path;
        const isStream = requestPath.includes('stream');
        const isRealtime = requestPath.includes('realtime');

        // --- Guest Gate: Enforce Login for Memory/Location, allow news ---
        if (isGuest) {
            const lowerMsg = (message || "").toLowerCase();
            const memoryKeywords = ['remember', 'memory', 'remind', 'reminder', 'forget', 'fact', 'history'];
            const locationKeywords = ['location', 'where', 'nearby', 'near me', 'traffic', 'direction', 'place', 'map'];
            const newsKeywords = ['news', 'headline', 'world', 'global', 'current event', 'updates', 'weather', 'info', 'happening', 'infrastructure', 'infra'];

            const isMemory = memoryKeywords.some(k => lowerMsg.includes(k));
            const isLocation = locationKeywords.some(k => lowerMsg.includes(k));
            const isNews = newsKeywords.some(k => lowerMsg.includes(k));

            if ((isMemory || isLocation) && !isNews) {
                const reply = "I'd love to help with your personal memories and location-aware features! However, these features require you to be signed in so I can keep your data secure and personalized. Please sign in to continue.";
                if (isStream) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.write(`data: ${JSON.stringify({ chunk: reply, success: true })}\n\n`);
                    res.end();
                    return;
                }
                return res.status(200).json({ success: true, message: reply });
            }
        }

        // Use a namespaced session key: never use raw userId as session_id, as this
        // can cause cross-user session collisions in the Python AI service.
        const finalSessionId = session_id || `user_${userId.toString()}`;
        const aiServiceUrl = config.AI_SERVICE_URL;

        console.log(`[AI Gateway] Incoming Request: ${requestPath} | Stream: ${isStream} | Realtime: ${isRealtime}`);

        const gatewayStart = Date.now();
        // 1. Parallelize Data Fetching (PROMISE.ALL) - Saves ~200-400ms
        const [aiConfig, context, userDetails] = await Promise.all([
            getAiConfig(),
            getContext(userId, session_id),
            User.findById(userId).select('voicePreferences')
        ]);
        const dataFetchTime = Date.now() - gatewayStart;
        console.log(`[LATENCY-PROFILER] Data Fetching (DB/Config): ${dataFetchTime}ms`);

        // 2. FORCED LATENCY OVERRIDE: If using Groq or if it's a TTS stream, force the fastest model
        if (tts && aiConfig.allKeys && aiConfig.allKeys.groq) {
            console.log('[AI Gateway] Speed Optimization: Forcing Groq llama-3.1-8b-instant for Voice/TTS Stream');
            aiConfig.provider = 'groq';
            aiConfig.model = 'llama-3.1-8b-instant';
            aiConfig.apiKey = aiConfig.allKeys.groq;
        } else if (aiConfig.provider === 'groq' && aiConfig.model.includes('70b')) {
            console.log('[AI Gateway] Speed Optimization: Forcing llama-3.1-8b-instant over slow 70b model');
            aiConfig.model = 'llama-3.1-8b-instant';
        }

        if (!aiConfig.apiKey) {
            console.warn('[AI Gateway] AI API Key is missing for provider:', aiConfig.provider);
            return res.status(400).json({ success: false, message: 'AI API Key is not configured in settings.' });
        }

        // Map to the correct Python endpoint
        pythonEndpoint = `${aiServiceUrl}/chat`;
        if (isRealtime && isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime/stream`;
        } else if (isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/stream`;
        } else if (isRealtime) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime`;
        } else if (requestPath.includes('consensus')) {
            pythonEndpoint = `${aiServiceUrl}/chat/consensus`;
        }

        console.log(`[AI Gateway] Forwarding to Python | Provider: ${aiConfig.provider} | Model: ${aiConfig.model}`);

        // 3. Build an authoritative context string for the AI
        let memoryString = "=== AUTHORITATIVE USER CONTEXT ===\n";

        // Current Local Date/Time (Critical for time-aware reminders)
        if (context.userContext && context.userContext.localDate) {
            memoryString += `Current User Date: ${context.userContext.localDate}\n`;
            memoryString += `Time Zone: ${context.userContext.timeZone}\n\n`;
        }

        // Reminders Section
        if (context.reminders && context.reminders.length > 0) {
            memoryString += "Upcoming Reminders (Time & Location based):\n";
            context.reminders.forEach(r => {
                const label = r.type === 'location' ? 'Location-based Task' : 'Time-based Task';
                const locInfo = r.location ? ` (at ${r.location})` : '';
                const dateTime = (r.date || r.time) ? `${r.date || ''} ${r.time || ''}` : '[Whenever I arrive]';
                // Include ID at the end for technical use only
                memoryString += `- ${label}: ${r.title}${locInfo} scheduled for ${dateTime} [ID: ${r.id}]\n`;
            });
            memoryString += "\n";
        } else {
            memoryString += "No upcoming reminders scheduled.\n\n";
        }

        // Memories Section
        if (context.memories && context.memories.length > 0) {
            memoryString += "Saved Memories & Facts:\n";
            context.memories.forEach(m => {
                memoryString += `- [ID: ${m.id}] [Category: ${m.category}] ${m.content}\n`;
            });
            memoryString += "\n";
        }

        if (!req.user) {
            memoryString += "\n[SYSTEM ALERT]: This is a GUEST user (Not Logged In). You CAN answer general knowledge questions, provide global news, and chat casually. However, you CANNOT save memories, retrieve past memories, set reminders, or access personal data. If the guest asks to perform any of these personalized actions (e.g., 'remind me', 'save this memory', 'where am I'), politely inform them that they must Sign In or Create a Buddy Account to unlock personal assistant features.\n";
        }

        const userVoiceId = userDetails?.voicePreferences?.voiceId || 'Puck';
        const userGender = userDetails?.voicePreferences?.gender || 'male';
        const userTone = userDetails?.voicePreferences?.tone || 'normal';

        // 3. Forward full payload to Python FastAPI
        const payload = {
            message,
            session_id: finalSessionId,
            tts: tts || false,
            voice_id: userVoiceId,
            gender: userGender,
            tone: userTone,
            api_key: aiConfig.apiKey,
            provider: aiConfig.provider,
            model: aiConfig.model,
            userId: userId.toString(),
            memory_context: memoryString,
            // Pass Groq key as fallback so Python can use it if primary provider fails
            fallback_groq_key: aiConfig.provider !== 'groq' ? (aiConfig.groqApiKey || null) : null,
            api_keys: aiConfig.allKeys // Pass all keys for Omni-Fallback
        };
        const payloadSize = JSON.stringify(payload).length;
        console.log(`[LATENCY-PROFILER] Payload Construction: ${Date.now() - gatewayStart - dataFetchTime}ms | Size: ${payloadSize} chars`);

        if (isStream) {
            const streamStartTime = Date.now();
            const pythonResponse = await axios.post(pythonEndpoint, payload, {
                responseType: 'stream',
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('X-Accel-Buffering', 'no'); // Prevent buffering from Nginx/proxies
            res.setHeader('Connection', 'keep-alive');

            let firstTokenSent = false;
            pythonResponse.data.on('data', (chunk) => {
                if (!firstTokenSent) {
                    firstTokenSent = true;
                    console.log(`[LATENCY-TTFT] Total TTFT (Node.js -> Flutter): ${Date.now() - streamStartTime}ms`);
                }
                res.write(chunk);
            });
            
            pythonResponse.data.on('end', () => res.end());
            pythonResponse.data.on('error', (err) => {
                console.error('[AI Gateway] Python stream error:', err);
                res.end();
            });
        } else {
            const pythonResponse = await axios.post(pythonEndpoint, payload, {
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });
            res.json(pythonResponse.data);
        }

    } catch (error) {
        const errorMessage = error.response?.data?.detail || error.message;
        console.error('[AI Gateway] Error proxying to Python:', {
            path: req.path,
            url: pythonEndpoint || 'N/A',
            status: error.response?.status || 0,
            message: errorMessage
        });
        res.status(error.response?.status || 500).json({ success: false, message: errorMessage });
    }
};

exports.proxyActionToPython = async (req, res) => {
    try {
        const { action, payload, type, value, userId: bodyUserId } = req.body;
        
        // 1. Determine the effective User ID
        // If 'protect' middleware passed, we have req.user. 
        // If 'protectInternal' passed, we might only have bodyUserId.
        let userId = req.user ? req.user._id : bodyUserId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated for action execution.' });
        }

        // Ensure userId is a string for schema consistency
        const userIdStr = userId.toString();

        const act = type || action;
        const val = value || payload;

        const normalizeTitle = (t) =>
            String(t || '')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

        const isTitleSimilar = (a, b) => {
            const na = normalizeTitle(a);
            const nb = normalizeTitle(b);
            if (!na || !nb) return false;
            if (na === nb) return true;
            // Common update patterns: small suffix/prefix changes
            return na.includes(nb) || nb.includes(na);
        };

        const cleanUpdatePayload = (obj) => {
            if (!obj || typeof obj !== 'object') return {};
            const cleaned = {};
            for (const [k, v] of Object.entries(obj)) {
                if (v === null || v === undefined) continue;
                if (typeof v === 'string' && v.trim() === '') {
                    // Avoid accidental field wipes (Python tool defaults used to send "")
                    continue;
                }
                cleaned[k] = v;
            }
            return cleaned;
        };

        const triggerVectorReload = async () => {
            try {
                const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
                await axios.post(`${aiServiceUrl}/system/reload`, {}, {
                    headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
                });
            } catch (error) {
                console.error('[AI-SYNC] Failed to trigger vector store reload (AI Controller):', error.message);
            }
        };

        const convertReminderToLocationReminder = async (reminderDoc, updatePayload = {}) => {
            const Reminder = require('../../models/Reminder');
            const LocationReminder = require('../../models/LocationReminder');

            const reminderId = reminderDoc._id;

            const incomingLocation =
                typeof updatePayload.location === 'string' ? updatePayload.location.trim() : '';

            const merged = {
                title: updatePayload.title ?? reminderDoc.title,
                description:
                    updatePayload.description ??
                    reminderDoc.description ??
                    reminderDoc.notes ??
                    '',
                location: incomingLocation || (reminderDoc.location || '').toString(),
                coordinates: updatePayload.coordinates ?? reminderDoc.coordinates ?? { lat: null, lng: null },
                date: updatePayload.date ?? reminderDoc.date ?? '',
                time: updatePayload.time ?? reminderDoc.time ?? '',
                status: updatePayload.status ?? reminderDoc.status ?? 'on_track',
                bufferTime: updatePayload.bufferTime ?? reminderDoc.bufferTime ?? 15,
                geofenceRadius: updatePayload.geofenceRadius ?? reminderDoc.geofenceRadius ?? 500,
                warningLevel: updatePayload.warningLevel,
                notifyPhone: updatePayload.notifyPhone,
                notifyFamily: updatePayload.notifyFamily,
                notifyEmergency: updatePayload.notifyEmergency,
                earlyWarningSet: updatePayload.earlyWarningSet,
                trafficAware: updatePayload.trafficAware,
                itemExitGuards: updatePayload.itemExitGuards
            };

            // Auto-geocode if location is present but coordinates are missing
            if (merged.location && (!merged.coordinates?.lat || !merged.coordinates?.lng)) {
                try {
                    const { geocodeAddress } = require('../../services/smartReminderService');
                    const User = require('../../models/User');
                    const user = await User.findById(userIdStr);
                    const coords = await geocodeAddress(merged.location, user?.currentLocation);
                    if (coords) merged.coordinates = coords;
                } catch (err) {
                    console.warn('[Action Proxy] Geocoding failed during conversion:', err.message);
                }
            }

            const mapStatus = (s) => {
                const v = String(s || '').toLowerCase();
                if (v === 'completed') return 'completed';
                if (v === 'cancelled') return 'cancelled';
                if (v === 'risk_alert') return 'risk_alert';
                return 'on_track';
            };

            const mapWarningLevel = () => {
                const priority = String(reminderDoc.priority || '').toLowerCase();
                if (priority === 'high') return 'high';
                if (priority === 'low') return 'low';
                return 'medium';
            };

            const upsertDoc = await LocationReminder.findOneAndUpdate(
                { _id: reminderId, userId: userIdStr },
                {
                    $set: {
                        userId: userIdStr,
                        title: merged.title,
                        description: merged.description,
                        location: merged.location,
                        coordinates: merged.coordinates,
                        date: merged.date || '',
                        time: merged.time || '',
                        status: mapStatus(merged.status),
                        warningLevel: merged.warningLevel || mapWarningLevel(),
                        bufferTime: merged.bufferTime ?? 15,
                        notifyPhone: merged.notifyPhone ?? reminderDoc.alerts?.push ?? true,
                        notifyFamily: merged.notifyFamily ?? reminderDoc.alerts?.notifyFamily ?? false,
                        notifyEmergency: merged.notifyEmergency ?? reminderDoc.alerts?.notifyEmergency ?? false,
                        notifyEmail: true,
                        earlyWarningSet: merged.earlyWarningSet ?? reminderDoc.smartFeatures?.earlyWarning ?? true,
                        trafficAware: merged.trafficAware ?? reminderDoc.smartFeatures?.trafficAware ?? true,
                        itemExitGuards: merged.itemExitGuards ?? reminderDoc.smartFeatures?.itemExitGuards ?? true,
                        geofenceRadius: merged.geofenceRadius ?? 500
                    }
                },
                { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true }
            );

            await Reminder.deleteOne({ _id: reminderId });

            // Best-effort realtime sync + AI index refresh
            try {
                const { emitDataSync } = require('../../utils/socketEmitter');
                emitDataSync(req, res, userIdStr, 'task', 'delete', { id: reminderId });
                emitDataSync(req, res, userIdStr, 'location_reminder', 'create', { id: reminderId });
            } catch (e) {
                console.warn('[Action Proxy] emitDataSync failed during conversion:', e.message);
            }

            await triggerVectorReload();

            return upsertDoc;
        };

        // --- 1. Node-Native Actions (Buddy Core) ---
        if (act === 'CREATE_REMINDER' || act === 'REMINDER') {
            let reminderData = val;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
            }

            // If the AI accidentally routes a geo-trigger request into CREATE_REMINDER,
            // transparently persist it as a dedicated LocationReminder so it shows up
            // in the Location Reminders UI (and doesn't pollute the normal reminder list).
            const reminderType = String(reminderData?.reminderType || '').toLowerCase();
            const timeStr = String(reminderData?.time || '');
            const looksLikeArrivalTrigger = /whenever|arrive/i.test(timeStr);
            const hasLocation =
                typeof reminderData?.location === 'string' &&
                reminderData.location.trim().length > 0;

            if (reminderType === 'location' || looksLikeArrivalTrigger || hasLocation) {
                if (reminderData.location && (!reminderData.coordinates?.lat || !reminderData.coordinates?.lng)) {
                    try {
                        const { geocodeAddress } = require('../../services/smartReminderService');
                        const User = require('../../models/User');
                        const user = await User.findById(userIdStr);
                        const coords = await geocodeAddress(reminderData.location, user?.currentLocation);
                        if (coords) {
                            reminderData.coordinates = coords;
                        }
                    } catch (err) {
                        console.warn('[Action Proxy] Geocoding failed:', err.message);
                    }
                }

                if (!reminderData.date) {
                    const now = new Date();
                    reminderData.date = now.toISOString().split('T')[0];
                }
                if (!reminderData.time) {
                    reminderData.time = "whenever I arrive";
                }

                let result = { success: false, message: 'Unknown error' };
                const mockReq = {
                    body: reminderData,
                    user: { _id: userIdStr },
                    app: req.app
                };
                const mockRes = {
                    status: (code) => ({
                        json: (data) => {
                            result = { success: code < 400, ...data, status: code };
                            console.log('Action Proxy -> Result:', data);
                        }
                    }),
                    locals: {}
                };

                let conflictWarning = '';
                try {
                    if (reminderData.date && reminderData.time && reminderData.time !== "whenever I arrive") {
                        const LocationReminder = require('../../models/LocationReminder');
                        const existing = await LocationReminder.findOne({
                            userId: userIdStr,
                            date: reminderData.date,
                            time: reminderData.time,
                            status: { $nin: ['completed', 'cancelled'] }
                        });
                        if (existing) {
                            conflictWarning = ` Note: The user already has a location reminder scheduled at this exact time ("${existing.title} at ${existing.location}"). Please inform them.`;
                            // If it looks like the same reminder, treat this CREATE as an UPDATE
                            if (isTitleSimilar(existing.title, reminderData.title)) {
                                let updateResult = { success: false, message: 'Unknown error' };
                                const updateReq = {
                                    params: { id: existing._id },
                                    body: cleanUpdatePayload(reminderData),
                                    user: { _id: userIdStr },
                                    app: req.app
                                };
                                const updateRes = {
                                    status: (code) => ({
                                        json: (data) => {
                                            updateResult = { success: code < 400, ...data, status: code };
                                        }
                                    }),
                                    locals: {}
                                };
                                await locationReminderController.updateLocationReminder(updateReq, updateRes);
                                if (updateResult.success) {
                                    updateResult.message = updateResult.message || 'Location reminder updated.';
                                }
                                return res.status(updateResult.status || 200).json(updateResult);
                            }
                        }
                    }
                } catch (e) { console.error('Conflict check error:', e); }

                // Cross-collection update: if the user already has a standard reminder at this time,
                // treat this as an update and auto-move it into Location Reminders.
                try {
                    if (reminderData.date && reminderData.time && reminderData.location) {
                        const Reminder = require('../../models/Reminder');
                        const existingStd = await Reminder.findOne({
                            userId: userIdStr,
                            date: reminderData.date,
                            time: reminderData.time,
                            status: { $nin: ['completed', 'cancelled'] }
                        });
                        if (existingStd && isTitleSimilar(existingStd.title, reminderData.title)) {
                            const moved = await convertReminderToLocationReminder(existingStd, cleanUpdatePayload(reminderData));
                            return res.status(200).json({
                                success: true,
                                message: 'Reminder updated and moved to Location Reminders.',
                                data: moved
                            });
                        }
                    }
                } catch (e) {
                    console.error('[Action Proxy] Cross-collection update check failed:', e.message);
                }

                await locationReminderController.createLocationReminder(mockReq, mockRes);
                if (result.success && conflictWarning) result.message += conflictWarning;
                return res.status(result.status || 200).json(result);
            }

            let result = { success: false, message: 'Unknown error' };
            const mockReq = {
                body: reminderData,
                user: { _id: userIdStr, googleRefreshToken: null },
                app: req.app // Pass the app context for Socket emission
            };
            const mockRes = {
                status: (code) => ({ 
                    json: (data) => {
                        result = { success: code < 400, ...data, status: code };
                    } 
                }),
                locals: {} // Some controllers use locals
            };

            let conflictWarning = '';
            try {
                if (reminderData.date && reminderData.time) {
                    const Reminder = require('../../models/Reminder');
                    const existing = await Reminder.findOne({ 
                        userId: userIdStr, 
                        date: reminderData.date, 
                        time: reminderData.time,
                        status: { $nin: ['completed', 'cancelled'] }
                    });
                    if (existing) {
                        conflictWarning = ` Note: The user already has a reminder scheduled at this exact time ("${existing.title}"). Please inform them about this scheduling conflict.`;
                        // If it looks like the same reminder, treat this CREATE as an UPDATE
                        if (isTitleSimilar(existing.title, reminderData.title)) {
                            let updateResult = { success: false, message: 'Unknown error' };
                            const updateReq = {
                                params: { id: existing._id },
                                body: cleanUpdatePayload(reminderData),
                                user: { _id: userIdStr, googleRefreshToken: null },
                                app: req.app
                            };
                            const updateRes = {
                                status: (code) => ({
                                    json: (data) => {
                                        updateResult = { success: code < 400, ...data, status: code };
                                    }
                                }),
                                locals: {}
                            };
                            await reminderController.updateReminder(updateReq, updateRes);
                            if (updateResult.success) {
                                updateResult.message = updateResult.message || 'Reminder updated.';
                            }
                            return res.status(updateResult.status || 200).json(updateResult);
                        }
                    }
                }
            } catch(e) { console.error('Conflict check error:', e); }

            await reminderController.createReminder(mockReq, mockRes);
            if (result.success && conflictWarning) result.message += conflictWarning;
            return res.status(result.status || 200).json(result);
        }

        if (act === 'CREATE_LOCATION_REMINDER') {
            let reminderData = val;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
            }

            if (reminderData.location && (!reminderData.coordinates?.lat || !reminderData.coordinates?.lng)) {
                try {
                    const { geocodeAddress } = require('../../services/smartReminderService');
                    const User = require('../../models/User');
                    const user = await User.findById(userIdStr);
                    const coords = await geocodeAddress(reminderData.location, user?.currentLocation);
                    if (coords) {
                        reminderData.coordinates = coords;
                    }
                } catch (err) {
                    console.warn('[Action Proxy] Geocoding failed:', err.message);
                }
            }

            if (!reminderData.date) {
                const now = new Date();
                reminderData.date = now.toISOString().split('T')[0];
            }
            if (!reminderData.time) {
                reminderData.time = "whenever I arrive";
            }

            let result = { success: false, message: 'Unknown error' };
            const mockReq = {
                body: reminderData,
                user: { _id: userIdStr },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({ 
                    json: (data) => {
                        result = { success: code < 400, ...data, status: code };
                        console.log('Action Proxy -> Result:', data);
                    } 
                }),
                locals: {}
            };

            let conflictWarning = '';
            try {
                if (reminderData.date && reminderData.time && reminderData.time !== "whenever I arrive") {
                    const LocationReminder = require('../../models/LocationReminder');
                    const existing = await LocationReminder.findOne({ 
                        userId: userIdStr, 
                        date: reminderData.date, 
                        time: reminderData.time,
                        status: { $nin: ['completed', 'cancelled'] }
                    });
                    if (existing) {
                        conflictWarning = ` Note: The user already has a location reminder scheduled at this exact time ("${existing.title} at ${existing.location}"). Please inform them.`;
                    }
                }
            } catch(e) { console.error('Conflict check error:', e); }

            await locationReminderController.createLocationReminder(mockReq, mockRes);
            if (result.success && conflictWarning) result.message += conflictWarning;
            return res.status(result.status || 200).json(result);
        }

        if (act === 'UPDATE_REMINDER') {
            let reminderData = val;
            const reminderId = req.body.id;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
            }

            if (!reminderId) {
                return res.status(400).json({ success: false, message: 'Missing reminder id for update.' });
            }

            const cleanedUpdate = cleanUpdatePayload(reminderData);

            // 1) If the ID belongs to a LocationReminder, update it there.
            try {
                const LocationReminder = require('../../models/LocationReminder');
                const existingLoc = await LocationReminder.findOne({ _id: reminderId, userId: userIdStr });
                if (existingLoc) {
                    let result = { success: false, message: 'Unknown error' };
                    const mockReq = {
                        params: { id: reminderId },
                        body: cleanedUpdate,
                        user: { _id: userIdStr },
                        app: req.app
                    };
                    const mockRes = {
                        status: (code) => ({
                            json: (data) => {
                                result = { success: code < 400, ...data, status: code };
                            }
                        }),
                        locals: {}
                    };

                    await locationReminderController.updateLocationReminder(mockReq, mockRes);
                    return res.status(result.status || 200).json(result);
                }
            } catch (e) {
                console.error('[Action Proxy] LocationReminder update check failed:', e.message);
            }

            // 2) Otherwise, update a standard Reminder. If a location is provided, auto-convert.
            try {
                const Reminder = require('../../models/Reminder');
                const LocationReminder = require('../../models/LocationReminder');
                const existingReminder = await Reminder.findOne({
                    _id: reminderId,
                    $or: [{ userId: userIdStr }, { 'sharedWith.user': userIdStr }]
                });

                if (!existingReminder) {
                    return res.status(404).json({ success: false, message: 'Reminder not found or access denied' });
                }

                const isOwner = existingReminder.userId?.toString?.() === userIdStr;
                const incomingLocation =
                    typeof cleanedUpdate.location === 'string' ? cleanedUpdate.location.trim() : '';
                const incomingTime =
                    typeof cleanedUpdate.time === 'string' ? cleanedUpdate.time.trim() : '';
                const looksLikeArrival = /whenever|arrive/i.test(incomingTime);
                const hasOrWillHaveLocation =
                    incomingLocation.length > 0 ||
                    (typeof existingReminder.location === 'string' && existingReminder.location.trim().length > 0);

                const shouldConvertToLocationReminder = isOwner && hasOrWillHaveLocation && (incomingLocation.length > 0 || looksLikeArrival);

                if (shouldConvertToLocationReminder) {
                    const upsertDoc = await convertReminderToLocationReminder(existingReminder, cleanedUpdate);

                    return res.status(200).json({
                        success: true,
                        message: 'Reminder updated and moved to Location Reminders.',
                        data: upsertDoc
                    });
                }
            } catch (e) {
                console.error('[Action Proxy] Conversion logic failed:', e.message);
            }

            let result = { success: false, message: 'Unknown error' };
            const mockReq = {
                params: { id: reminderId },
                body: cleanedUpdate,
                user: { _id: userIdStr, googleRefreshToken: null },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({
                    json: (data) => {
                        result = { success: code < 400, ...data, status: code };
                    }
                }),
                locals: {}
            };

            await reminderController.updateReminder(mockReq, mockRes);
            return res.status(result.status || 200).json(result);
        }

        if (act === 'DELETE_REMINDER' || act === 'DELETE_LOCATION_REMINDER') {
            let idVal = val;
            if (typeof val === 'string') {
                try { idVal = JSON.parse(val); } catch (e) { }
            }
            const reminderId = typeof idVal === 'object' ? (idVal.id || idVal.reminder_id) : idVal;

            if (!reminderId) {
                return res.status(400).json({ success: false, message: 'Missing reminder id for deletion.' });
            }

            try {
                const LocationReminder = require('../../models/LocationReminder');
                const existingLoc = await LocationReminder.findOne({ _id: reminderId, userId: userIdStr });
                if (existingLoc || act === 'DELETE_LOCATION_REMINDER') {
                    let result = { success: false, message: 'Unknown error' };
                    const mockReq = { params: { id: reminderId }, user: { _id: userIdStr }, app: req.app };
                    const mockRes = {
                        status: (code) => ({ json: (data) => { result = { success: code < 400, ...data, status: code }; } }),
                        locals: {}
                    };
                    await locationReminderController.deleteLocationReminder(mockReq, mockRes);
                    return res.status(result.status || 200).json(result);
                }
            } catch (e) {
                console.error('[Action Proxy] LocationReminder delete check failed:', e.message);
            }

            let result = { success: false, message: 'Unknown error' };
            const mockReq = { params: { id: reminderId }, user: { _id: userIdStr }, app: req.app };
            const mockRes = {
                status: (code) => ({ json: (data) => { result = { success: code < 400, ...data, status: code }; } }),
                locals: {}
            };
            await reminderController.deleteReminder(mockReq, mockRes);
            return res.status(result.status || 200).json(result);
        }

        if (act === 'SAVE_MEMORY' || act === 'CREATE_MEMORY') {
            let memoryData = val;
            if (typeof val === 'string') {
                try { memoryData = JSON.parse(val); } catch (e) { }
            }

            const mockReq = {
                body: memoryData,
                user: { _id: userIdStr },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Result:', data) }),
                locals: {}
            };

            await recordController.createMemory(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Memory action executed' });
        }

        if (act === 'CREATE_DOCUMENT') {
            let docData = val;
            if (typeof val === 'string') {
                try { docData = JSON.parse(val); } catch (e) { }
            }
            const Document = require('../../models/Document');
            await Document.create({
                userId: userIdStr,
                fileName: docData.title || 'AI Generated Document',
                content: docData.content || docData.summary || 'No content provided',
                summary: docData.summary || '',
                fileUrl: docData.fileUrl || null
            });
            return res.status(200).json({ success: true, message: 'Document action executed' });
        }

        if (act === 'UPDATE_MEMORY') {
            let memoryData = val;
            const memoryId = req.body.id;
            if (typeof val === 'string') {
                try { memoryData = JSON.parse(val); } catch (e) { }
            }

            Object.keys(memoryData).forEach(key => memoryData[key] === null && delete memoryData[key]);

            const mockReq = {
                params: { id: memoryId },
                body: memoryData,
                user: { _id: userIdStr },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Result:', data) }),
                locals: {}
            };

            await recordController.updateMemory(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Update memory action executed' });
        }

        if (act === 'DELETE_MEMORY') {
            let idVal = val;
            if (typeof val === 'string') {
                try { idVal = JSON.parse(val); } catch (e) { }
            }
            const memoryId = typeof idVal === 'object' ? (idVal.id || idVal.memory_id) : idVal;
            
            if (!memoryId) {
                return res.status(400).json({ success: false, message: 'Missing memory id for deletion.' });
            }

            let result = { success: false, message: 'Unknown error' };
            const mockReq = { params: { id: memoryId }, user: { _id: userIdStr }, app: req.app };
            const mockRes = {
                status: (code) => ({ json: (data) => { result = { success: code < 400, ...data, status: code }; } }),
                locals: {}
            };
            await recordController.deleteMemory(mockReq, mockRes);
            return res.status(result.status || 200).json(result);
        }

        if (['OPEN_URL', 'OPEN_APP', 'SEARCH'].includes(act)) {
            const aiServiceUrl = config.AI_SERVICE_URL;
            const pythonResponse = await axios.post(`${aiServiceUrl}/action`, {
                type: act,
                value: typeof val === 'object' ? JSON.stringify(val) : val
            }, {
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });
            return res.status(200).json(pythonResponse.data);
        }

        res.status(400).json({ success: false, message: `Unknown or unsupported action: ${act}` });
    } catch (err) {
        console.error('[Action Proxy] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
}

exports.proxyHealthToPython = async (req, res) => {
    try {
        const aiServiceUrl = config.AI_SERVICE_URL;
        const pythonResponse = await axios.get(`${aiServiceUrl}/health`);
        res.status(pythonResponse.status).json(pythonResponse.data);
    } catch (error) {
        res.status(503).json({ status: 'offline', message: 'AI Service (Python) is unreachable.' });
    }
};

const ttsCache = new Map();

exports.proxyTtsToPython = async (req, res) => {
    try {
        const { text, voice_id, gender, tone } = req.body;
        
        // Create a unique cache key based on the request parameters
        const cacheKey = `${text}_${voice_id}_${gender}_${tone}`;
        
        if (ttsCache.has(cacheKey)) {
            console.log('[TTS Cache] Serving cached audio for preview.');
            const cachedData = ttsCache.get(cacheKey);
            res.setHeader('Content-Type', 'audio/mpeg');
            return res.send(cachedData);
        }

        const aiServiceUrl = config.AI_SERVICE_URL;
        console.log('[TTS] Generating new audio for preview...');
        const pythonResponse = await axios.post(`${aiServiceUrl}/tts`, req.body, {
            responseType: 'arraybuffer', // Get as buffer to cache it
            headers: { 'X-API-Key': config.BUDDY_API_KEY }
        });

        // Store in cache for future requests
        ttsCache.set(cacheKey, Buffer.from(pythonResponse.data));

        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(pythonResponse.data));
    } catch (error) {
        console.error('[TTS Proxy] Error:', error.message);
        res.status(500).json({ success: false, message: 'TTS Service is currently unavailable.' });
    }
};

exports.proxyHistoryToPython = async (req, res) => {
    try {
        const { session_id } = req.params;
        const aiServiceUrl = config.AI_SERVICE_URL;
        const pythonResponse = await axios.get(`${aiServiceUrl}/chat/history/${session_id}`, {
            headers: { 'X-API-Key': config.BUDDY_API_KEY }
        });
        res.status(pythonResponse.status).json(pythonResponse.data);
    } catch (error) {
        console.error('[History Proxy] Error:', error.message);
        res.status(500).json({ success: false, message: 'Could not retrieve chat history.' });
    }
};
