const { GoogleGenerativeAI } = require('@google/generative-ai');
const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');
const Settings = require('../models/Settings');
const { getFallbackKey } = require('../utils/configHelper');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');

// Configuration
let genAI = null;

let _cachedGeminiKey = null;
let _lastGeminiCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000;

async function getGenAI() {
    if (genAI) return genAI;

    let apiKey = null;
    const now = Date.now();

    // 1. Try DB Settings First with 60s Cache
    try {
        if (_cachedGeminiKey && (now - _lastGeminiCacheTime < CACHE_TTL_MS)) {
            apiKey = _cachedGeminiKey;
        } else {
            const settings = await Settings.findOne().select('+ai.geminiApiKey');
            apiKey = settings?.ai?.geminiApiKey;
            _cachedGeminiKey = apiKey;
            _lastGeminiCacheTime = now;
        }
    } catch (err) {
        console.error('[GeminiService] Database error while fetching key:', err.message);
    }

    // 2. Fallback to .env (Lowest Priority)
    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '') {
        apiKey = getFallbackKey('GEMINI_API_KEY');
    }

    if (!apiKey || apiKey.trim() === '') {
        console.error('[GeminiService] ERROR: No Gemini API Key found in .env or Settings collection.');
        return null;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey.trim());
        console.log('[GeminiService] Google AI Engine initialized.');
        return genAI;
    } catch (e) {
        console.error('[GeminiService] Initialization error:', e.message);
        return null;
    }
}

// Tool Implementation Logic
const toolHandlers = {
    create_reminder: async (userId, args, userContext) => {
        console.log(`[GeminiTools] Executing create_reminder for user ${userId}`);
        try {
            const { title, time, notes, date, location, priority, repeat, triggerEvent, subtasks, contactTrigger } = args;
            const reminderDate = date || userContext.localDate || new Date().toLocaleDateString('en-CA');

            // Automatically geocode location if provided to get coordinates
            let coordinates = { lat: null, lng: null };
            if (location) {
                try {
                    const { geocodeAddress } = require('./smartReminderService');
                    const User = require('../models/User'); // Import here if not available globally
                    const user = await User.findById(userId);

                    // Geocode with user's current location to bias results (e.g., finding Anna Nagar in Madurai instead of Chennai)
                    const result = await geocodeAddress(location, user?.currentLocation);
                    if (result) {
                        coordinates = result;
                    }
                } catch (geoErr) {
                    console.error('[GeminiTools] Geocoding failed:', geoErr.message);
                }
            }

            // Map intent based on title keywords
            let intent = 'generic';
            const titleLower = title.toLowerCase();
            if (titleLower.includes('medicine') || titleLower.includes('pill') || titleLower.includes('dosage')) intent = 'medicine';
            else if (titleLower.includes('meet') || titleLower.includes('call')) intent = 'meeting';
            else if (titleLower.includes('pickup') || titleLower.includes('drop')) intent = 'pickup';
            else if (titleLower.includes('bill') || titleLower.includes('pay')) intent = 'bill';

            const reminderData = {
                userId,
                title,
                time,
                location: location || '',
                coordinates,
                date: reminderDate,
                intent: intent,
                source: 'buddy',
                priority: priority || 'medium',
                repeat: repeat || false,
                subtasks: Array.isArray(subtasks) ? subtasks.map(t => ({ title: t })) : [],
                contactTrigger: contactTrigger || null,
                smartFeatures: {
                    earlyWarning: true,
                    trafficAware: true,
                    itemExitGuards: true
                },
                alerts: {
                    push: true,
                    email: true
                }
            };

            // Only add notes if the schema has it
            let finalNotes = notes || '';
            if (triggerEvent && triggerEvent.toLowerCase() === 'leave') {
                finalNotes += (finalNotes ? '\n' : '') + 'Trigger: When leaving location';
                reminderData.condition = 'distance_check';
            }
            if (contactTrigger) {
                reminderData.condition = 'contact_check';
                reminderData.reminderType = 'contact';
            }
            
            // Contextual Auto-enrichment from Memory
            try {
                const words = title.split(' ').filter(w => w.length > 3);
                if (words.length > 0) {
                    const regex = new RegExp(words.join('|'), 'i');
                    const relatedMemories = await Memory.find({ userId, content: regex }).limit(3);
                    if (relatedMemories.length > 0) {
                        finalNotes += (finalNotes ? '\n\n' : '') + '💡 Auto-Enriched Context:';
                        relatedMemories.forEach(m => { finalNotes += '\n- ' + m.content; });
                    }
                }
            } catch(e) { console.error('Enrichment error:', e); }

            if (finalNotes) reminderData.notes = finalNotes;

            // Check for conflict
            let conflictWarning = '';
            try {
                if (reminderDate && time) {
                    const existing = await Reminder.findOne({ 
                        userId, 
                        date: reminderDate, 
                        time: time,
                        status: { $nin: ['completed', 'cancelled'] }
                    });
                    if (existing) {
                        conflictWarning = ` Note: The user already has a reminder scheduled at this exact time ("${existing.title}"). Please inform them about this scheduling conflict.`;
                    }
                }
            } catch(e) { console.error('Gemini conflict check error:', e); }

            // Create reminder in database
            console.log('[GeminiTools] Creating reminder in DB:', JSON.stringify(reminderData));
            const reminder = await Reminder.create(reminderData);

            // Background Google Calendar Sync
            const { syncReminder } = require('./googleCalendarService');
            syncReminder(user, reminder).then(async (googleEventId) => {
                if (googleEventId) {
                    await Reminder.findByIdAndUpdate(reminder._id, {
                        googleEventId,
                        source: 'google'
                    });
                    console.log(`[GeminiSync] Updated reminder ${reminder._id} with Google Event ID: ${googleEventId}`);
                }
            }).catch(err => console.error('[GeminiSync] Background sync error:', err));


            let message = `Reminder created${location ? ` for ${location}` : ''}.`;
            if (location && !coordinates.lat) {
                message += " Note: I couldn't find the exact map coordinates for this location. Please check your Google Maps settings.";
            }
            message += conflictWarning;

            console.log(`[GeminiTools] Reminder created successfully: ${reminder._id}`);
            return { status: 'success', message: message, data: reminder };
        } catch (err) {
            console.error('[GeminiTools] create_reminder error:', err);
            throw err; // Re-throw so the caller can handle it
        }
    },
    get_user_info: async (userId) => {
        return {
            name: 'User',
            status: 'Active',
            medications: ['Aspirin', 'Lisinopril'] // Ideally fetch from DB
        };
    },
    save_memory: async (userId, args) => {
        const { content, category, tags, expiresInHours } = args;
        const memory = await Memory.create({
            userId,
            content,
            category: category || 'general',
            tags: tags || [],
            expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000) : null
        });

        // Sync with Python Vector Store
        try {
            const aiServiceUrl = config.AI_SERVICE_URL;
            const learningDataDir = path.join(__dirname, '../../ai-service/database/learning_data');

            // Ensure directory exists
            if (!fs.existsSync(learningDataDir)) {
                fs.mkdirSync(learningDataDir, { recursive: true });
            }

            // Append to user-specific learning file
            const userFile = path.join(learningDataDir, `memories_${userId}.txt`);
            fs.appendFileSync(userFile, `\n${content}`);

            // Trigger Python to reload the vector store
            await axios.post(`${aiServiceUrl}/system/reload`, {}, {
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            }).catch(e => console.error('[MemorySync] Reload trigger failed:', e.message));

            console.log(`[MemorySync] Memory synced to Python vector store for user ${userId}`);
        } catch (syncErr) {
            console.error('[MemorySync] Failed to sync memory to Python:', syncErr.message);
        }

        return { status: 'success', message: 'Memory saved.', data: memory };
    },
    list_reminders: async (userId, args, userContext) => {
        const { date } = args;
        // If date is 'today', use normalized server date for user's timezone
        const targetDate = date === 'today' ? userContext.localDate : date;

        let query = { userId, status: 'pending' };
        if (targetDate) {
            query.date = targetDate;
        }

        console.log(`[GeminiTools] list_reminders query:`, query);
        const reminders = await Reminder.find(query).sort({ date: 1, time: 1 });

        return {
            status: 'success',
            requestedDate: targetDate || 'all upcoming',
            hasReminders: reminders.length > 0,
            reminders: reminders.map(r => ({
                id: r._id,
                title: r.title,
                time: r.time,
                date: r.date,
                status: r.status
            }))
        };
    },
    delete_reminder: async (userId, args) => {
        const { id, title } = args;
        let query = { userId };
        if (id) query._id = id;
        else if (title) query.title = { $regex: title, $options: 'i' };
        else return { status: 'error', message: 'ID or title required.' };

        const reminder = await Reminder.findOne(query);
        if (!reminder) return { status: 'error', message: 'Reminder not found.' };

        // --- GOOGLE CALENDAR SYNK DELETE ---
        if (reminder.googleEventId) {
            try {
                const { deleteGoogleCalendarEvent } = require('./googleCalendarService');
                await deleteGoogleCalendarEvent(userId, reminder.googleEventId);
                console.log('[GeminiTools] Deleted from Google Calendar.');
            } catch (calErr) {
                console.error('[GeminiTools] Google Calendar delete failed:', calErr.message);
            }
        }

        await Reminder.deleteOne({ _id: reminder._id });
        return { status: 'success', message: 'Reminder deleted.' };
    },
    update_reminder: async (userId, args) => {
        const { id, title, updateData } = args;
        let query = { userId };
        if (id) query._id = id;
        else if (title) query.title = { $regex: title, $options: 'i' };
        else return { status: 'error', message: 'ID or title required.' };

        const reminder = await Reminder.findOne(query);
        if (!reminder) return { status: 'error', message: 'Reminder not found.' };

        // Simple merge
        Object.assign(reminder, updateData);

        // Background Google Calendar Sync Update
        const { syncReminder, updateGoogleCalendarEvent } = require('./googleCalendarService');
        if (user && user.googleRefreshToken) {
            if (reminder.googleEventId) {
                updateGoogleCalendarEvent(userId, reminder.googleEventId, reminder.toObject()).catch(err => {
                    console.error('[GeminiSync] Update Google Sync failed:', err.message);
                });
            } else {
                syncReminder(user, reminder).then(async (googleEventId) => {
                    if (googleEventId) {
                        await Reminder.findByIdAndUpdate(reminder._id, {
                            googleEventId,
                            source: 'google'
                        });
                        console.log(`[GeminiSync] New Google Event created during update: ${googleEventId}`);
                    }
                }).catch(err => console.error('[GeminiSync] Background sync error during update:', err));
            }
        }

        await reminder.save();

        return { status: 'success', message: 'Reminder updated.', data: reminder };
    },
    bulk_reschedule_reminders: async (userId, args) => {
        const { currentDate, newDate } = args;
        if (!currentDate || !newDate) return { status: 'error', message: 'Both currentDate and newDate are required.' };
        
        const result = await Reminder.updateMany(
            { userId, date: currentDate, status: 'pending' },
            { $set: { date: newDate } }
        );
        
        return { status: 'success', message: `Successfully rescheduled ${result.modifiedCount} reminders from ${currentDate} to ${newDate}.` };
    },
    list_memories: async (userId) => {
        const memories = await Memory.find({ userId }).sort({ createdAt: -1 }).limit(10);
        return { status: 'success', memories: memories.map(m => m.content) };
    },
    delete_memory: async (userId, args) => {
        const { id, query: contentSnippet } = args;
        let query = { userId };
        if (id) query._id = id;
        else if (contentSnippet) query.content = { $regex: contentSnippet, $options: 'i' };
        else return { status: 'error', message: 'ID or snippet required.' };

        await Memory.deleteOne(query);
        return { status: 'success', message: 'Delete successful.' };
    },
    update_memory: async (userId, args) => {
        const { id, query: contentSnippet, newContent } = args;
        let query = { userId };
        if (id) query._id = id;
        else if (contentSnippet) query.content = { $regex: contentSnippet, $options: 'i' };
        else return { status: 'error', message: 'ID or snippet required.' };

        const result = await Memory.updateOne(query, { content: newContent });
        if (result.matchedCount === 0) {
            return { status: 'error', message: 'No matching memory found to update.' };
        }
        return { status: 'success', message: 'Memory updated successfully.' };
    },
    search_memories: async (userId, args) => {
        const { query: searchStr } = args;

        try {
            console.log(`[GeminiTools] Performing semantic memory search for: ${searchStr}`);
            const aiServiceUrl = config.AI_SERVICE_URL;
            const resp = await axios.get(`${aiServiceUrl}/tools/memory`, {
                params: { query: searchStr, k: 7 },
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });

            if (resp.data && resp.data.results && resp.data.results.length > 0) {
                return { status: 'success', results: resp.data.results };
            }
        } catch (err) {
            console.error('[GeminiTools] Semantic search failed, falling back to regex:', err.message);
        }

        // Fallback to simple MongoDB regex search
        const memories = await Memory.find({
            userId,
            content: { $regex: searchStr, $options: 'i' }
        }).limit(5);
        return { status: 'success', results: memories.map(m => m.content) };
    },
    get_medication_info: async (userId, args) => {
        const { medication_name } = args;
        return { status: 'success', message: `Knowledge Base info for ${medication_name}: Used for managing blood pressure. Side effects may include dizziness.` };
    },
    analyze_health_summary: async (userId, args, userContext) => {
        const [reminders, memories] = await Promise.all([
            Reminder.find({ userId, date: userContext.localDate }),
            Memory.find({ userId }).limit(10)
        ]);
        return {
            status: 'success',
            data: {
                todays_reminders: reminders,
                stored_memories: memories,
                user_context: { status: 'Active', date: userContext.localDate }
            }
        };
    },
    navigate_to: async (userId, args) => {
        const { screen } = args;
        return {
            status: 'success',
            message: `Redirecting to ${screen} page...`,
            screen: screen
        };
    },
    web_search: async (userId, args) => {
        const { query } = args;
        try {
            console.log(`[GeminiTools] Performing premium web search for: ${query}`);
            const aiServiceUrl = config.AI_SERVICE_URL;
            const resp = await axios.get(`${aiServiceUrl}/tools/search`, {
                params: { query },
                headers: { 'X-API-Key': config.BUDDY_API_KEY }
            });

            if (resp.data && resp.data.formatted) {
                return { status: 'success', results: resp.data.formatted };
            }
            return { status: 'error', message: 'No results found.' };
        } catch (err) {
            console.error('[GeminiTools] Web search failed:', err.message);
            return { status: 'error', message: 'Deep search service is currently unavailable.' };
        }
    }
};

const buddyTools = [
    {
        functionDeclarations: [
            {
                name: 'create_reminder',
                description: 'Set a new medication or health reminder for the user.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        title: { type: 'STRING', description: 'The title or medication name' },
                        time: { type: 'STRING', description: 'The time (e.g. 08:00 PM)' },
                        location: { type: 'STRING', description: 'Address or place name for location-based alerts' },
                        notes: { type: 'STRING', description: 'Additional instructions' },
                        date: { type: 'STRING', description: 'The date (YYYY-MM-DD)' },
                        priority: { type: 'STRING', description: 'Priority level: "low", "medium", or "high". Default is "medium"' },
                        repeat: { type: 'BOOLEAN', description: 'Set to true if this is a recurring/repeating reminder' },
                        triggerEvent: { type: 'STRING', description: 'For location reminders: "arrive" or "leave". Defaults to "arrive"' },
                        subtasks: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Checklist of sub-tasks needed to complete this main reminder' },
                        contactTrigger: { type: 'STRING', description: 'Name of the contact for communication triggers (e.g. "when I call Mom")' }
                    },
                    required: ['title', 'time']
                }
            },
            {
                name: 'get_user_info',
                description: 'Get information about the current user and their active medications.',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'save_memory',
                description: 'Save an important fact or piece of information about the user. DO NOT use this for reminders.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'The fact or information to remember' },
                        category: { type: 'STRING', description: 'Optional category (health, personal, etc.)' },
                        tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Array of keywords or tags (e.g., ["health", "family"])' },
                        expiresInHours: { type: 'NUMBER', description: 'If this memory is temporary (like a parking spot), the number of hours until it should expire/be forgotten.' }
                    },
                    required: ['content']
                }
            },
            {
                name: 'list_reminders',
                description: 'Fetch the list of reminders for a specific date or all pending reminders.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        date: { type: 'STRING', description: 'The date to filter by (YYYY-MM-DD). Use "today" for the current date.' }
                    }
                }
            },
            {
                name: 'delete_reminder',
                description: 'Delete a specific reminder by its ID or title.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING', description: 'The internal ID' },
                        title: { type: 'STRING', description: 'The title to match' }
                    }
                }
            },
            {
                name: 'update_reminder',
                description: 'Update an existing reminder with new information (e.g., change time, location, or notes).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING', description: 'The internal ID' },
                        title: { type: 'STRING', description: 'The current title to match' },
                        updateData: {
                            type: 'OBJECT',
                            properties: {
                                title: { type: 'STRING', description: 'New title' },
                                time: { type: 'STRING', description: 'New time' },
                                location: { type: 'STRING', description: 'New location' },
                                notes: { type: 'STRING', description: 'New notes' },
                                date: { type: 'STRING', description: 'New date (YYYY-MM-DD)' }
                            }
                        }
                    },
                    required: ['updateData']
                }
            },
            {
                name: 'bulk_reschedule_reminders',
                description: 'Bulk shift all pending reminders from one date to another date (e.g. push all of today\'s tasks to tomorrow).',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        currentDate: { type: 'STRING', description: 'The current date to find reminders for (YYYY-MM-DD)' },
                        newDate: { type: 'STRING', description: 'The new target date to move them to (YYYY-MM-DD)' }
                    },
                    required: ['currentDate', 'newDate']
                }
            },
            {
                name: 'list_memories',
                description: 'Fetch the list of stored memories (buddy memories).',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'delete_memory',
                description: 'Permanently delete a specific memory by its ID or content fragment. Use this when the user explicitly asks to remove, forget, or delete a piece of information.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING', description: 'The internal ID' },
                        query: { type: 'STRING', description: 'A snippet of the content to match' }
                    }
                }
            },
            {
                name: 'update_memory',
                description: 'Update a specific stored memory with new information. Use this ONLY when the user wants to change existing information, NOT for deleting it.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        id: { type: 'STRING', description: 'The internal ID' },
                        query: { type: 'STRING', description: 'A snippet of the existing content to match' },
                        newContent: { type: 'STRING', description: 'The new completely updated fact or information' }
                    },
                    required: ['newContent']
                }
            },
            {
                name: 'search_memories',
                description: 'Search for a specific piece of information in stored memories.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'The search term' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'web_search',
                description: 'Search the live web for real-time information, news, current events, or deep research topics.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'The search query' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'get_medication_info',
                description: 'Get detailed information about a medication.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        medication_name: { type: 'STRING', description: 'The name of the medication' }
                    },
                    required: ['medication_name']
                }
            },
            {
                name: 'analyze_health_summary',
                description: 'Analyze the users health state using today\'s reminders and memories.',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'navigate_to',
                description: 'Navigate the user to a specific screen in the app. Available screens: "dialogue", "explore", "memories", "settings", "reminders".',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        screen: {
                            type: 'STRING',
                            description: 'The screen to navigate to. "dialogue" for Chat, "explore" for Explore/Suggestions, "memories" for Saved Memories list, "settings" for Account Settings, "reminders" for the full Reminder/Task list.'
                        }
                    },
                    required: ['screen']
                }
            }
        ]
    }
];

const { getPersonality } = require('../utils/personality');

const geminiService = {
    /**
     * Entry point for processing text via Gemini with Tools
     */
    generateResponse: async (text, userId, context = {}, targetLanguage = 'en-US', image = null) => {
        try {
            const userContext = context.userContext || {
                localDate: new Date().toLocaleDateString('en-CA'),
                timeZone: 'UTC',
                voicePreferences: { gender: 'female', tone: 'normal' },
                dateFormat: 'DD/MM/YYYY',
                timeFormat: '12'
            };


            const personality = getPersonality(
                userContext.voicePreferences?.gender || 'female',
                userContext.voicePreferences?.tone || 'normal'
            );

            const activeGenAI = await getGenAI();
            if (!activeGenAI) throw new Error("Gemini API Key not configured.");

            const notLoggedInInstruction = !userId ? `
                5. GUEST USER RULE (CRITICAL):
                   - The user is currently NOT LOGGED IN.
                   - **ALLOWED**: General knowledge questions (e.g., "What is the budget?", "Tell me a joke", "What is the news"), greetings, local current affairs, and helpful conversation are ALWAYS allowed.
                   - **RESTRICTED**: If the user asks for *their own* personal data (e.g., "What are *my* reminders?", "Check *my* memory", "Save this as *my* note"), you MUST refuse and reply with: "Please login to check or save your personal reminders and memories."
                   - Do NOT call any tools relating to memories or reminders for a guest user.` : ``;

            const modelTools = [...buddyTools]; // Always allow tools; individual handlers (like create_reminder) already check for userId internally for security.
            // Remove { googleSearch: {} } as it cannot be combined with custom tools in this API version
            // Search is already provided as a custom tool via the search_memories/web_search logic.

            const model = activeGenAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: `SYSTEM IDENTITY:
- Your name is Buddy.
- PERSONALITY: ${personality.description}
- WRITING STYLE: ${personality.writingStyle}

CRITICAL: YOUR FINAL HUMAN-LIKE ANSWER MUST START WITH THE MARKER "[ACK]". Output absolutely NOTHING before "[ACK]". If you are searching, do it perfectly silently. DO NOT generate ANY text until you have the final conversational reply starting with "[ACK]". Example: "[ACK] The T20 World Cup format is..."

VOICE CONTEXT: You are communicating with the user using the '${personality.voice}' voice. Your responses MUST reflect this persona's tone.

USER CONTEXT:
- Current User Date: ${userContext.localDate}
- User Timezone: ${userContext.timeZone}
- User Language Preference: ${targetLanguage}

RECENT MEMORIES (Facts/Notes):
${context.memories && context.memories.length > 0 ? context.memories.join('\\n') : 'No recent memories found.'}

UPCOMING REMINDERS:
${context.reminders && context.reminders.length > 0 ? context.reminders.map(r => '- ' + r.title + ' at ' + r.time + ' (' + r.date + ')').join('\\n') : 'No upcoming reminders found.'}

STRICT RULES:
1. DO NOT THINK ALOUD OR NARRATE ACTIONS (CRITICAL): You must execute your tool calls perfectly silently. NEVER output ANY transitional phrases. NEVER say "Initiating search", "I am starting research", "I've initiated searches", "My next step is", or "I'll summarize". NEVER say "I am checking your reminders". 
2. Just reply naturally like a human WITHOUT explaining your internal thought process. ONLY output the direct, final conversational reply to the user.
3. INTERNAL REASONING IS FORBIDDEN: NEVER include sentences about your planning, focus, or interpretation of user intent. (e.g., "I'm focusing on...", "I'll use...", "I've decided to...", "My primary focus is...").
4. NO SEARCH COMMENTARY: When you find information via Google Search, DO NOT explain that you are finding it. Just provide the final answer immediately. Your entire response should ONLY consist of the final information the user requested. NEVER explain how you will synthesize key points.
4b. NO CONTEXT COMMENTARY: NEVER mention that you are reading from "saved memories", "context", "notes", or "history". Speak naturally as if you just know it (e.g., instead of "According to your saved memories, your wallet is in the red bag", just say "Your wallet is in the red bag.")

5. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
   - Schedule/Tasks -> Use 'list_reminders' with date="today" if not in UPCOMING list.
   - Facts/Notes/History -> Use 'search_memories' or 'list_memories'.

5. NO HALLUCINATION: If the tool result is empty, say so. Do NOT invent data. For general queries like "who is the cm in tn" or global news, use your knowledge base or google search tool to answer it natively!

6. DATE, LOCATION & ACTION SENSITIVITY:
   - "Today" is ${userContext.localDate}.
   - You MUST resolve relative dates like "tomorrow", "yesterday", or "next Monday" into the exact YYYY-MM-DD format using today's date. 
   - NEVER ask the user for confirmation if they give a relative date and time (e.g. "tomorrow at 5pm"). Calculate it yourself and call the tool IMMEDIATELY.
   - NEVER ask "Do you mean [Date]?", just assume you are correct and trigger the 'create_reminder' tool right away.
   - If a user mentions a place (e.g., "at school", "in Periyar bus stand"), you MUST extract this into the 'location' parameter when calling 'create_reminder'.

7. MULTILINGUAL SUPPORT:
   - You are a native speaker of multiple languages including **Tamil**, Hindi, Spanish, French, etc.
   - English is the default language for both interpreting the user's text and replying.
   - Switch to another language only when the user explicitly requests that language or when User Language Preference is not English/en-US.
   - Do not switch languages merely because the user includes a word, phrase, name, or example from another language.
   - NEVER refuse a request to speak a different language. You are fully capable of it.
   - Be professional, sympathetic, and concise.

8. DO NOT EXPLAIN: Never explain your internal reasonings, constraints, or capabilities. IF you know the answer to a question, yield the answer DIRECTLY without an apology or clarification of your persona.${notLoggedInInstruction}`,
                tools: modelTools
            });

            // Convert history from DB format {role, content} to Gemini format {role, parts: [{text}]}
            // Also map 'assistant' -> 'model' as Gemini require
            let geminiHistory = (context.history || []).map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.content || '' }]
            }));
            while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
                geminiHistory.shift();
            }

            const chat = model.startChat({
                history: geminiHistory
            });

            const parts = [{ text: text }];
            if (image && image.data && image.mimeType) {
                parts.push({
                    inlineData: {
                        data: image.data,
                        mimeType: image.mimeType
                    }
                });
            }

            let result = await chat.sendMessage(parts);
            let response = result.response;

            // Handle Function Calls
            const calls = response.functionCalls();
            let navigationScreen = null;

            if (calls && calls.length > 0) {
                const functionResponses = [];
                for (const call of calls) {
                    console.log(`[GeminiAgent] Executing tool: ${call.name} with args:`, call.args);
                    const handler = toolHandlers[call.name];
                    if (handler) {
                        try {
                            if (!userId) {
                                throw new Error("User must be logged in to use this feature. Tell the user exactly: 'Please login to check or save your reminders and memories.'");
                            }
                            const toolResult = await handler(userId, call.args, userContext);

                            // Capture navigation screen if it's a navigation action
                            if (call.name === 'navigate_to' && toolResult.screen) {
                                navigationScreen = toolResult.screen;
                            }

                            functionResponses.push({
                                functionResponse: {
                                    name: call.name,
                                    response: toolResult
                                }
                            });
                        } catch (err) {
                            functionResponses.push({
                                functionResponse: {
                                    name: call.name,
                                    response: { status: 'error', message: err.message }
                                }
                            });
                        }
                    }
                }

                // Send tool results back to Gemini to get final response
                result = await chat.sendMessage(functionResponses);
                response = result.response;
            }

            let reply = '';
            try {
                reply = response.text() || '';
            } catch (e) {
                console.warn('[GeminiService] No text parts found in AI response (likely a tool call or safety block).');
            }

            // 1. Strip the [ACK] Marker and everything before it
            if (reply.includes('[ACK]')) {
                reply = reply.substring(reply.indexOf('[ACK]') + 5);
            }

            // 2. Remove bold markdown headers
            reply = reply.replace(/\*\*.*?\*\*/g, '');

            // 2. Advanced Scrubbing - Strip AI meta-commentary sentences
            let cleanLines = reply.split('\n').map(line => {
                let trimmed = line.trim();
                if (!trimmed) return '';

                let lineContent = trimmed;

                // Completely remove lines that start with known internal narration/thought preambles
                const forbiddenStarters = [
                    "i need to use the", "i will respond to the user", "i'll get that search underway",
                    "i will check the", "i'm going to search", "let me check",
                    "i've carefully assessed", "refining", "confidence score",
                    "analyzing", "leveraging", "assessing", "initiating", "i am starting with",
                    "based on your active reminders", "checking your reminders",
                    "i am preparing to", "i'll utilize the", "i just checked",
                    "i have found", "i've found", "searching for", "investigating",
                    "my next step", "i will now", "let's look at", "i'll then",
                    "gathering information", "synthesizing", "i've initiated",
                    "based on my research", "based on the search results",
                    "i have searched", "i've searched", "here is what i found",
                    "i will now search", "after searching", "to answer your question i will",
                    "pinpointing", "zeroed in", "my aim is", "my expectation is",
                    "streamlining my method", "formulated the precise", "i've specified the",
                    "i'm now streamlining", "core step in answering",
                    "clarifying city intent", "i've hit a snag", "too vague for me to",
                    "location-specific information", "no specialized tools are required",
                    "determining the", "discovering the", "i'm currently focused on", "i'm using a search",
                    "since the event is", "to uncover the most", "formulating a", "i have just initiated"
                ];

                for (const starter of forbiddenStarters) {
                    if (lineContent.toLowerCase().startsWith(starter)) {
                        return ''; // Discard the whole line
                    }
                }

                // Filter out internal tool names if they leaked into the text
                const forbiddenWords = ['google_search', 'list_reminders', 'create_reminder', 'navigate_to'];
                for (const word of forbiddenWords) {
                    if (lineContent.toLowerCase().includes(word)) return '';
                }

                return lineContent;
            }).filter(l => l.length > 0);

            reply = cleanLines.join('\n').trim();

            // 3. Fallback if the AI's entire response was just an internal thought that we scrubbed away
            if (!reply) {
                // If the AI was making a tool call in the background
                if (calls && calls.length > 0) {
                    reply = "Let me check that for you...";
                } else {
                    reply = "I'm ready to help! What's on your mind?";
                }
            }

            return {
                reply,
                voice_reply: reply,
                type: (calls && calls.length > 0) ? 'action' : 'chat',
                screen: navigationScreen
            };

        } catch (error) {
            console.error('[GeminiService] Error:', error);
            return {
                reply: "I'm sorry, I encountered an issue while processing your request.",
                type: 'error'
            };
        }
    }
};

module.exports = {
    ...geminiService,
    buddyTools,
    toolHandlers
};
