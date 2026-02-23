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
    }
}, { timestamps: true });

module.exports = mongoose.model('Memory', memorySchema);
