const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    intent: {
        type: String,
        enum: ['meeting', 'medicine', 'pickup', 'bill', 'personal', 'generic'],
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
        type: mongoose.Schema.Types.ObjectId,
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
        default: 15 // minutes
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
        email: { type: Boolean, default: false }
    },
    backupContacts: [{
        name: String,
        phone: String
    }],
    escalationTime: {
        type: Number,
        enum: [0, 15, 30],
        default: 0 // 0 means 'Immediately'
    },
    smartFeatures: {
        earlyWarning: { type: Boolean, default: false },
        trafficAware: { type: Boolean, default: false },
        itemExitGuards: { type: Boolean, default: false }
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
        enum: ['pending', 'completed', 'cancelled', 'snoozed'],
        default: 'pending'
    },
    notified: {
        type: Boolean,
        default: false
    },
    sharedWith: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permissions: { type: String, enum: ['view', 'edit'], default: 'view' }
    }],
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isPublic: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Reminder', reminderSchema);
