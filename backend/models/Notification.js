const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
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
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['reminder', 'system', 'google', 'buddy'],
        default: 'system'
    },
    relatedId: {
        type: String,
        refPath: 'onModel'
    },
    onModel: {
        type: String,
        enum: ['Reminder', 'Memory']
    },
    read: {
        type: Boolean,
        default: false
    },
    dismissed: {
        type: Boolean,
        default: false
    },
    actionUrl: {
        type: String
    }
}, { timestamps: true });

// Performance Indexes
NotificationSchema.index({ userId: 1, dismissed: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

module.exports = mongoose.model('Notification', NotificationSchema);
