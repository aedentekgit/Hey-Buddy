const mongoose = require('mongoose');

const locationReminderSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    userId: {
        type: String,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },
    date: {
        type: String,     // stored as "YYYY-MM-DD"
        default: ''
    },
    time: {
        type: String,     // stored as "HH:MM AM/PM"
        default: ''
    },
    status: {
        type: String,
        enum: ['on_track', 'risk_alert', 'completed', 'cancelled'],
        default: 'on_track'
    },
    warningLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    bufferTime: {
        type: Number,
        default: 15     // minutes before event to notify
    },
    notifyPhone: { type: Boolean, default: true },
    notifyFamily: { type: Boolean, default: false },
    notifyEmergency: { type: Boolean, default: false },
    notifyEmail: { type: Boolean, default: true },
    earlyWarningSet: { type: Boolean, default: false },
    familyBackupSet: { type: Boolean, default: false },
    geofenceRadius: {
        type: Number,
        default: 500    // meters
    },
    trafficAware: { type: Boolean, default: true },
    itemExitGuards: { type: Boolean, default: true }
}, { timestamps: true });

locationReminderSchema.index({ userId: 1, date: 1 });
locationReminderSchema.index({ status: 1 });
locationReminderSchema.index({ createdAt: -1 });
// Text index for full-text search
locationReminderSchema.index({ title: 'text', description: 'text', location: 'text' });

module.exports = mongoose.model('LocationReminder', locationReminderSchema);
