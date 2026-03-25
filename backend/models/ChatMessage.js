const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    roomId: {
        type: String,
        ref: 'ChatRoom',
        required: true
    },
    senderId: {
        type: String,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: false // Content is now optional if it's a file-only message
    },
    replyTo: {
        type: String,
        ref: 'ChatMessage',
        default: null
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    fileType: {
        type: String,
        default: null // 'image', 'document', etc.
    },
    reactions: [{
        userId: { type: String, ref: 'User' },
        emoji: { type: String }
    }],
    isStarredBy: [{ // per-user starring
        type: String,
        ref: 'User'
    }],
    isPinned: {
        type: Boolean,
        default: false
    },
    forwardedFrom: { // for forwarding
        type: String,
        ref: 'ChatMessage',
        default: null
    },
    readBy: [{ // For group chat reading status
        type: String,
        ref: 'User'
    }],
    deliveredTo: [{ // For double tick status
        type: String,
        ref: 'User'
    }],
    clearedBy: [{ // For per-user chat deletion
        type: String,
        ref: 'User'
    }]
}, { timestamps: true });

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
