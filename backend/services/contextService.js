const Conversation = require('../models/Conversation');
const Memory = require('../models/Memory');
const Reminder = require('../models/Reminder');

const contextService = {
    /**
     * Retrieves the conversation context for a user
     * @param {string} userId 
     * @param {string} conversationId 
     * @returns {Promise<Object>} History and relevant memories
     */
    getContext: async (userId, conversationId = null) => {
        let history = [];
        let memories = [];
        let recentReminders = [];

        try {
            // 1. Fetch History
            if (conversationId) {
                const conversation = await Conversation.findOne({ _id: conversationId, userId });
                if (conversation) {
                    history = conversation.messages.slice(-5); // Get last 5 messages for context
                }
            }

            // 2. Fetch Memories
            memories = await Memory.find({ userId }).sort({ createdAt: -1 }).limit(10);

            // 3. Fetch Recent Reminders (to allow natural queries like "what's next?")
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            recentReminders = await Reminder.find({ 
                userId, 
                date: { $gte: today.toISOString().split('T')[0] } 
            }).sort({ date: 1, time: 1 }).limit(5);

            return {
                history: history.map(m => ({ role: m.role, content: m.content })),
                memories: memories.map(m => m.content),
                reminders: recentReminders.map(r => ({
                    title: r.title,
                    time: r.time,
                    date: r.date
                }))
            };
        } catch (error) {
            console.error('[ContextService] Error fetching context:', error);
            return { history: [], memories: [], reminders: [] };
        }
    },

    /**
     * Saves a new interaction to the conversation history
     */
    saveInteraction: async (userId, conversationId, userText, assistantText) => {
        try {
            const messageBatch = [
                { role: 'user', content: userText },
                { role: 'assistant', content: assistantText }
            ];

            if (conversationId) {
                await Conversation.findByIdAndUpdate(conversationId, {
                    $push: { messages: { $each: messageBatch } }
                });
                return conversationId;
            } else {
                const newConversation = await Conversation.create({
                    userId,
                    messages: messageBatch,
                    title: userText.substring(0, 30) + (userText.length > 30 ? '...' : '')
                });
                return newConversation._id;
            }
        } catch (error) {
            console.error('[ContextService] Error saving interaction:', error);
            return conversationId;
        }
    }
};

module.exports = contextService;
