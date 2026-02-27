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
            // 1. Define all queries
            const historyPromise = conversationId
                ? Conversation.findOne({ _id: conversationId, userId })
                : Promise.resolve(null);

            const memoriesPromise = Memory.find({ userId }).sort({ createdAt: -1 }).limit(10);

            const now = new Date();
            const userDate = now.toLocaleDateString('en-CA', { timeZone: timeZone });
            const remindersPromise = Reminder.find({
                userId,
                date: { $gte: userDate }
            }).sort({ date: 1, time: 1 }).limit(5);

            const mongoose = require('mongoose');
            const User = mongoose.model('User') || require('../models/User');
            const userPromise = User.findById(userId).select('voicePreferences');

            // 2. Execute all in parallel
            const [conversation, memoriesDocs, recentRemindersDocs, userDoc] = await Promise.all([
                historyPromise,
                memoriesPromise,
                remindersPromise,
                userPromise
            ]);

            // 3. Process results
            if (conversation) {
                history = conversation.messages.slice(-5);
            }
            memories = memoriesDocs || [];
            recentReminders = recentRemindersDocs || [];

            let voicePreferences = { gender: 'female', tone: 'soft' };
            if (userDoc && userDoc.voicePreferences) {
                voicePreferences = userDoc.voicePreferences;
            }

            return {
                history: history.map(m => ({ role: m.role, content: m.content })),
                memories: memories.map(m => m.content),
                reminders: recentReminders.map(r => ({
                    title: r.title,
                    time: r.time,
                    date: r.date
                })),
                userContext: {
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
