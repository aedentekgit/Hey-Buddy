const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const path = require('path');

const ensureChatMember = async (chatId, userId) => {
    const room = await ChatRoom.findById(chatId);
    if (!room) {
        const err = new Error('Chat not found');
        err.status = 404;
        throw err;
    }
    if (!room.members.map(String).includes(userId.toString())) {
        const err = new Error('Access denied to this chat');
        err.status = 403;
        throw err;
    }
    return room;
};

// GET /chat/private/start?member_id=202
exports.startPrivateChat = async (req, res) => {
    try {
        const { member_id } = req.query;
        const currentUserId = req.user._id;

        if (!member_id) return res.status(400).json({ success: false, message: "Member ID is required" });

        // Check if private chat already exists
        let chatRoom = await ChatRoom.findOne({
            type: 'private',
            members: { $all: [currentUserId, member_id], $size: 2 }
        });

        if (!chatRoom) {
            chatRoom = new ChatRoom({
                type: 'private',
                members: [currentUserId, member_id]
            });
            await chatRoom.save();
        }

        res.status(200).json({ success: true, data: { chat_id: chatRoom._id, type: 'private', members: chatRoom.members } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to start private chat" });
    }
};

// POST /chat/upload
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        const extension = path.extname(fileName).toLowerCase();

        let fileType = 'document';
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
            fileType = 'image';
        }

        res.status(200).json({
            success: true,
            data: {
                fileUrl,
                fileName,
                fileType
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Upload failed" });
    }
};

// GET /chat/group
exports.getFamilyGroupChat = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user.familyId) return res.status(404).json({ success: false, message: "No family group found" });

        const chatRoom = await ChatRoom.findOne({ familyId: user.familyId });
        if (!chatRoom) return res.status(404).json({ success: false, message: "Family group chat not found" });

        res.status(200).json({ success: true, data: { chat_id: chatRoom._id, type: 'group', members: chatRoom.members } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch family group chat" });
    }
};

// GET /chat/messages?chat_id=890
exports.getChatMessages = async (req, res) => {
    try {
        const { chat_id } = req.query;
        if (!chat_id) return res.status(400).json({ success: false, message: "Chat ID is required" });
        await ensureChatMember(chat_id, req.user._id);

        const messages = await ChatMessage.find({ roomId: chat_id, clearedBy: { $ne: req.user._id } })
            .sort({ createdAt: 1 })
            .populate('senderId', 'name profilePicture');

        const formattedMessages = messages.map(m => ({
            id: m._id,
            content: m.content,
            sender_id: m.senderId._id,
            sender_name: m.senderId.name,
            sender_avatar: m.senderId.profilePicture,
            replyTo: m.replyTo,
            fileUrl: m.fileUrl,
            fileName: m.fileName,
            fileType: m.fileType,
            reactions: m.reactions || [],
            isStarred: m.isStarredBy.includes(req.user._id),
            isPinned: m.isPinned || false,
            forwardedFrom: m.forwardedFrom,
            readBy: m.readBy || [],
            deliveredTo: m.deliveredTo || [],
            timestamp: m.createdAt
        }));

        res.status(200).json({ success: true, data: formattedMessages });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to fetch messages" });
    }
};

// POST /chat/send (optional HTTP fallback, primarily handled by Socket.IO)
exports.sendMessage = async (req, res) => {
    try {
        const { chat_id, content } = req.body;
        const senderId = req.user._id;

        if (!chat_id || !content) return res.status(400).json({ success: false, message: "Chat ID and content are required" });
        const chatRoom = await ensureChatMember(chat_id, senderId);

        const message = new ChatMessage({
            roomId: chat_id,
            senderId,
            content
        });
        await message.save();

        // Update ChatRoom lastMessage
        await ChatRoom.findByIdAndUpdate(chatRoom._id, {
            lastMessage: content,
            lastMessageAt: Date.now()
        });

        res.status(200).json({ success: true, message: "Message sent", data: message });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to send message" });
    }
};

// DELETE /chat/:chat_id/history
exports.deleteChatHistory = async (req, res) => {
    try {
        const { chat_id } = req.params;
        const userId = req.user._id;
        await ensureChatMember(chat_id, userId);
        
        await ChatMessage.updateMany(
            { roomId: chat_id },
            { $addToSet: { clearedBy: userId } }
        );

        res.status(200).json({ success: true, message: "Chat history cleared" });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to clear chat history" });
    }
};

// POST /chat/:chat_id/mute
exports.muteChat = async (req, res) => {
    try {
        const { chat_id } = req.params;
        const userId = req.user._id;

        const chatRoom = await ensureChatMember(chat_id, userId);

        const idx = chatRoom.mutedBy.indexOf(userId);
        let msg = "";
        if (idx !== -1) {
            chatRoom.mutedBy.splice(idx, 1);
            msg = "Chat unmuted";
        } else {
            chatRoom.mutedBy.push(userId);
            msg = "Chat muted";
        }
        await chatRoom.save();

        res.status(200).json({ success: true, message: msg, isMuted: idx === -1 });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to mute chat" });
    }
};

// POST /chat/:chat_id/archive
exports.archiveChat = async (req, res) => {
    try {
        const { chat_id } = req.params;
        const userId = req.user._id;

        const chatRoom = await ensureChatMember(chat_id, userId);

        const idx = chatRoom.archivedBy.indexOf(userId);
        let msg = "";
        if (idx !== -1) {
            chatRoom.archivedBy.splice(idx, 1);
            msg = "Chat unarchived";
        } else {
            chatRoom.archivedBy.push(userId);
            msg = "Chat archived";
        }
        await chatRoom.save();

        res.status(200).json({ success: true, message: msg, isArchived: idx === -1 });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Failed to archive chat" });
    }
};
