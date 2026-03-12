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
        required: true
    },
    readBy: [{ // For group chat reading status
        type: String,
        ref: 'User'
    }]
}, { timestamps: true });

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
