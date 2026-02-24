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
    getContext: async (userId, conversationId = null, timeZone = 'UTC') => {
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

            // 3. Fetch Recent Reminders (Using User's Timezone)
            const now = new Date();
            // Get YYYY-MM-DD in the user's timezone
            const userDate = now.toLocaleDateString('en-CA', { timeZone: timeZone });

            console.log(`[ContextService] Fetching reminders for user ${userId} from date: ${userDate} (${timeZone})`);

            recentReminders = await Reminder.find({
                userId,
                date: { $gte: userDate }
            }).sort({ date: 1, time: 1 }).limit(5);

            // 4. Fetch User Preferences
            const mongoose = require('mongoose');
            const User = mongoose.model('User') || require('../models/User');
            let voicePreferences = { gender: 'female', tone: 'soft' }; // Default
            try {
                const userDoc = await User.findById(userId);
                if (userDoc && userDoc.voicePreferences) {
                    voicePreferences = userDoc.voicePreferences;
                }
            } catch (err) {
                console.error('[ContextService] Error fetching user preferences:', err);
            }

            return {
                history: history.map(m => ({ role: m.role, content: m.content })),
                memories: memories.map(m => m.content),
                reminders: recentReminders.map(r => ({
                    title: r.title,
                    time: r.time,
                    date: r.date
                })),
                userContext: { // Pass timezone info for NLU
                    timeZone,
                    localDate: userDate,
                    voicePreferences
                }
            };
        } catch (error) {
            console.error('[ContextService] Error fetching context:', error);
            return { history: [], memories: [], reminders: [], userContext: { voicePreferences: { gender: 'female', tone: 'soft' } } };
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
