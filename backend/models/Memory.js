const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
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
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: 'general'
    },
    tags: {
        type: [String],
        default: []
    },
    expiresAt: {
        type: Date,
        default: null
    },
    fileUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    }
}, { timestamps: true });
memorySchema.index({ userId: 1 });
memorySchema.index({ createdAt: -1 });
memorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

module.exports = mongoose.model('Memory', memorySchema);
