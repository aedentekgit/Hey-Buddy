const { GoogleGenerativeAI } = require('@google/generative-ai');
const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');

// Configuration
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('GEMINI_API_KEY is missing in backend .env');
}
const genAI = new GoogleGenerativeAI(apiKey);

// Tool Implementation Logic
const toolHandlers = {
    create_reminder: async (userId, args, userContext) => {
        const { title, time, notes, date } = args;
        const reminderDate = date || userContext.localDate;
        const reminder = await Reminder.create({
            userId,
            title,
            time,
            notes: notes || '',
            date: reminderDate,
            intent: 'generic',
            source: 'buddy'
        });
        return { status: 'success', message: 'Reminder created.', data: reminder };
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

        await Reminder.deleteOne(query);
        return { status: 'success', message: 'Reminder deleted.' };
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
            }
        ]
    }
];

const geminiService = {
    /**
     * Entry point for processing text via Gemini with Tools
     */
    generateResponse: async (text, userId, context = {}, targetLanguage = 'en-US', image = null) => {
        try {
            const userContext = context.userContext || {
                localDate: new Date().toLocaleDateString('en-CA'),
                timeZone: 'UTC'
            };

            const model = genAI.getGenerativeModel({
                model: "gemini-2.0-flash",
                systemInstruction: `You are Buddy, a professional health and personal assistant.
                
                USER CONTEXT:
                - Current User Date: ${userContext.localDate}
                - User Timezone: ${userContext.timeZone}
                - Real-time: ${new Date().toLocaleString('en-US', { timeZone: userContext.timeZone })}
                
                RECENT MEMORIES (Facts/Notes):
                ${context.memories && context.memories.length > 0 ? context.memories.join('\n') : 'No recent memories found.'}
                
                UPCOMING REMINDERS:
                ${context.reminders && context.reminders.length > 0 ? context.reminders.map(r => `- ${r.title} at ${r.time} (${r.date})`).join('\n') : 'No upcoming reminders found in immediate context.'}
                
                STRICT RULES FOR DATA INTEGRITY:
                1. REMINDERS (Tasks/Schedule) vs MEMORIES (Facts/Notes) are separated.
                   - Requests about schedule, tasks, or "what do I have to do" MUST use 'list_reminders' if not in the UPCOMING REMINDERS list above.
                   - Requests about facts, "where is my [item]", or past events MUST use 'search_memories' or 'list_memories' if not in the RECENT MEMORIES list above.
                
                2. NO HALLUCINATION:
                   - If user asks for today's reminders and they aren't in the list above, call 'list_reminders' with date="today".
                   - If the tool response returns 'hasReminders: false' or an empty list, you MUST tell the user: "You have no reminders scheduled for today."
                   - NEVER infer reminders or facts exist if neither the context nor the tools show them.
                
                3. DATE SENSITIVITY:
                   - "Today" is ${userContext.localDate}.
                
                4. Always be professional, sympathetic, and concise. ${targetLanguage === 'auto' ? "Detect the user's language and respond in that same language." : `Respond in ${targetLanguage}.`}`,
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
