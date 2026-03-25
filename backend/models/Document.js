const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
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
    fileName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        default: 'text/markdown'
    },
    content: {
        type: String,
        required: true // Transcribed/extracted text
    },
    fileUrl: String,
    summary: String,
    metadata: {
        size: Number,
        tags: [String]
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
