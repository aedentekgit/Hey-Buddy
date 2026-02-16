const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
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
    summary: String,
    metadata: {
        size: Number,
        tags: [String]
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
