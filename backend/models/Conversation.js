const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    userId: {
        type: String,
        ref: 'User',
        required: true
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    title: {
        type: String,
        default: 'New Conversation'
    }
}, { timestamps: true });
ConversationSchema.index({ userId: 1 });
ConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
