const { OpenAI } = require('openai');
const axios = require('axios');
const Settings = require('../models/Settings');

const nluService = {

    /**
     * Generates a structured response based on user input and context
     */
    generateResponse: async (text, context, targetLanguage = 'en-US') => {
        const settings = await Settings.findOne().select('+ai.openaiApiKey ai.activeModel');
        const apiKey = settings?.ai?.openaiApiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API Key not configured.");

        // Dynamic model selection for OpenAI
        const activeModel = settings?.ai?.activeModel;
        let modelName = activeModel && activeModel.startsWith('openai/')
            ? activeModel.replace('openai/', '')
            : "gpt-4o-mini"; // Fallback to schema default if needed

        const openai = new OpenAI({ apiKey, timeout: 30000 });
        // Calculate current time in User's Timezone
        const timeZone = context.userContext?.timeZone || 'UTC';
        const userTime = new Date().toLocaleString('en-US', {
            timeZone: timeZone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });

        const systemPrompt = `
You are "Buddy", a warm, friendly AI assistant.
Rules:
1. Respond STRICTLY in the target language: ${targetLanguage}.
2. Use the provided context (History, Memories, Reminders) to give relevant answers.
3. Be concise and conversational.
4. If the user wants to set a reminder, return a structured JSON response.

CURRENT USER TIME: ${userTime} (${timeZone})

CONTEXT:
History: ${JSON.stringify(context.history)}
Memories: ${JSON.stringify(context.memories)}
Reminders: ${JSON.stringify(context.reminders)}

Return ONLY a JSON object:
{
  "type": "chat" | "reminder" | "memory_action",
  "data": { ... },
  "reply": "Friendly text to display",
  "voice_reply": "Punchy text to speak"
}
`;

        try {
            const response = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            return JSON.parse(content);
        } catch (error) {
            console.error('[NLUService] Error generating response:', error);
            return {
                type: "chat",
                reply: "I'm sorry, I'm having trouble thinking right now.",
                voice_reply: "I'm having a little trouble thinking. Can you try again?"
            };
        }
    }
};

module.exports = nluService;
