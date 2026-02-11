const { OpenAI } = require('openai');
const axios = require('axios');
const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');
const Conversation = require('../models/Conversation');
const paginate = require('../utils/paginate');
const Prescription = require('../models/Prescription');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const {
    createGoogleCalendarEvent,
    updateGoogleCalendarEvent,
    deleteGoogleCalendarEvent
} = require('../services/googleCalendarService');

const logToDisk = (msg) => {
    try {
        const logDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        const logPath = path.join(logDir, 'ai_debug.txt');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    } catch (e) { console.error("Logger failed", e); }
};

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 30000,
    defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'Buddy Voice Assistant',
    },
});

const getVoicePrompt = (languageCode, memories = [], reminders = []) => `
You are "Buddy", a warm, friendly, and super helpful AI assistant.
Your goal is to be like a best friend—chatty, supportive, and efficient.
Keep responses SHORT, CONVERSATIONAL, and ENGAGING. Avoid robotic lists unless asked.

You have access to the CONVERSATION HISTORY. Use it to understand context.

INTENT INHERITANCE:
- Inherit subject/intent from previous turns (e.g., "tomorrow also" -> implies same action for tomorrow).
- Maintain a continuous, natural flow.

--------------------------------------------------------------------------------
*** CORE LANGUAGE INSTRUCTIONS (DYNAMIC) ***
--------------------------------------------------------------------------------
1. **INPUT ANALYZER**: 
   - User input can be in **ANY LANGUAGE** (English, Hindi, Tamil, etc.) or **MIXED**.
   - AUTO-DETECT the input language perfectly.

2. **OUTPUT CONTROLLER**:
   - User selected RESPONSE LANGUAGE: "${languageCode}".
   - You MUST generate "reply" and "voice_reply" STRICTLY in "${languageCode}".
   - If User speaks Hindi but Settings="${languageCode}" (e.g. en-US), reply in ENGLISH.
   - If User speaks English but Settings="ta-IN", reply in TAMIL.

3. **RESPONSE FIELDS**:
   - "reply": Text to DISPLAY (STRICTLY in "${languageCode}").
   - "voice_reply": Text to SPEAK (STRICTLY in "${languageCode}").
     * For "voice_reply", use natural speech patterns. Be shorter and punchier than the display text.

--------------------------------------------------------------------------------
*** FORMATTING RULES ***
--------------------------------------------------------------------------------
- **NEVER** use Markdown formatting like **bold** (double asterisks) or *italics* in your "reply" or "voice_reply".
- Always represent times as simple text (e.g., "3:00 PM" instead of "**3:00 PM**").
- Use simple, clean text only.

--------------------------------------------------------------------------------
Current Date: ${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
Current Time (IST): ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}

USER'S RECENT REMINDERS:
${reminders.length > 0 ? reminders.map(r => `- [${r.date} @ ${r.time}] "${r.title}"`).join('\n') : "No active active reminders."}

USER'S MEMORIES:
${memories.length > 0 ? memories.map(m => `- "${m.content}"`).join('\n') : "No saved memories yet."}

Return ONLY valid JSON:

--- CASE 1: SETTING REMINDER / TASK ---
{
  "type": "reminder",
  "data": {
    "intent": "string (meeting, medicine, pickup, bill, personal, generic)",
    "title": "string (Keep title in ORIGINAL input language or English, whichever is clearer)",
    "time": "HH:MM (24h) or null",
    "date": "YYYY-MM-DD or null",
    "location": "string or null",
    "condition": "distance_check | time_only | none",
    "repeat": false,
    "priority": "low | medium | high",
    "escalationTime": 0 | 15 | 30,
    "smartFeatures": {
      "earlyWarning": false,
      "trafficAware": false,
      "itemExitGuards": false
    }
  },
  "reply": "string (Friendly confirmation in ${languageCode}, e.g., 'Got it! I've set that reminder for you.')",
  "voice_reply": "string (Spoken confirmation in ${languageCode})"
}

--- CASE 2: MEMORY ACTIONS ---
{
  "type": "action_save_memory" | "action_delete_memory" | "action_update_memory",
  "data": {
    "content": "string",
    "memory_id": "string",
    "target_keyword": "string"
  },
  "reply": "string (Friendly confirmation in ${languageCode}, e.g., 'Okay, I'll remember that!')",
  "voice_reply": "string (Spoken confirmation in ${languageCode})"
}

--- CASE 3: CHAT / Q&A ---
{
  "type": "chat",
  "data": null,
  "reply": "string (Warm, helpful answer in ${languageCode}. Max 2 sentences. Be cheerful!)",
  "voice_reply": "string (Spoken answer in ${languageCode})"
}

AI PERSONA RULES:
- Be enthusiastic but concise.
- **Brevity Priority**: If the user asks "when", "what time", or for "timing", respond ONLY with the time and task (e.g., "3:00 PM - Pickup daughter"). No extra chatter or busy-afternoon comments.
- Never say "Is there anything else?".
- If the user is casual, be casual. If serious, be polite.
- Use emojis in "reply" field to seem friendly 🌟.
`;

// Multi-AI Ensembling Logic
exports.parseVoice = async (req, res) => {
    try {
        const { text, language = 'en-US', history = [], conversationId } = req.body;
        const userId = req.user?._id;
        console.log(`[VoiceController] AI Processing: "${text}" | Language: ${language} | User: ${userId}`);

        // Sanitize history (last 3 turns max for faster response)
        const validHistory = Array.isArray(history)
            ? history.slice(-3).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }))
            : [];

        // Fetch recent memories AND REMINDERS for context
        let memories = [];
        let reminders = [];
        if (userId) {
            try {
                // Parallel fetch for speed
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 7); // Include last 7 days for context
                const dateThreshold = pastDate.toISOString().split('T')[0];

                const [memRes, remRes] = await Promise.allSettled([
                    Memory.find({ userId }).sort({ createdAt: -1 }).limit(10),
                    Reminder.find({ userId, date: { $gte: dateThreshold } }).sort({ date: 1, time: 1 }).limit(15)
                ]);

                if (memRes.status === 'fulfilled') memories = memRes.value;
                if (remRes.status === 'fulfilled') reminders = remRes.value;

            } catch (err) {
                console.error("Failed to fetch context data:", err);
            }
        }

        if (!text) return res.status(400).json({ success: false, message: "No text provided" });

        // Fetch AI Settings from DB
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        const aiConfig = settings?.ai || { activeModel: 'openai/gpt-4o-mini', consensusMode: false };
        const logMsg = `Parse Request: Model=${aiConfig.activeModel} | HasKey=${!!aiConfig.geminiApiKey} | Text="${text.substring(0, 30)}..."`;
        console.log(`[VoiceController] ${logMsg}`);
        logToDisk(logMsg);

        const currentKey = process.env.OPENAI_API_KEY;

        // IF KEY IS DEFAULT OR MISSING, USE DEMO MODE
        if (!currentKey || currentKey === 'your_openai_api_key_here' || currentKey.length < 20) {
            console.warn("Using DEMO MODE: OpenAI API Key is missing or default.");
            const isChat = text.toLowerCase().includes('hello') || text.toLowerCase().includes('who');
            return res.status(200).json({
                success: true,
                data: isChat ? { type: "chat", data: null, reply: "Demo Mode Active. Connect API key for Multi-AI!" } : { type: "reminder", data: { title: text, time: "10:00", date: new Date().toISOString().split('T')[0] }, reply: "Demo mode reminder set." },
            });
        }

        // Define models to use
        let modelsToCall = [];
        if (aiConfig.consensusMode) {
            modelsToCall = [
                { id: "anthropic/claude-3.5-sonnet", role: "Expert" },
                { id: "openai/gpt-4o-mini", role: "Fast Logic" }
            ];
            // Also include active model if it's not one of the above
            if (aiConfig.activeModel && !modelsToCall.some(m => m.id === aiConfig.activeModel)) {
                modelsToCall.push({ id: aiConfig.activeModel, role: "Primary" });
            }
        } else {
            modelsToCall = [{ id: aiConfig.activeModel || "openai/gpt-4o-mini", role: "Selected Model" }];
        }

        // Call models in parallel
        const startTime = Date.now();
        const responses = await Promise.allSettled(modelsToCall.map(model => {
            // Check if we should use direct Gemini API
            const isGeminiModel = model.id.includes('gemini');
            const useDirectGemini = isGeminiModel && aiConfig.geminiApiKey;

            if (useDirectGemini) {
                let directModelId = model.id.split('/').pop().replace(':free', '');

                // Normalizing for Google Direct API
                if (directModelId.includes('gemini-2.0')) {
                    directModelId = 'gemini-2.0-flash-exp';
                } else if (directModelId.includes('gemini-flash-1.5-8b')) {
                    directModelId = 'gemini-1.5-flash-8b';
                } else if (directModelId.includes('gemini-1.5-flash')) {
                    directModelId = 'gemini-1.5-flash';
                }

                logToDisk(`Direct Gemini (Axios) Call: ${directModelId}`);

                return axios.post(`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${aiConfig.geminiApiKey}`, {
                    model: directModelId,
                    messages: [
                        { role: "system", content: getVoicePrompt(language, memories, reminders) },
                        ...validHistory,
                        { role: "user", content: text }
                    ],
                    temperature: 0.1,
                    max_tokens: 250
                }).then(axiosRes => {
                    logToDisk(`Direct Gemini SUCCESS for ${directModelId}`);
                    // Wrap axios response to match OpenAI SDK shape for the results.map logic
                    return { choices: axiosRes.data.choices };
                }).catch(err => {
                    const errMsg = err.response?.data?.error?.message || err.message;
                    logToDisk(`Direct Gemini FAILED for ${directModelId}: ${errMsg}`);
                    throw new Error(errMsg);
                });
            }

            // Default OpenRouter path
            return openai.chat.completions.create({
                model: model.id,
                messages: [
                    { role: "system", content: getVoicePrompt(language, memories, reminders) },
                    ...validHistory,
                    { role: "user", content: text }
                ],
                temperature: 0.1,
                max_tokens: 200
            });
        }));

        const results = responses.map((res, idx) => {
            const modelId = modelsToCall[idx].id;
            const modelRole = modelsToCall[idx].role;

            if (res.status === 'fulfilled') {
                try {
                    let content = res.value.choices[0].message.content;

                    if (!content || content.trim().length === 0) {
                        throw new Error("Empty response from AI");
                    }

                    // Clean markdown if present
                    if (content.includes('```')) {
                        content = content.replace(/```json\n?|```/g, '').trim();
                    }

                    // Strict check: if it doesn't start with { it's likely prose
                    if (!content.trim().startsWith('{')) {
                        // Attempt to wrap prose as a chat response
                        return {
                            model: modelId,
                            role: modelRole,
                            success: true,
                            content: { type: "chat", data: null, reply: content.trim(), voice_reply: content.trim() },
                            error: null
                        };
                    }

                    const parsed = JSON.parse(content);
                    return {
                        model: modelId,
                        role: modelRole,
                        success: true,
                        content: parsed,
                        error: null
                    };
                } catch (parseErr) {
                    console.error(`[VoiceController] Failed to parse content from ${modelId}:`, parseErr.message);
                    return {
                        model: modelId,
                        role: modelRole,
                        success: false,
                        content: null,
                        error: `Parse Error: ${parseErr.message}`
                    };
                }
            } else {
                logToDisk(`Model ${modelId} failed: ${res.reason?.message || res.reason}`);
                return {
                    model: modelId,
                    role: modelRole,
                    success: false,
                    content: null,
                    error: res.reason?.message || "Model request failed"
                };
            }
        });

        // Consensus / Selection Logic
        let successfulResults = results.filter(r => r.success);

        // --- SELF-HEALING FALLBACK ---
        // If everything failed but we have a Gemini Key, try a direct emergency call!
        if (successfulResults.length === 0 && aiConfig.geminiApiKey) {
            console.warn("[VoiceController] OpenRouter failed. Attempting Emergency Gemini Recovery...");
            try {
                const recoveryClient = new OpenAI({
                    apiKey: aiConfig.geminiApiKey,
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai'
                });

                const recoveryResponse = await recoveryClient.chat.completions.create({
                    model: "gemini-1.5-flash",
                    messages: [
                        { role: "system", content: getVoicePrompt(language, memories, reminders) },
                        ...validHistory,
                        { role: "user", content: text }
                    ],
                    temperature: 0.1,
                    max_tokens: 250
                });

                if (recoveryResponse.choices?.[0]?.message?.content) {
                    let content = recoveryResponse.choices[0].message.content;
                    console.log("[VoiceController] Recovery Content Received (First 50 chars):", content.substring(0, 50));
                    if (content.includes('```')) content = content.replace(/```json\n?|```/g, '').trim();

                    const parsedContent = content.trim().startsWith('{')
                        ? JSON.parse(content)
                        : { type: "chat", data: null, reply: content.trim(), voice_reply: content.trim() };

                    successfulResults = [{
                        model: "gemini-recovery",
                        role: "Emergency Backup",
                        success: true,
                        content: parsedContent
                    }];
                    console.log("[VoiceController] Emergency Recovery Successful!");
                }
            } catch (recoveryErr) {
                console.error("[VoiceController] Emergency Recovery Failed:", recoveryErr.message);
            }
        }

        if (successfulResults.length === 0) {
            const errLog = `CRITICAL: All AI models failed for text: "${text}"`;
            console.warn(`[VoiceController] ${errLog}`);
            logToDisk(errLog);
            // Instead of throwing, return a friendly fallback response
            return res.status(200).json({
                success: true,
                data: {
                    type: "chat",
                    data: null,
                    reply: "I'm having a little trouble connecting to my brain right now! 🧠 Try again in a second or check your settings.",
                    voice_reply: "I'm having a little trouble connecting right now. One moment!"
                },
                isFallback: true
            });
        }

        // Selection Priority
        const expertResult = successfulResults.find(r => r.model.includes("claude"));
        const fallbackResult = successfulResults[0];

        let finalData = expertResult ? expertResult.content : fallbackResult.content;

        logToDisk(`AI Final Decision: Type=${finalData.type} | Reply=${finalData.reply?.substring(0, 30)}...`);

        // --- HANDLE MEMORY ACTIONS ---
        if (finalData.type === 'action_save_memory') {
            if (userId && finalData.data?.content) {
                try {
                    const newMem = await Memory.create({ userId, content: finalData.data.content });
                    logToDisk(`Memory Created: ID=${newMem._id} | Content="${finalData.data.content}"`);
                    console.log(`[VoiceController] Memory Saved: ${finalData.data.content}`);
                } catch (saveError) {
                    logToDisk(`Memory Save FAILED: ${saveError.message}`);
                    console.error("Failed to save memory:", saveError);
                    finalData.reply += " (Database error)";
                }
            }
            finalData.type = 'chat';
        } else if (finalData.type === 'action_delete_memory') {
            if (userId && (finalData.data?.memory_id || finalData.data?.target_keyword)) {
                try {
                    const query = { userId };
                    if (finalData.data.memory_id) {
                        query._id = finalData.data.memory_id;
                    } else {
                        query.content = { $regex: finalData.data.target_keyword, $options: 'i' };
                    }
                    const delMem = await Memory.findOneAndDelete(query);
                    logToDisk(`Memory Deleted: Success=${!!delMem} | Keyword=${finalData.data.target_keyword}`);
                    console.log(`[VoiceController] Memory Deleted: ${finalData.data.target_keyword || finalData.data.memory_id}`);
                } catch (err) {
                    logToDisk(`Memory Delete FAILED: ${err.message}`);
                    console.error("Delete memory error:", err);
                }
            }
            finalData.type = 'chat';
        } else if (finalData.type === 'action_update_memory') {
            if (userId && (finalData.data?.memory_id || finalData.data?.target_keyword) && finalData.data?.content) {
                try {
                    const query = { userId };
                    if (finalData.data.memory_id) {
                        query._id = finalData.data.memory_id;
                    } else {
                        query.content = { $regex: finalData.data.target_keyword, $options: 'i' };
                    }
                    const upMem = await Memory.findOneAndUpdate(query, { content: finalData.data.content });
                    logToDisk(`Memory Updated: Success=${!!upMem} | NewContent="${finalData.data.content}"`);
                    console.log(`[VoiceController] Memory Updated to: ${finalData.data.content}`);
                } catch (err) {
                    logToDisk(`Memory Update FAILED: ${err.message}`);
                    console.error("Update memory error:", err);
                }
            }
            finalData.type = 'chat';
        }

        // Metadata
        const executionTime = Date.now() - startTime;
        const aiMetadata = {
            totalModels: modelsToCall.length,
            successCount: successfulResults.length,
            modelsUsed: successfulResults.map(r => r.role),
            latency: executionTime,
            consensus: successfulResults.length > 1 && JSON.stringify(successfulResults[0].content?.data) === JSON.stringify(successfulResults[1].content?.data)
        };

        // Create or update conversation
        let savedConversationId = conversationId;
        if (userId) {
            try {
                const messageBatch = [
                    { role: 'user', content: text },
                    { role: 'assistant', content: finalData.reply }
                ];

                if (conversationId) {
                    await Conversation.findByIdAndUpdate(conversationId, {
                        $push: { messages: { $each: messageBatch } }
                    });
                } else {
                    const newConversation = await Conversation.create({
                        userId,
                        messages: messageBatch,
                        title: text.substring(0, 30) + (text.length > 30 ? '...' : '')
                    });
                    savedConversationId = newConversation._id;
                }
            } catch (convErr) {
                console.error("Failed to save conversation history:", convErr);
            }
        }

        res.status(200).json({
            success: true,
            data: finalData,
            meta: { ...aiMetadata, conversationId: savedConversationId }
        });

    } catch (error) {
        logToDisk(`ParseVoice FATAL ERROR: ${error.message}`);
        console.error("AI Parse Error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to parse voice input." });
    }
};

exports.saveReminder = async (req, res) => {
    try {
        const { reminderData, saveTo } = req.body;
        logToDisk(`SaveReminder Request: User=${req.user?._id} | SaveTo=${saveTo} | Title="${reminderData?.title}"`);

        console.log("[saveReminder] START processing. Method:", req.method);
        console.log("[saveReminder] Received Body:", JSON.stringify(req.body, null, 2));

        const userId = req.user?._id || req.body.userId;

        if (!userId) {
            logToDisk(`SaveReminder FAILED: User ID missing`);
            console.error("[saveReminder] User ID missing. Headers:", req.headers);
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }

        let savedReminder = null;
        let googleEventId = null;

        // Save to Google Calendar if requested
        if (saveTo === 'google' || saveTo === 'both') {
            if (reminderData.date && reminderData.time) {
                try {
                    console.log("[saveReminder] Attempting Google Calendar save...");
                    googleEventId = await createGoogleCalendarEvent(userId, reminderData);
                    logToDisk(`Google Calendar SUCCESS: EventID=${googleEventId}`);
                } catch (calError) {
                    logToDisk(`Google Calendar FAILED: ${calError.message}`);
                    console.error("[saveReminder] Google Calendar failed:", calError.message);
                }
            } else {
                console.log("[saveReminder] Google Calendar skipped: Missing date/time");
            }
        }

        // Create local record (Always do this so Buddy can track it)
        try {
            // Sanitize condition to ensure it matches Enum
            const validConditions = ['distance_check', 'time_only', 'none'];
            let sanitizedCondition = reminderData.condition;
            if (!validConditions.includes(sanitizedCondition)) {
                sanitizedCondition = 'none';
            }

            savedReminder = await Reminder.create({
                userId,
                title: reminderData.title,
                intent: reminderData.intent || 'generic',
                time: reminderData.time || null,
                date: reminderData.date || null,
                location: reminderData.location || null,
                condition: sanitizedCondition,
                priority: reminderData.priority || 'medium',
                bufferTime: reminderData.bufferTime || 15,
                geofenceRadius: reminderData.geofenceRadius || 500,
                repeat: reminderData.repeat || false,
                googleEventId: googleEventId,
                escalationTime: reminderData.escalationTime || 0,
                alerts: reminderData.alerts || { push: true, sms: false, email: false },
                smartFeatures: reminderData.smartFeatures || {
                    earlyWarning: false,
                    trafficAware: false,
                    itemExitGuards: false
                },
                backupContacts: reminderData.backupContacts || [],
                source: (saveTo === 'google' || googleEventId) ? 'google' : 'buddy'
            });
            logToDisk(`Local Reminder SUCCESS: ID=${savedReminder._id}`);
            console.log("[saveReminder] Local Reminder Created Successfully:", savedReminder._id);
        } catch (dbError) {
            logToDisk(`Local Reminder FAILED: ${dbError.message}`);
            console.error("[saveReminder] Database Create Error:", dbError);
            throw dbError; // Re-throw to be caught by outer catch
        }

        res.status(201).json({ success: true, message: "Reminder saved successfully", data: savedReminder });

    } catch (error) {
        logToDisk(`SaveReminder FATAL ERROR: ${error.message}`);
        console.error("[saveReminder] CRITICAL ERROR:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to save reminder", error: error.toString() });
    }
};

exports.getReminders = async (req, res) => {
    try {
        const userId = req.user._id;
        const query = {
            $or: [
                { userId: userId },
                { 'sharedWith.user': userId },
                { assignedTo: userId }
            ]
        };
        const results = await paginate(Reminder, query, req.query);

        // Populate creator and share details
        results.data = await Reminder.populate(results.data, [
            { path: 'userId', select: 'name email' },
            { path: 'sharedWith.user', select: 'name email' }
        ]);

        res.status(200).json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch reminders" });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        // Find the reminder
        const reminder = await Reminder.findOne({ _id: id, userId });

        if (!reminder) {
            return res.status(404).json({ success: false, message: "Reminder not found" });
        }

        // If synced with Google Calendar, try to delete from there too
        if (reminder.googleEventId) {
            try {
                await deleteGoogleCalendarEvent(userId, reminder.googleEventId);
            } catch (calError) {
                console.error("Failed to delete from Google Calendar:", calError.message);
                // Continue with local deletion even if Google deletion fails
            }
        }

        // Delete from database
        await Reminder.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Reminder deleted successfully" });
    } catch (error) {
        console.error("Delete reminder error:", error);
        res.status(500).json({ success: false, message: "Failed to delete reminder" });
    }
};

exports.updateReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const updateData = req.body;
        const { saveTo } = updateData;

        // Find the reminder
        const reminder = await Reminder.findOne({ _id: id, userId });

        if (!reminder) {
            return res.status(404).json({ success: false, message: "Reminder not found" });
        }

        // Handle Google Calendar Synchronization
        let googleEventId = reminder.googleEventId;

        if (saveTo === 'google' || saveTo === 'both' || googleEventId) {
            try {
                // Merge old data with new data for complete calendar update
                const mergedData = { ...reminder.toObject(), ...updateData };
                if (mergedData.date && mergedData.time) {
                    if (googleEventId) {
                        // Update existing event
                        await updateGoogleCalendarEvent(userId, googleEventId, mergedData);
                    } else {
                        // Create new event
                        googleEventId = await createGoogleCalendarEvent(userId, mergedData);
                        updateData.googleEventId = googleEventId; // Ensure it's saved to DB below
                        updateData.source = 'google';
                    }
                }
            } catch (calError) {
                console.error("Failed to sync with Google Calendar:", calError.message);
                // We continue with local update even if Google fails
            }
        }

        // Update in database
        const updatedReminder = await Reminder.findByIdAndUpdate(id, updateData, { new: true });

        res.status(200).json({ success: true, message: "Reminder updated successfully", data: updatedReminder });
    } catch (error) {
        console.error("Update reminder error:", error);
        res.status(500).json({ success: false, message: "Failed to update reminder" });
    }
};

exports.getGoogleAuthUrl = async (req, res) => {
    try {
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne();

        const googleConfig = settings?.googleCalendar;
        const activeAccount = googleConfig?.activeAccount || 'personal';
        const accountConfig = googleConfig?.accounts?.[activeAccount];

        const clientId = accountConfig?.clientId || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = accountConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = accountConfig?.redirectUri || process.env.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret) {
            return res.status(400).json({ success: false, message: "Google Calendar credentials not configured." });
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );
        const scopes = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];
        const state = req.user._id.toString();
        const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes, state: state, prompt: 'consent' });
        res.status(200).json({ success: true, url });
    } catch (error) {
        console.error("Auth URL Error:", error);
        res.status(500).json({ success: false, message: "Could not generate Auth URL" });
    }
};

exports.googleCallback = async (req, res) => {
    try {
        const { code, state: userId } = req.query;
        if (!code) return res.status(400).send("No code provided from Google");

        const Settings = require('../models/Settings');
        const settings = await Settings.findOne().select('+googleCalendar.accounts.personal.clientSecret +googleCalendar.accounts.work.clientSecret +googleCalendar.accounts.business.clientSecret');

        const googleConfig = settings?.googleCalendar;
        const activeAccount = googleConfig?.activeAccount || 'personal';
        const accountConfig = googleConfig?.accounts?.[activeAccount];

        const clientId = accountConfig?.clientId || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = accountConfig?.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = accountConfig?.redirectUri || process.env.GOOGLE_REDIRECT_URI;

        console.log('OAuth Callback - Using credentials:', {
            clientId: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
            clientSecret: clientSecret ? 'SET' : 'MISSING',
            redirectUri,
            activeAccount
        });

        if (!clientId || !clientSecret) {
            throw new Error('Google Calendar credentials not configured. Please set Client ID and Client Secret in Admin Settings.');
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);
        const User = require('../models/User');
        const updateData = {};
        if (tokens.refresh_token) updateData.googleRefreshToken = tokens.refresh_token;

        await User.findByIdAndUpdate(userId, updateData);

        res.send(`
            <html>
                <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0;">
                    <div style="text-align: center; background: #1e293b; padding: 3rem; border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); max-width: 400px;">
                        <div style="width: 64px; height: 64px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: white;"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <h2 style="color: white; margin: 0 0 1rem; font-size: 1.75rem;">Connected!</h2>
                        <p style="color: #94a3b8; line-height: 1.6; margin-bottom: 2rem;">Your Google Calendar is now successfully linked to Buddy.</p>
                        <p style="color: #64748b; font-size: 0.85rem;">This window will close automatically.</p>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
                            }
                            setTimeout(() => { window.close(); }, 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Callback Error:", error);
        res.status(500).send("Authentication failed. Please check server logs.");
    }
};

// Google helper functions removed - now using googleCalendarService.js

exports.getMemories = async (req, res) => {
    try {
        const userId = req.user._id;
        const results = await paginate(Memory, { userId }, req.query);
        res.status(200).json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch memories" });
    }
};

exports.deleteMemory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        await Memory.findOneAndDelete({ _id: id, userId });
        res.status(200).json({ success: true, message: "Memory deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete memory" });
    }
};

exports.uploadPrescription = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const userId = req.user._id;
        const language = req.body.language || 'en-US';
        const mimeType = req.file.mimetype;
        const filePath = path.resolve(req.file.path);

        logToDisk(`Prescription Analysis Start: File=${req.file.filename} | Lang=${language}`);
        console.log(`[VoiceController] Analyzing prescription: ${req.file.path}`);

        // Convert image to base64 for AI analysis
        const base64Image = fs.readFileSync(filePath, { encoding: 'base64' });
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const medicalPrompt = `Extract as much information as possible from this medical prescription into a valid JSON object. 
        Language: ${language}.
        JSON structure: {
            "patientName": "string",
            "doctorName": "string",
            "medicines": [
                {
                    "name": "string",
                    "dosage": "string",
                    "frequency": { "morning": boolean, "afternoon": boolean, "night": boolean },
                    "timing": "string (e.g., Before food)",
                    "duration": "string",
                    "instructions": "string"
                }
            ],
            "notes": "string",
            "warnings": "string",
            "summary": "Short friendly summary of the prescription"
        }`;

        let response;
        let finalContent;
        const models = ["openai/gpt-4o-mini", "meta-llama/llama-3.2-11b-vision-instruct", "google/gemini-flash-1.5"];

        let lastError;
        for (const modelId of models) {
            try {
                console.log(`[VoiceController] Attempting analysis with model: ${modelId}`);
                response = await openai.chat.completions.create({
                    model: modelId,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: medicalPrompt },
                                { type: "image_url", image_url: { url: dataUrl } }
                            ]
                        }
                    ],
                    max_tokens: 800,
                    response_format: { type: "json_object" }
                });

                if (response.choices && response.choices[0].message.content) {
                    finalContent = response.choices[0].message.content;
                    console.log(`[VoiceController] Success with model: ${modelId}`);
                    break;
                }
            } catch (err) {
                console.warn(`[VoiceController] Model ${modelId} failed:`, err.message);
                lastError = err;
                if (err.status === 402) continue; // Try next model if credits low on this one
            }
        }

        if (!finalContent) {
            throw lastError || new Error("All AI models failed to analyze the document.");
        }

        // Clean and parse
        let extractedInfo;
        try {
            // Remove potential markdown wrappers
            let cleanJson = finalContent;
            if (cleanJson.includes('```')) {
                cleanJson = cleanJson.replace(/```json\n?|```/g, '').trim();
            }
            extractedInfo = JSON.parse(cleanJson);
        } catch (parseErr) {
            console.error("[VoiceController] JSON Parse Error. Content:", finalContent);
            // Fallback to minimal object if parsing fails but we have a response
            extractedInfo = { summary: "We processed your prescription, but couldn't extract all details perfectly.", medicines: [] };
        }

        // Save to Database
        const prescription = await Prescription.create({
            userId,
            fileName: req.file.filename,
            fileUrl: `/uploads/${req.file.filename}`,
            mimeType,
            extractedData: extractedInfo,
            summary: extractedInfo.summary || "Medical document processed and saved.",
            status: 'processed'
        });

        logToDisk(`Prescription SUCCESS: ID=${prescription._id}`);

        res.status(200).json({
            success: true,
            data: prescription,
            message: "Prescription analyzed successfully"
        });

    } catch (error) {
        logToDisk(`Prescription FATAL ERROR: ${error.message}`);
        console.error("[VoiceController] Prescription Error:", error);

        let statusCode = 500;
        let message = "Failed to analyze document";

        if (error.status === 402 || error.message?.includes('402')) {
            statusCode = 402;
            message = "AI service quota exceeded. Please check credits.";
        }

        res.status(statusCode).json({
            success: false,
            message,
            error: error.message
        });
    }
};

exports.confirmMedicalReminders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { prescriptionId, confirmationData } = req.body;

        const createdReminders = [];

        for (const med of confirmationData.medicines) {
            // Create reminders based on frequency
            const times = [];
            if (med.frequency.morning) times.push("09:00");
            if (med.frequency.afternoon) times.push("14:00");
            if (med.frequency.night) times.push("21:00");

            for (const time of times) {
                const reminder = new Reminder({
                    userId,
                    prescriptionId,
                    title: `Take ${med.name} (${med.dosage})`,
                    intent: 'medicine',
                    time,
                    date: med.startDate || new Date().toISOString().split('T')[0],
                    repeat: true, // Medical reminders usually repeat
                    medicineDetails: {
                        dosage: med.dosage,
                        frequency: med.frequency,
                        timing: med.timing,
                        duration: med.duration,
                        instructions: med.instructions
                    },
                    status: 'pending'
                });
                await reminder.save();
                createdReminders.push(reminder);
            }
        }

        res.status(200).json({
            success: true,
            message: `Successfully created ${createdReminders.length} reminders`,
            data: createdReminders
        });

    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to create reminders" });
    }
};

// Prescription CRUD
exports.getPrescriptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const results = await paginate(Prescription, { userId }, req.query);
        res.status(200).json({ success: true, ...results });
    } catch (error) {
        console.error("Fetch Prescriptions Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch prescriptions", error: error.message });
    }
};

exports.getPrescriptionById = async (req, res) => {
    try {
        const userId = req.user._id;
        const prescription = await Prescription.findOne({ _id: req.params.id, userId });
        if (!prescription) {
            return res.status(404).json({ success: false, message: "Prescription not found" });
        }
        res.status(200).json({ success: true, data: prescription });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch prescription details" });
    }
};

exports.updatePrescription = async (req, res) => {
    try {
        const userId = req.user._id;
        const prescription = await Prescription.findOneAndUpdate(
            { _id: req.params.id, userId },
            req.body,
            { new: true }
        );
        if (!prescription) {
            return res.status(404).json({ success: false, message: "Prescription not found" });
        }
        res.status(200).json({ success: true, data: prescription, message: "Prescription updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update prescription" });
    }
};

exports.deletePrescription = async (req, res) => {
    try {
        const userId = req.user._id;
        const prescription = await Prescription.findOne({ _id: req.params.id, userId });

        if (!prescription) {
            return res.status(404).json({ success: false, message: "Prescription not found" });
        }

        // Optional: Delete physical file
        try {
            const filePath = path.join(process.cwd(), prescription.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fErr) {
            console.error("File deletion error:", fErr);
        }

        // Delete reminders linked to this prescription
        await Reminder.deleteMany({ prescriptionId: prescription._id });

        await Prescription.deleteOne({ _id: req.params.id, userId });

        res.status(200).json({ success: true, message: "Prescription and linked reminders deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete prescription" });
    }
};
