const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    currentLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date
    },
    previousLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date
    },
    fcmTokens: [{
        type: String
    }],
    lastActive: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for TTL to automatically remove guest data after 30 days of inactivity
guestSchema.index({ lastActive: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Guest', guestSchema);
