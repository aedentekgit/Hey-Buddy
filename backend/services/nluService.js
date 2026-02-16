const { OpenAI } = require('openai');
const axios = require('axios');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
});

const nluService = {
    /**
     * Generates a structured response based on user input and context
     */
    generateResponse: async (text, context, targetLanguage = 'en-US') => {
        const systemPrompt = `
You are "Buddy", a warm, friendly AI assistant.
Rules:
1. Respond STRICTLY in the target language: ${targetLanguage}.
2. Use the provided context (History, Memories, Reminders) to give relevant answers.
3. Be concise and conversational.
4. If the user wants to set a reminder, return a structured JSON response.

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
                model: "gpt-4o-mini", // Default to a fast model
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
