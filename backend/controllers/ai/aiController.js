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
    const MODEL_ALIASES = {
        'gemini-2.0-flash-exp': 'gemini-1.5-flash',
        'gemini-2.0-flash': 'gemini-1.5-flash',
        'gemini-flash-1.5-8b': 'gemini-1.5-flash-8b',
        'gemini-pro-latest': 'gemini-1.5-pro',
        'gemini-flash': 'gemini-1.5-flash',
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

    // Voice Config Integration
    const activeVoiceStr = aiSettings.activeVoiceModel || 'google/gemini-1.5-flash';
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
        const userId = req.user ? req.user._id : (req.decodedUserId || `guest_${Date.now()}`);

        const finalSessionId = session_id || userId.toString();

        const requestPath = req.path;
        const isStream = requestPath.includes('stream');
        const isRealtime = requestPath.includes('realtime');
        const aiServiceUrl = config.AI_SERVICE_URL;

        console.log(`[AI Gateway] Incoming Request: ${requestPath} | Stream: ${isStream} | Realtime: ${isRealtime}`);

        // Map to the correct Python endpoint
        pythonEndpoint = `${aiServiceUrl}/chat`;
        if (isRealtime && isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime/stream`;
        } else if (isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/stream`;
        } else if (isRealtime) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime`;
        }

        console.log(`[AI Gateway] Target Python Endpoint: ${pythonEndpoint}`);

        // 1. Get configurations from Database
        const aiConfig = await getAiConfig();

        if (!aiConfig.apiKey) {
            console.warn('[AI Gateway] AI API Key is missing for provider:', aiConfig.provider);
            console.log('[AI Gateway] Full aiConfig:', JSON.stringify(aiConfig, null, 2));
            return res.status(400).json({ success: false, message: 'AI API Key is not configured in settings.' });
        }
        console.log('[AI Gateway] Forwarding to Python with provider:', aiConfig.provider, 'model:', aiConfig.model);

        // 2. Fetch User Context (includes history, memories, and reminders)
        const context = await getContext(userId, session_id);

        // Build an authoritative context string for the AI
        let memoryString = "=== AUTHORITATIVE USER CONTEXT ===\n";

        // Current Local Date/Time (Critical for time-aware reminders)
        if (context.userContext && context.userContext.localDate) {
            memoryString += `Current User Date: ${context.userContext.localDate}\n`;
            memoryString += `Time Zone: ${context.userContext.timeZone}\n\n`;
        }

        // Reminders Section
        if (context.reminders && context.reminders.length > 0) {
            memoryString += "Upcoming Reminders:\n";
            context.reminders.forEach(r => {
                memoryString += `- [ID: ${r.id}] [${r.date} ${r.time}] ${r.title}\n`;
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
        }


        // Fetch user preferences for personalized voice
        const userDetails = await User.findById(userId).select('voicePreferences');
        const userVoiceId = userDetails?.voicePreferences?.voiceId || 'en-GB-RyanNeural';

        // 3. Forward full payload to Python FastAPI
        const payload = {
            message,
            session_id: finalSessionId,
            tts: tts || false,
            voice_id: userVoiceId,
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
            const pythonResponse = await axios.post(pythonEndpoint, payload, {
                responseType: 'stream',
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });

            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            pythonResponse.data.pipe(res);
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
        const userId = req.user ? req.user._id : bodyUserId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated for action execution.' });
        }

        const act = type || action;
        const val = value || payload;

        // --- 1. Node-Native Actions (Buddy Core) ---
        if (act === 'CREATE_REMINDER' || act === 'REMINDER') {
            let reminderData = val;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
            }

            const mockReq = {
                body: reminderData,
                user: { _id: userId, googleRefreshToken: null },
                app: req.app // Pass the app context for Socket emission
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Result:', data) }),
                locals: {} // Some controllers use locals
            };

            let conflictWarning = '';
            try {
                if (reminderData.date && reminderData.time) {
                    const Reminder = require('../../models/Reminder');
                    const existing = await Reminder.findOne({ 
                        userId, 
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
            return res.status(200).json({ success: true, message: 'Reminder action executed.' + conflictWarning });
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
                    const user = await User.findById(userId);
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

            const mockReq = {
                body: reminderData,
                user: { _id: userId },
                app: req.app
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Result:', data) }),
                locals: {}
            };

            await locationReminderController.createLocationReminder(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Location reminder action executed' });
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
                user: { _id: userId, googleRefreshToken: null },
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
                user: { _id: userId },
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
                userId: userId,
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
                user: { _id: userId },
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

exports.proxyTtsToPython = async (req, res) => {
    try {
        const aiServiceUrl = config.AI_SERVICE_URL;
        const pythonResponse = await axios.post(`${aiServiceUrl}/tts`, req.body, {
            responseType: 'stream',
            headers: { 'X-API-Key': config.BUDDY_API_KEY }
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        pythonResponse.data.pipe(res);
    } catch (error) {
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
