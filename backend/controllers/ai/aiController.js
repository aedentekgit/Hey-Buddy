const axios = require('axios');
const config = require('../../config/env');
const Settings = require('../../models/Settings');
const { getFallbackKey } = require('../../utils/configHelper');
const Memory = require('../../models/Memory');
const User = require('../../models/User');
const { getContext } = require('../../services/contextService');
const reminderController = require('../reminderController');
const locationReminderController = require('../locationReminderController');
const recordController = require('../recordController');

let cachedAiConfig = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 60 * 1000; // 60 seconds
const REALTIME_KEYWORDS = [
    'current', 'latest', 'today', 'now', 'recent', 'breaking', 'news', 'headline',
    'headlines', 'live', 'update', 'updates', 'global', 'world', 'weather',
    'price', 'prices', 'stock', 'stocks', 'market', 'markets', 'score', 'scores',
    'trend', 'trends', 'happening', 'affairs'
];

const REALTIME_PATTERNS = [
    /\bwho\s+is\s+(the\s+)?(cm|chief\s+minister|pm|prime\s+minister|president|governor|mayor)\b/i,
    /\b(?:cm|chief\s+minister|pm|prime\s+minister|president|governor|mayor)\s+of\b/i,
    /\b(?:current|new|present)\s+(?:cm|chief\s+minister|pm|prime\s+minister|president|governor|mayor)\b/i,
];

const AI_UNAVAILABLE_MESSAGE = 'The AI service is temporarily unavailable. Please try again in a moment.';

const sanitizeAiError = (message = '') => {
    const text = String(message || '').trim();
    if (!text) return AI_UNAVAILABLE_MESSAGE;

    const lower = text.toLowerCase();
    const hasTechnicalDetails = [
        'error code',
        'invalid_request_error',
        'insufficient balance',
        'traceback',
        'stack',
        '{',
        '}',
        'api key',
        'httpexception',
        'axios',
        'python'
    ].some(marker => lower.includes(marker));

    if (hasTechnicalDetails) return AI_UNAVAILABLE_MESSAGE;
    return text.replace(/^error:\s*/i, '').trim() || AI_UNAVAILABLE_MESSAGE;
};

const requiresRealtimeSearch = (message = '') => {
    const lower = String(message || '').toLowerCase();
    return REALTIME_KEYWORDS.some(keyword => new RegExp(`\\b${keyword}\\b`, 'i').test(lower))
        || REALTIME_PATTERNS.some(pattern => pattern.test(lower));
};

const getAiConfig = async () => {
    const now = Date.now();
    if (cachedAiConfig && (now - lastCacheTime < CACHE_DURATION_MS)) {
        return cachedAiConfig;
    }

    const settings = await Settings.findOne().select('+ai.geminiApiKey +ai.openaiApiKey +ai.claudeApiKey +ai.deepseekApiKey +ai.groqApiKey');

    // Defaults
    const aiConfig = {
        provider: 'openai',
        apiKey: getFallbackKey('OPENAI_API_KEY'),
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

    // Voice Config Integration - Default to Gemini 2.5 Flash Native Audio for Live Voice Support
    const activeVoiceStr = aiSettings.activeVoiceModel || 'google/gemini-2.5-flash-native-audio-latest';
    const [voiceProvider, voiceModelName] = activeVoiceStr.split('/');

    aiConfig.voiceProvider = voiceProvider || 'google';
    aiConfig.voiceModel = voiceModelName || 'gemini-2.5-flash-native-audio-latest';

    // Voice API Key Mapping
    if (aiConfig.voiceProvider === 'google') {
        aiConfig.voiceApiKey = aiSettings.geminiApiKey || getFallbackKey('GEMINI_API_KEY');
    }

    // Always include Groq key as fallback (used by Python when primary provider fails)
    aiConfig.groqApiKey = aiSettings.groqApiKey || getFallbackKey('GROQ_API_KEY') || null;

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
        let isRealtime = requestPath.includes('realtime');
        if (!isRealtime && requiresRealtimeSearch(message)) {
            isRealtime = true;
            console.log('[AI Gateway] Auto-routing freshness-sensitive request to realtime search');
        }

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

        // 1. Parallelize Data Fetching (PROMISE.ALL) - Saves ~200-400ms
        const [aiConfig, context, userDetails] = await Promise.all([
            getAiConfig(),
            getContext(userId, session_id),
            User.findById(userId).select('voicePreferences')
        ]);

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
                if (!res.writableEnded && !firstTokenSent) {
                    res.write(`data: ${JSON.stringify({ error: 'The AI stream disconnected before finishing. Please try again.' })}\n\n`);
                }
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
        res.status(error.response?.status || 500).json({ success: false, message: sanitizeAiError(errorMessage) });
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

        // --- 1. Node-Native Actions (Buddy Core) ---
        if (act === 'CREATE_REMINDER' || act === 'REMINDER') {
            let reminderData = val;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
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

            Object.keys(reminderData).forEach(key => reminderData[key] === null && delete reminderData[key]);

            const mockReq = {
                params: { id: reminderId },
                body: reminderData,
                user: { _id: userIdStr, googleRefreshToken: null },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Result:', data) }),
                locals: {}
            };

            await reminderController.updateReminder(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Update reminder action executed' });
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
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '../../tts_debug.log');
    const logDebug = (msg) => {
        try {
            const formatted = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(logPath, formatted);
            console.log(`[TTS DEBUG] ${msg}`);
        } catch (e) {
            console.error("Failed to write to tts_debug.log:", e);
        }
    };

    try {
        const { text, voice_id, gender, tone } = req.body;
        logDebug(`--- Incoming TTS Request ---`);
        logDebug(`Body: ${JSON.stringify(req.body)}`);
        logDebug(`Headers: ${JSON.stringify(req.headers)}`);
        logDebug(`Authenticated User: ${req.user ? req.user._id : 'None'}`);

        if (!text || !text.trim()) {
            logDebug(`Error: Text is empty`);
            return res.status(400).json({ success: false, message: 'Text is required' });
        }
        
        const cacheKey = `${text}_${voice_id}_${gender}_${tone}`;
        if (ttsCache.has(cacheKey)) {
            logDebug(`Cache hit for key: ${cacheKey}`);
            const { buffer, format } = ttsCache.get(cacheKey);
            const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Audio-Format', format);
            return res.send(buffer);
        }

        // Check MongoDB configuration keys
        try {
            const settings = await Settings.findOne().select('+ai.geminiApiKey');
            logDebug(`MongoDB Settings found: ${!!settings}`);
            if (settings) {
                logDebug(`Settings Active Voice Model: ${settings.ai?.activeVoiceModel}`);
                logDebug(`Settings Gemini Key Exists: ${!!settings.ai?.geminiApiKey}`);
                if (settings.ai?.geminiApiKey) {
                    logDebug(`Gemini Key Prefix: ${settings.ai.geminiApiKey.substring(0, 8)}...`);
                }
            }
        } catch (dbErr) {
            logDebug(`MongoDB settings fetch error: ${dbErr.message}`);
        }

        const ttsService = require('../../services/ttsService');
        logDebug(`Generating audio via local ttsService...`);
        let result = null;
        try {
            result = await ttsService.generateAudio(text.trim(), gender || 'male', tone || 'normal', 'en-US', voice_id);
            logDebug(`ttsService result success: ${!!result && !!result.audio} | Format: ${result?.format} | Voice: ${result?.voiceName}`);
        } catch (ttsErr) {
            logDebug(`ttsService.generateAudio threw error: ${ttsErr.message}\nStack: ${ttsErr.stack}`);
        }

        if (!result || !result.audio) {
            logDebug(`Both Gemini and Google failed — trying Python edge-tts fallback...`);
            try {
                const aiServiceUrl = config.AI_SERVICE_URL || 'http://localhost:8000';
                logDebug(`Python URL: ${aiServiceUrl}/tts`);
                const edgeResp = await axios.post(
                    `${aiServiceUrl}/tts`,
                    { text: text.trim(), gender: gender || 'male', tone: tone || 'normal' },
                    { headers: { 'X-API-Key': config.BUDDY_API_KEY || '' }, responseType: 'arraybuffer', timeout: 15000 }
                );
                logDebug(`Python status code: ${edgeResp.status} | Data length: ${edgeResp.data ? edgeResp.data.byteLength : 0}`);
                if (edgeResp.data && edgeResp.data.byteLength > 0) {
                    result = {
                        audio: Buffer.from(edgeResp.data).toString('base64'),
                        format: 'mp3',
                        voiceName: 'edge-tts'
                    };
                    logDebug(`Python edge-tts fallback succeeded.`);
                }
            } catch (edgeErr) {
                logDebug(`Python edge-tts fallback failed: ${edgeErr.message}`);
                if (edgeErr.response) {
                    logDebug(`Python error response status: ${edgeErr.response.status}`);
                    logDebug(`Python error response data: ${JSON.stringify(edgeErr.response.data)}`);
                }
            }
        }

        if (result && result.audio) {
            const audioBuffer = Buffer.from(result.audio, 'base64');
            const format = result.format || 'mp3';
            const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';

            // Only cache Gemini results (WAV) — never cache Google fallback
            // because fallback loses voice identity and we want to retry Gemini next time
            const isGeminiResult = format === 'wav' && !result.voiceName?.includes('Fallback');
            if (isGeminiResult) {
                ttsCache.set(cacheKey, { buffer: audioBuffer, format });
            }

            logDebug(`Sending audio response. Length: ${audioBuffer.length} bytes | Format: ${format} | Voice: ${result.voiceName} | Content-Type: ${contentType} | Cached: ${isGeminiResult}`);
            res.setHeader('Content-Type', contentType);
            res.setHeader('X-Audio-Format', format);
            return res.send(audioBuffer);
        }


        logDebug(`Error: No audio produced by any TTS provider`);
        res.status(500).json({ success: false, message: 'TTS generation failed - no audio produced.' });
    } catch (error) {
        logDebug(`Error caught in exports.proxyTtsToPython: ${error.message}\nStack: ${error.stack}`);
        res.status(500).json({ success: false, message: 'TTS Service is currently unavailable.' });
    }
};

exports.proxyHistoryToPython = async (req, res) => {
    try {
        const { session_id } = req.params;
        const expectedPrefix = `user_${req.user._id}`;
        if (!session_id || !session_id.startsWith(expectedPrefix)) {
            return res.status(403).json({ success: false, message: 'Access denied for this chat history.' });
        }
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
