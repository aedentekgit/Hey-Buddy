const Conversation = require('../models/Conversation');
const axios = require('axios');

exports.getConversations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const total = await Conversation.countDocuments({ userId: req.user._id });
        const conversations = await Conversation.find({ userId: req.user._id })
            .select('title createdAt updatedAt')
            .lean()
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: conversations,
            pagination: {
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit,
                hasNextPage: page < Math.ceil(total / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getConversationById = async (req, res) => {
    try {
        const conversation = await Conversation.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        res.status(200).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteConversation = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const conversation = await Conversation.findOneAndDelete({
            _id: conversationId,
            userId: req.user._id
        });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        // Notify Python AI service to clear this session from memory
        try {
            const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            await axios.delete(`${aiServiceUrl}/chat/history/${conversationId}`, {
                headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
            });
            console.log(`[AI-SYNC] Cleared session ${conversationId} in Python service`);
        } catch (aiError) {
            console.error(`[AI-SYNC] Failed to notify Python service for session ${conversationId}:`, aiError.message);
        }

        res.status(200).json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteAllConversations = async (req, res) => {
    try {
        await Conversation.deleteMany({ userId: req.user._id });

        // Notify Python AI service to clear ALL sessions for this user
        try {
            const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
            const userId = req.user._id.toString();
            
            // 1. Clear in-memory history
            await axios.delete(`${aiServiceUrl}/chat/user/${userId}/history`, {
                headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
            });

            // 2. Trigger vector store reload to remove deleted history from RAG context
            // Note: This is fire-and-forget or awaited depending on latency preference.
            // For "completely" fixing history deletion, we want the reload.
            await axios.post(`${aiServiceUrl}/system/reload`, {}, {
                headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
            });

            console.log(`[AI-SYNC] Cleared all sessions and reloaded vector store for user ${userId}`);
        } catch (aiError) {
            console.error(`[AI-SYNC] Failed to notify Python service for user ${req.user._id}:`, aiError.message);
        }

        res.status(200).json({ success: true, message: 'All conversations deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.syncConversation = async (req, res) => {
    try {
        const { userId, messages } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        // ENFORCE MASTER THREAD: Use userId as the primary _id for the conversation.
        // This ensures that for ANY device the user logs into, they hit the EXACT same MongoDB document.
        // History will "travel" seamlessly between Web and Mobile.
        let conversation = await Conversation.findOne({ 
            $or: [
                { _id: userId },
                { userId: userId }
            ]
        }).sort({ updatedAt: -1 });

        if (conversation) {
            // Update the existing master thread
            conversation.messages = messages;
            // Ensure userId is set (migration for old docs)
            conversation.userId = userId;
            await conversation.save();
        } else {
            // Create a new master thread with userId as _id
            conversation = await Conversation.create({
                _id: userId,
                userId: userId,
                messages: messages,
                title: 'Buddy Conversation'
            });
        }
        res.status(200).json({ success: true, message: 'Conversation synced successfully', conversationId: conversation._id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLatestConversationByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const conversation = await Conversation.findOne({ userId })
            .lean()
            .sort({ updatedAt: -1 });

        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        res.status(200).json({
            success: true,
            data: conversation
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllConversationsInternal = async (req, res) => {
    try {
        const conversations = await Conversation.find({}).lean();
        res.status(200).json({
            success: true,
            data: conversations
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
