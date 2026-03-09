const axios = require('axios');
const config = require('../../config/env');
const Settings = require('../../models/Settings');
const Memory = require('../../models/Memory');
const User = require('../../models/User');
const { getContext } = require('../../services/contextService');
const reminderController = require('../reminderController');
const recordController = require('../recordController');

const getAiConfig = async () => {
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
    aiConfig.model = modelName || 'gpt-4o-mini';

    // Map to the correct key from Database
    if (aiConfig.provider === 'openai' && aiSettings.openaiApiKey) {
        aiConfig.apiKey = aiSettings.openaiApiKey;
    } else if (aiConfig.provider === 'gemini' && aiSettings.geminiApiKey) {
        aiConfig.apiKey = aiSettings.geminiApiKey;
    } else if (aiConfig.provider === 'groq' && aiSettings.groqApiKey) {
        aiConfig.apiKey = aiSettings.groqApiKey;
    } else if (aiConfig.provider === 'anthropic' && aiSettings.claudeApiKey) {
        aiConfig.apiKey = aiSettings.claudeApiKey;
    } else if (aiConfig.provider === 'deepseek' && aiSettings.deepseekApiKey) {
        aiConfig.apiKey = aiSettings.deepseekApiKey;
    }

    return aiConfig;
};

exports.getAiConfig = getAiConfig;

exports.proxyChatToPython = async (req, res) => {
    try {
        const { message, session_id, tts } = req.body;

        // Use req.user._id if found in DB, else use decoded JWT userId as fallback
        // This ensures JWT-verified users are never treated as guests even on cross-DB builds
        const userId = req.user ? req.user._id : (req.decodedUserId || `guest_${Date.now()}`);

        const finalSessionId = session_id || userId.toString();

        // Path detection (supporting /chat/stream and /chat/realtime/stream)
        // Path detection (supporting /chat/stream and /chat/realtime/stream)
        const requestPath = req.path;
        const isStream = requestPath.includes('stream');
        const isRealtime = requestPath.includes('realtime');
        const aiServiceUrl = config.AI_SERVICE_URL;

        // Map to the correct Python endpoint
        let pythonEndpoint = `${aiServiceUrl}/chat`;
        if (isRealtime && isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime/stream`;
        } else if (isStream) {
            pythonEndpoint = `${aiServiceUrl}/chat/stream`;
        } else if (isRealtime) {
            pythonEndpoint = `${aiServiceUrl}/chat/realtime`;
        } else {
            pythonEndpoint = `${aiServiceUrl}/chat`;
        }

        // 1. Get configurations from Database
        const aiConfig = await getAiConfig();

        if (!aiConfig.apiKey) {
            return res.status(400).json({ success: false, message: 'AI API Key is not configured in settings.' });
        }

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


        // 3. Forward full payload to Python FastAPI
        const payload = {
            message,
            session_id: userId.toString(), // Enforce single conversation per user across all platforms
            tts: tts || false,
            api_key: aiConfig.apiKey,
            provider: aiConfig.provider,
            model: aiConfig.model,
            userId: userId.toString(),
            memory_context: memoryString
        };

        if (isStream) {
            const pythonResponse = await axios.post(pythonEndpoint, payload, {
                responseType: 'stream'
            });

            // Set Headers for streaming
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe the python Server-Sent-Events directly to the client
            pythonResponse.data.pipe(res);
        } else {
            // Non-streaming response for Mobile App
            const pythonResponse = await axios.post(pythonEndpoint, payload);
            res.json(pythonResponse.data);
        }

    } catch (error) {
        const errorMessage = error.response?.data?.detail || error.message;
        console.error('[AI Gateway] Error proxying to Python:', {
            path: req.path,
            url: pythonEndpoint,
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
                user: { _id: userId, googleRefreshToken: null }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Reminder Result:', data) })
            };

            await reminderController.createReminder(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Reminder action executed' });
        }

        if (act === 'UPDATE_REMINDER') {
            let reminderData = val;
            const reminderId = req.body.id;
            if (typeof val === 'string') {
                try { reminderData = JSON.parse(val); } catch (e) { }
            }

            // Remove null fields from updateData to avoid overwriting with nulls
            Object.keys(reminderData).forEach(key => reminderData[key] === null && delete reminderData[key]);

            const mockReq = {
                params: { id: reminderId },
                body: reminderData,
                user: { _id: userId, googleRefreshToken: null }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Update Reminder Result:', data) })
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
                user: { _id: userId }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Memory Result:', data) })
            };

            await recordController.createMemory(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Memory action executed' });
        }

        if (act === 'UPDATE_MEMORY') {
            let memoryData = val;
            const memoryId = req.body.id;
            if (typeof val === 'string') {
                try { memoryData = JSON.parse(val); } catch (e) { }
            }

            // Remove null fields
            Object.keys(memoryData).forEach(key => memoryData[key] === null && delete memoryData[key]);

            const mockReq = {
                params: { id: memoryId },
                body: memoryData,
                user: { _id: userId }
            };
            const mockRes = {
                status: (code) => ({ json: (data) => console.log('Action Proxy -> Update Memory Result:', data) })
            };

            await recordController.updateMemory(mockReq, mockRes);
            return res.status(200).json({ success: true, message: 'Update memory action executed' });
        }

        // --- 2. Python-Proxied Actions (System/Local) ---
        if (['OPEN_URL', 'OPEN_APP', 'SEARCH'].includes(act)) {
            const aiServiceUrl = config.AI_SERVICE_URL;
            const pythonResponse = await axios.post(`${aiServiceUrl}/action`, {
                type: act,
                value: typeof val === 'object' ? JSON.stringify(val) : val
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
            responseType: 'stream'
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
        const pythonResponse = await axios.get(`${aiServiceUrl}/chat/history/${session_id}`);
        res.status(pythonResponse.status).json(pythonResponse.data);
    } catch (error) {
        console.error('[History Proxy] Error:', error.message);
        res.status(500).json({ success: false, message: 'Could not retrieve chat history.' });
    }
};
