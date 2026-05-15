const Conversation = require('../models/Conversation');
const Memory = require('../models/Memory');
const Reminder = require('../models/Reminder');
const LocationReminder = require('../models/LocationReminder');

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
            const mongoose = require('mongoose');
            const User = mongoose.model('User') || require('../models/User');

            let userDoc = preFetchedUser;
            if (!userDoc && userId) {
                userDoc = await User.findById(userId).select('voicePreferences dateFormat timeFormat timezone');
            }

            // Use stored timezone if available
            const timeZone = userDoc?.timezone || preferredTimeZone;

            // 2. Define queries
            const historyPromise = userId
                ? Conversation.findOne({ userId }).sort({ updatedAt: -1 })
                : Promise.resolve(null);

            const memoriesPromise = userId ? Memory.find({ userId }).sort({ createdAt: -1 }).limit(10) : Promise.resolve([]);
            const now = new Date();
            let userDate;
            try {
                userDate = now.toLocaleDateString('en-CA', { timeZone: timeZone });
            } catch (e) {
                userDate = now.toLocaleDateString('en-CA', { timeZone: 'UTC' });
            }

            // Universal user access filter for reminders
            const userAccessFilter = {
                $or: [
                    { userId },
                    { 'sharedWith.user': userId },
                    { assignedTo: userId }
                ]
            };

            // Fetch standard reminders with ownership/sharing check
            const remindersPromise = userId ? Reminder.find({
                $and: [
                    userAccessFilter,
                    {
                        $or: [
                            { date: { $gte: userDate } },
                            { date: null },
                            { status: 'pending' }
                        ]
                    }
                ]
            }).sort({ date: 1, time: 1 }).limit(15) : Promise.resolve([]);

            // Fetch dedicated location reminders (Note: LocationReminder model currently only filters by direct userId)
            const locationRemindersPromise = userId ? LocationReminder.find({
                userId, // Direct ownership only for this specific model currently
                status: { $in: ['on_track', 'risk_alert'] }
            }).sort({ createdAt: -1 }).limit(10) : Promise.resolve([]);

            // 3. Execute in parallel
            const [conversation, memoriesDocs, stdRemindersDocs, locRemindersDocs] = await Promise.all([
                historyPromise,
                memoriesPromise,
                remindersPromise,
                locationRemindersPromise
            ]);

            // 4. Process results
            if (conversation) {
                history = conversation.messages.slice(-5);
            }
            memories = memoriesDocs || [];

            // Format standard/time-based reminders
            const standardReminders = (stdRemindersDocs || []).map(r => ({
                id: r._id,
                title: r.title,
                time: r.time,
                date: r.date,
                location: r.location,
                type: (r.reminderType === 'location' || r.location) ? 'location' : 'time'
            }));

            // Format dedicated location reminders
            const dedicatedLocationReminders = (locRemindersDocs || []).map(r => ({
                id: r._id,
                title: r.title,
                location: r.location,
                time: r.time,
                date: r.date,
                type: 'location'
            }));

            // Helper to sort by date and time (handles 12h and 24h formats)
            const getSortValue = (r) => {
                const datePart = r.date || '9999-12-31';
                let timePart = '23:59'; // Default to end of day if no time
                if (r.time && r.time.toLowerCase() !== 'whenever i arrive') {
                    const match = r.time.match(/(\d+):(\d+)\s*(am|pm)/i);
                    if (match) {
                        let h = parseInt(match[1]);
                        const m = match[2];
                        const period = match[3].toLowerCase();
                        if (period === 'pm' && h < 12) h += 12;
                        if (period === 'am' && h === 12) h = 0;
                        timePart = `${h.toString().padStart(2, '0')}:${m}`;
                    } else if (r.time.includes(':')) {
                        timePart = r.time;
                    }
                }
                return `${datePart} ${timePart}`;
            };

            // Combine and sort chronologically
            recentReminders = [...standardReminders, ...dedicatedLocationReminders]
                .sort((a, b) => getSortValue(a).localeCompare(getSortValue(b)))
                .slice(0, 20);

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
