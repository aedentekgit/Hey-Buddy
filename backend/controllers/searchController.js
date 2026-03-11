const Reminder = require('../models/Reminder');
const Memory = require('../models/Memory');
const Conversation = require('../models/Conversation');

exports.globalSearch = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(200).json({ success: true, data: { reminders: [], memories: [], conversations: [] } });
        }

        const userId = req.user._id;
        const searchRegex = new RegExp(query, 'i');

        // Parallel search across collections
        const [reminders, memories, conversations] = await Promise.all([
            // Use MongoDB text search for Reminder (more efficient)
            Reminder.find({
                $text: { $search: query },
                userId
            }).limit(5).sort({ date: -1 }).catch(() =>
                // Fallback to regex if text index fails
                Reminder.find({
                    userId,
                    $or: [
                        { title: searchRegex },
                        { description: searchRegex },
                        { location: searchRegex }
                    ]
                }).limit(5).sort({ date: -1 })
            ),

            Memory.find({
                userId,
                content: searchRegex
            }).limit(5).sort({ createdAt: -1 }),

            // Use MongoDB text search for Conversation (more efficient)
            Conversation.find({
                $text: { $search: query },
                userId
            }).limit(3).sort({ updatedAt: -1 }).catch(() =>
                // Fallback to regex if text index fails
                Conversation.find({
                    userId,
                    $or: [
                        { title: searchRegex },
                        { "messages.content": searchRegex }
                    ]
                }).limit(3).sort({ updatedAt: -1 })
            )
        ]);

        res.status(200).json({
            success: true,
            data: {
                reminders,
                memories,
                conversations
            }
        });
    } catch (error) {
        console.error("Search Error:", error);
        res.status(500).json({ success: false, message: "Search failed" });
    }
};
