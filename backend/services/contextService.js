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
    getContext: async (userId, conversationId = null, preferredTimeZone = 'UTC', preFetchedUser = null) => {
        let history = [];
        let memories = [];
        let recentReminders = [];

        try {
            // 1. Resolve User Configuration
            // We use preFetchedUser if available to reduce DB round-trips (Performance Optimization)
            const mongoose = require('mongoose');
            const User = mongoose.model('User') || require('../models/User');

            let userDoc = preFetchedUser;
            if (!userDoc && userId) {
                userDoc = await User.findById(userId).select('voicePreferences dateFormat timeFormat timezone');
            }

            // Use stored timezone if available
            const timeZone = userDoc?.timezone || preferredTimeZone;

            // 2. Define other queries
            const historyPromise = userId
                ? Conversation.findOne({ userId }).sort({ updatedAt: -1 })
                : Promise.resolve(null);

            const memoriesPromise = userId ? Memory.find({ userId }).sort({ createdAt: -1 }).limit(10) : Promise.resolve([]);
            const now = new Date();
            let userDate;
            try {
                // 'en-CA' yields YYYY-MM-DD format
                userDate = now.toLocaleDateString('en-CA', { timeZone: timeZone });
            } catch (e) {
                console.warn(`[ContextService] Invalid timezone "${timeZone}", falling back to UTC:`, e.message);
                userDate = now.toLocaleDateString('en-CA', { timeZone: 'UTC' });
            }

            // Fetch reminders (unified)
            const remindersPromise = userId ? Reminder.find({
                userId,
                $or: [
                    { date: { $gte: userDate } },
                    { reminderType: 'location', status: 'on_track' }
                ]
            }).sort({ date: 1, time: 1 }).limit(20) : Promise.resolve([]);

            // 3. Execute in parallel
            const [conversation, memoriesDocs, allRemindersDocs] = await Promise.all([
                historyPromise,
                memoriesPromise,
                remindersPromise
            ]);

            // 4. Process results
            if (conversation) {
                history = conversation.messages.slice(-5);
            }
            memories = memoriesDocs || [];

            // Format reminders
            const standardReminders = (allRemindersDocs || [])
                .filter(r => r.reminderType !== 'location')
                .map(r => ({
                    id: r._id,
                    title: r.title,
                    time: r.time,
                    date: r.date,
                    type: 'time'
                }));

            const locationReminders = (allRemindersDocs || [])
                .filter(r => r.reminderType === 'location')
                .map(r => ({
                    id: r._id,
                    title: r.title,
                    location: r.location,
                    type: 'location'
                }));

            recentReminders = [...standardReminders, ...locationReminders].slice(0, 15);

            let voicePreferences = userDoc?.voicePreferences || { gender: 'female', tone: 'soft' };
            let dateFormat = userDoc?.dateFormat || 'DD/MM/YYYY';
            let timeFormat = userDoc?.timeFormat || '12';

            return {
                history: history.map(m => ({ role: m.role, content: m.content })),
                memories: memories.map(m => ({ id: m._id, content: m.content, category: m.category })),
                reminders: recentReminders,
                userContext: {
                    timeZone,
                    localDate: userDate,
                    voicePreferences,
                    dateFormat,
                    timeFormat
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

            if (userId) {
                let conversation = await Conversation.findOne({ userId }).sort({ updatedAt: -1 });

                if (conversation) {
                    await Conversation.findByIdAndUpdate(conversation._id, {
                        $push: { messages: { $each: messageBatch } }
                    });
                    return conversation._id;
                } else {
                    const newConversation = await Conversation.create({
                        userId,
                        messages: messageBatch,
                        title: 'Buddy Conversation'
                    });
                    return newConversation._id;
                }
            }
            return null;
        } catch (error) {
            console.error('[ContextService] Error saving interaction:', error);
            return conversationId;
        }
    }
};

module.exports = contextService;
