const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    secret: {
        type: String,
        required: true,
        unique: true
    },
    active: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date,
        default: null
    },
    config: {
        targetAction: {
            type: String,
            enum: ['create_reminder', 'create_notification', 'trigger_buddy'],
            default: 'create_reminder'
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('Webhook', webhookSchema);
