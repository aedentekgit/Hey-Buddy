const { GoogleGenerativeAI } = require('@google/generative-ai');
const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');
// const { geocodeAddress } = require('./smartReminderService'); // Moved inside tool handler to avoid circular dependency

// Configuration
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY is missing in backend .env');
}
const genAI = new GoogleGenerativeAI(apiKey);

// Tool Implementation Logic
const toolHandlers = {
    create_reminder: async (userId, args, userContext) => {
        console.log(`[GeminiTools] Executing create_reminder for user ${userId}`);
        try {
            const { title, time, notes, date, location } = args;
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
                smartFeatures: {
                    earlyWarning: !!(location && coordinates.lat),
                    trafficAware: !!(location && coordinates.lat),
                    itemExitGuards: false
                }
            };

            // Only add notes if the schema has it (we'll add it to schema next)
            if (notes) reminderData.notes = notes;

            // --- GOOGLE CALENDAR SYNC ---
            let googleEventId = null;
            const User = require('../models/User'); // Ensure User model is available
            const user = await User.findById(userId);

            if (user && user.googleRefreshToken) {
                try {
                    const { createGoogleCalendarEvent } = require('./googleCalendarService');
                    console.log('[GeminiTools] Syncing to Google Calendar...');
                    googleEventId = await createGoogleCalendarEvent(userId, reminderData);
                    reminderData.googleEventId = googleEventId;
                    reminderData.source = 'google';
                    console.log('[GeminiTools] Google Event Created:', googleEventId);
                } catch (calErr) {
                    console.error('[GeminiTools] Google Sync failed:', calErr.message);
                }
            }

            console.log('[GeminiTools] Creating reminder in DB:', JSON.stringify(reminderData));
            const reminder = await Reminder.create(reminderData);

            let message = `Reminder created${location ? ` for ${location}` : ''}.`;
            if (location && !coordinates.lat) {
                message += " Note: I couldn't find the exact map coordinates for this location. Please check your Google Maps settings.";
            }

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
        const { content, category } = args;
        const memory = await Memory.create({
            userId,
            content,
            category: category || 'general'
        });
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

        // --- GOOGLE CALENDAR SYNC UPDATE ---
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (user && user.googleRefreshToken) {
            try {
                const { createGoogleCalendarEvent, updateGoogleCalendarEvent } = require('./googleCalendarService');
                if (reminder.googleEventId) {
                    await updateGoogleCalendarEvent(userId, reminder.googleEventId, reminder.toObject());
                    console.log('[GeminiTools] Google Calendar updated.');
                } else {
                    const eventId = await createGoogleCalendarEvent(userId, reminder.toObject());
                    reminder.googleEventId = eventId;
                    reminder.source = 'google';
                    console.log('[GeminiTools] New Google Event created during update:', eventId);
                }
            } catch (calErr) {
                console.error('[GeminiTools] Update Google Sync failed:', calErr.message);
            }
        }

        await reminder.save();

        return { status: 'success', message: 'Reminder updated.', data: reminder };
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
        return { status: 'success', message: 'Memory deleted.' };
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
    google_search: async (userId, args) => {
        const { query } = args;
        console.log(`[GeminiTools] Performing internal Google Search for: "${query}"`);
        try {
            // Internal call with ONLY Search Grounding (SDK doesn't allow combining with functions)
            const searchModel = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                tools: [{ googleSearch: {} }]
            });
            const result = await searchModel.generateContent(`Find current events/news about: ${query}. Provide a concise summary.`);
            const response = await result.response;
            return { status: 'success', data: response.text() };
        } catch (err) {
            console.error('[GeminiTools] Internal Search failed:', err.message);
            return { status: 'error', message: 'Could not fetch real-time data.' };
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
                        date: { type: 'STRING', description: 'The date (YYYY-MM-DD)' }
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
                        category: { type: 'STRING', description: 'Optional category (health, personal, etc.)' }
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
                name: 'list_memories',
                description: 'Fetch the list of stored memories (buddy memories).',
                parameters: { type: 'OBJECT', properties: {} }
            },
            {
                name: 'delete_memory',
                description: 'Delete a specific memory by its ID or content fragment.',
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
                description: 'Update a specific stored memory by its ID or content fragment with new information.',
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
                name: 'google_search',
                description: 'Search Google for real-time news, current affairs, or information not present in your training data.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        query: { type: 'STRING', description: 'The search query to look up.' }
                    },
                    required: ['query']
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

            const notLoggedInInstruction = !userId ? `
                5. GUEST USER RULE (CRITICAL):
                   - The user is currently NOT LOGGED IN.
                   - **ALLOWED**: General knowledge questions (e.g., "What is the budget?", "Tell me a joke", "What is the news"), greetings, local current affairs, and helpful conversation are ALWAYS allowed.
                   - **RESTRICTED**: If the user asks for *their own* personal data (e.g., "What are *my* reminders?", "Check *my* memory", "Save this as *my* note"), you MUST refuse and reply with: "Please login to check or save your personal reminders and memories."
                   - Do NOT call any tools relating to memories or reminders for a guest user.` : ``;

            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                systemInstruction: `SYSTEM IDENTITY:
                - Your name is Buddy.
                - PERSONALITY: ${personality.description}
                - WRITING STYLE: ${personality.writingStyle}
                - REAL-TIME CAPABILITY: You can look up real-time news and current events using the 'google_search' tool. Use it whenever you need to provide up-to-date information.
                
                VOICE CONTEXT: You are communicating with the user using the '${personality.voice}' voice. Your written responses MUST reflect this persona's tone.
                
                USER CONTEXT:
                - Current User Date: ${userContext.localDate} (${new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: userContext.timeZone })})
                - User Timezone: ${userContext.timeZone}
                - Real-time: ${new Date().toLocaleString('en-US', { timeZone: userContext.timeZone })}
                - User Language Preference: ${targetLanguage}
                - Preferred Date Format for Replies: ${userContext.dateFormat}
                - Preferred Time Format for Replies: ${userContext.timeFormat}-Hour
                (CRUCIAL INSTRUCTION: When you reply to the user with a date or time in text, you strictly format ALL dates as ${userContext.dateFormat} and ALL times as ${userContext.timeFormat}-Hour time.)
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories && context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders && context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found in immediate context.'}
                
                STRICT RULES FOR DATA INTEGRITY:
                1. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
${!userId ? "                   - As a GUEST, YOU MUST NOT search reminders or memories. Always use your internal training data for general questions." : "                   - Requests about schedule, tasks, or \"what do I have to do\" MUST use 'list_reminders' if not in the UPCOMING REMINDERS list above.\n                   - Requests about facts, \"where is my [item]\", or past events MUST use 'search_memories' or 'list_memories' if not in the RECENT MEMORIES list above."}
                
                2. NO HALLUCINATION:
${!userId ? "                   - If the user asks for reminders or personal facts, you MUST refuse and tell them to login. NEVER make them up. If asked for general news or facts, you SHOULD use 'google_search' to find accurate real-time information before answering." : "                   - If user asks for today's reminders and they aren't in the list above, call 'list_reminders' with date=\"today\".\n                   - If the tool response returns 'hasReminders: false' or an empty list, you MUST tell the user: \"You have no reminders scheduled for today.\"\n                   - ALWAYS use 'google_search' for real-time news, current affairs, or information not in your training data.\n                   - NEVER infer reminders or facts exist if neither the context nor the tools show them."}
                
                3. DATE, LOCATION & ACTION SENSITIVITY:
                   - "Today" is ${userContext.localDate}.
                   - You MUST resolve relative dates like "tomorrow", "yesterday", or "next Monday" into the exact YYYY-MM-DD format using today's date. 
                   - NEVER ask the user for confirmation if they give a relative date and time (e.g. "tomorrow at 5pm"). Calculate it yourself and call the tool IMMEDIATELY.
                   - NEVER ask "Do you mean [Date]?", just assume you are correct and trigger the 'create_reminder' tool right away.
                   - If a user mentions a place (e.g., "at school", "in Periyar bus stand"), you MUST extract this into the 'location' parameter when calling 'create_reminder'.
                
                4. MULTILINGUAL SUPPORT: 
                   - You are a native speaker of multiple languages including **Tamil**, Hindi, Spanish, French, etc. 
                   - You MUST respond in the language the user speaks OR explicitly requests (e.g., "speak in Tamil").
                   - If the user switches language, you MUST switch with them immediately.
                   - NEVER refuse a request to speak a different language. You are fully capable of it.
                   - Be professional, sympathetic, and concise.${notLoggedInInstruction}`,
                tools: buddyTools
            });

            // Convert history from DB format {role, content} to Gemini format {role, parts: [{text}]}
            // Also map 'assistant' -> 'model' as Gemini requires
            let geminiHistory = (context.history || []).map(m => ({
                role: m.role === 'assistant' ? 'model' : m.role,
                parts: [{ text: m.content || '' }]
            }));

            // Gemini SDK requirement: The history must start with a message from the 'user' role.
            // If our sliced history starts with 'model', we must remove it until we find a 'user' message.
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
            if (calls && calls.length > 0) {
                const functionResponses = [];
                for (const call of calls) {
                    console.log(`[GeminiAgent] Executing tool: ${call.name} with args:`, call.args);
                    const handler = toolHandlers[call.name];
                    if (handler) {
                        try {
                            // Check if this is a personal data tool that requires login
                            const personalDataTools = ['create_reminder', 'list_reminders', 'update_reminder', 'delete_reminder', 'save_memory', 'list_memories', 'update_memory', 'delete_memory', 'search_memories', 'analyze_health_summary'];
                            if (!userId && personalDataTools.includes(call.name)) {
                                throw new Error("User must be logged in to use this feature. Tell the user exactly: 'Please login to check or save your reminders and memories.'");
                            }
                            const toolResult = await handler(userId, call.args, userContext);
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

            const reply = response.text();

            return {
                reply,
                voice_reply: reply,
                type: (calls && calls.length > 0) ? 'action' : 'chat'
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
