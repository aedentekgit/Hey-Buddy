const mongoose = require('mongoose');

const familyRequestSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    senderId: {
        type: String,
        ref: 'User',
        required: true
    },
    email: { // Recipient email
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    recipientId: { // Filled if the user exists
        type: String,
        ref: 'User',
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined'],
        default: 'pending'
    }
}, { timestamps: true });

familyRequestSchema.index({ email: 1, status: 1 });
familyRequestSchema.index({ senderId: 1 });
familyRequestSchema.index({ recipientId: 1, status: 1 });

module.exports = mongoose.model('FamilyRequest', familyRequestSchema);
