const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
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
    notes: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    intent: {
        type: String,
        enum: ['meeting', 'medicine', 'pickup', 'bill', 'personal', 'generic', 'manual_creation', 'api_test'],
        default: 'generic'
    },
    medicineDetails: {
        dosage: String,
        frequency: {
            morning: Boolean,
            afternoon: Boolean,
            night: Boolean
        },
        timing: String,
        duration: String,
        instructions: String
    },
    prescriptionId: {
        type: String,
        ref: 'Prescription',
        default: null
    },
    time: {
        type: String,
        default: null
    },
    date: {
        type: String,
        default: null
    },
    location: {
        type: String,
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    bufferTime: {
        type: Number,
        default: 0 // trigger exactly at specified time
    },
    geofenceRadius: {
        type: Number,
        default: 500 // meters
    },
    coordinates: {
        lat: Number,
        lng: Number
    },
    alerts: {
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        email: { type: Boolean, default: true },
        notifyFamily: { type: Boolean, default: false },
        notifyEmergency: { type: Boolean, default: false }
    },
    reminderType: {
        type: String,
        enum: ['time', 'location'],
        default: 'time'
    },
    backupContacts: [{
        name: String,
        phone: String
    }],

    smartFeatures: {
        earlyWarning: { type: Boolean, default: true },
        trafficAware: { type: Boolean, default: true },
        itemExitGuards: { type: Boolean, default: true }
    },
    timeline: [{
        action: String,
        timestamp: Date,
        icon: String // e.g., 'bell', 'check', 'clock'
    }],
    condition: {
        type: String,
        enum: ['distance_check', 'time_only', 'none'],
        default: 'none'
    },
    repeat: {
        type: Boolean,
        default: false
    },
    googleEventId: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'snoozed', 'on_track', 'risk_alert'],
        default: 'pending'
    },
    notified: {
        type: Boolean,
        default: false
    },

    sharedWith: [{
        user: { type: String, ref: 'User' },
        permissions: { type: String, enum: ['view', 'edit'], default: 'view' }
    }],
    assignedTo: {
        type: String,
        ref: 'User',
        default: null
    },
    notifyCreator: {
        type: Boolean,
        default: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    source: {
        type: String,
        enum: ['buddy', 'google'],
        default: 'buddy'
    }
}, { timestamps: true });

// Performance Indexes
reminderSchema.index({ userId: 1 });
reminderSchema.index({ status: 1 });
reminderSchema.index({ intent: 1 });
reminderSchema.index({ priority: 1 });
reminderSchema.index({ googleEventId: 1 });
reminderSchema.index({ createdAt: -1 });
reminderSchema.index({ updatedAt: -1 });
// Composite indexes for critical queries
reminderSchema.index({ userId: 1, status: 1, notified: 1 });
reminderSchema.index({ userId: 1, createdAt: -1 });
// Text indexes for full-text search
reminderSchema.index({ title: 'text', description: 'text', notes: 'text' });

module.exports = mongoose.model('Reminder', reminderSchema);
