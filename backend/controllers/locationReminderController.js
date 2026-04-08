const Reminder = require('../models/Reminder');
const paginate = require('../utils/paginate');
const { emitDataSync } = require('../utils/socketEmitter');
const axios = require('axios');

// ─── AI SYNC HELPER ───────────────────────────────────────────────────────────
/**
 * Notify the Python AI service to reload its vector store after knowledge changes.
 */
async function triggerVectorReload() {
    try {
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        await axios.post(`${aiServiceUrl}/system/reload`, {}, {
            headers: { 'X-API-Key': process.env.INTERNAL_SECRET || process.env.BUDDY_API_KEY || '' }
        });
        console.log('[AI-SYNC] Vector store reload triggered from Location Controller');
    } catch (error) {
        console.error('[AI-SYNC] Failed to trigger vector store reload:', error.message);
    }
}

// ─── GET all location reminders for current user ──────────────────────────────
exports.getLocationReminders = async (req, res) => {
    try {
        const results = await paginate(Reminder, {
            userId: req.user._id,
            reminderType: 'location'
        }, req.query);
        res.status(200).json({ success: true, ...results });
    } catch (error) {
        console.error('[LocationReminder] getAll error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── GET single location reminder ─────────────────────────────────────────────
exports.getLocationReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOne({
            _id: req.params.id,
            userId: req.user._id,
            reminderType: 'location'
        });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }
        res.status(200).json({ success: true, data: reminder });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── CREATE location reminder ─────────────────────────────────────────────────
exports.createLocationReminder = async (req, res) => {
    try {
        const {
            title, description, location, coordinates,
            date, time, status, warningLevel,
            bufferTime, notifyPhone, notifyFamily,
            notifyEmergency, geofenceRadius
        } = req.body;

        if (!title || !location) {
            return res.status(400).json({
                success: false,
                message: 'title and location are required'
            });
        }

        let finalCoordinates = coordinates || { lat: null, lng: null };

        // AUTO-GEOCODE: Use location name to find coordinates if missing
        if (location && (!finalCoordinates.lat || !finalCoordinates.lng)) {
            try {
                const { geocodeAddress } = require('../services/smartReminderService');
                const User = require('../models/User');
                const user = await User.findById(req.user._id);
                const coords = await geocodeAddress(location, user?.currentLocation);
                if (coords) {
                    finalCoordinates = coords;
                    console.log(`[LocationReminderController] Auto-geocoded "${location}" to:`, coords);
                }
            } catch (err) {
                console.warn("[LocationReminderController] Auto-geocoding failed during Create:", err.message);
            }
        }

        const reminder = await Reminder.create({
            userId: req.user._id,
            title,
            description: description || '',
            location,
            coordinates: finalCoordinates,
            date: date || null,
            time: time || null,
            status: status || 'on_track',
            priority: warningLevel || 'medium', // Map warningLevel to priority
            bufferTime: bufferTime ?? 15,
            reminderType: 'location',
            alerts: {
                push: notifyPhone ?? true,
                notifyFamily: notifyFamily ?? false,
                notifyEmergency: notifyEmergency ?? false,
                email: true
            },
            smartFeatures: {
                earlyWarning: req.body.earlyWarningSet ?? true,
                trafficAware: req.body.trafficAware ?? true,
                itemExitGuards: req.body.itemExitGuards ?? true
            },
            geofenceRadius: geofenceRadius ?? 500
        });

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'location_reminder', 'create', { id: reminder._id });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        const fs = require('fs');
        const logMsg = `[${new Date().toISOString()}] Create Error: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\nUser: ${req.user?._id}\n---\n`;
        fs.appendFileSync('error_debug.log', logMsg);
        console.error('[LocationReminder] create error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error', debug: error.message });
    }
};

// ─── UPDATE location reminder ─────────────────────────────────────────────────
exports.updateLocationReminder = async (req, res) => {
    try {
        const {
            title, description, location, coordinates,
            date, time, status, warningLevel,
            bufferTime, notifyPhone, notifyFamily,
            notifyEmergency, geofenceRadius
        } = req.body;

        const allowedUpdate = {};
        if (title !== undefined) allowedUpdate.title = title;
        if (description !== undefined) allowedUpdate.description = description;
        if (location !== undefined) allowedUpdate.location = location;
        if (coordinates !== undefined) allowedUpdate.coordinates = coordinates;
        
        // Handle Auto-Geocode if location changed and no coordinates provided
        if (allowedUpdate.location && (!allowedUpdate.coordinates?.lat || !allowedUpdate.coordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../services/smartReminderService');
                const User = require('../models/User');
                const user = await User.findById(req.user._id);
                const coords = await geocodeAddress(allowedUpdate.location, user?.currentLocation);
                if (coords) allowedUpdate.coordinates = coords;
            } catch (err) {
                console.warn("[LocationReminderController] Geocode failed during Update:", err.message);
            }
        }

        if (date !== undefined) allowedUpdate.date = date;
        if (time !== undefined) allowedUpdate.time = time;
        if (status !== undefined) allowedUpdate.status = status;
        if (warningLevel !== undefined) allowedUpdate.priority = warningLevel;
        if (bufferTime !== undefined) allowedUpdate.bufferTime = bufferTime;

        // Handle nested alerts object for updates
        if (notifyPhone !== undefined || notifyFamily !== undefined || notifyEmergency !== undefined) {
            const reminder = await Reminder.findOne({ _id: req.params.id, userId: req.user._id });
            if (reminder) {
                allowedUpdate.alerts = {
                    ...reminder.alerts,
                    push: notifyPhone !== undefined ? notifyPhone : reminder.alerts.push,
                    notifyFamily: notifyFamily !== undefined ? notifyFamily : reminder.alerts.notifyFamily,
                    notifyEmergency: notifyEmergency !== undefined ? notifyEmergency : reminder.alerts.notifyEmergency
                };
            }
        }

        if (geofenceRadius !== undefined) allowedUpdate.geofenceRadius = geofenceRadius;

        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, reminderType: 'location' },
            { $set: allowedUpdate },
            { new: true, runValidators: true }
        );
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'location_reminder', 'update', { id: req.params.id });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, data: reminder });
    } catch (error) {
        console.error('[LocationReminder] update error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── DELETE location reminder ─────────────────────────────────────────────────
exports.deleteLocationReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
            reminderType: 'location'
        });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'location_reminder', 'delete', { id: req.params.id });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Location reminder deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── SET EARLY WARNING on a location reminder ─────────────────────────────────
exports.setEarlyWarning = async (req, res) => {
    try {
        const { bufferTime, warningLevel, notifyPhone, notifyFamily, notifyEmergency } = req.body;

        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, reminderType: 'location' },
            {
                $set: {
                    'smartFeatures.earlyWarning': true,
                    bufferTime: bufferTime ?? 15,
                    priority: warningLevel || 'medium',
                    'alerts.push': notifyPhone ?? true,
                    'alerts.notifyFamily': notifyFamily ?? false,
                    'alerts.notifyEmergency': notifyEmergency ?? false,
                    'alerts.email': req.body.notifyEmail ?? true,
                    'smartFeatures.trafficAware': req.body.trafficAware ?? true,
                    'smartFeatures.itemExitGuards': req.body.itemExitGuards ?? true
                }
            },
            { new: true }
        );
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'location_reminder', 'update', { id: req.params.id });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, data: reminder, message: 'Early warning saved' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── SET FAMILY BACKUP on a location reminder ────────────────────────────────
exports.setFamilyBackup = async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, reminderType: 'location' },
            { $set: { 'alerts.notifyFamily': true } },
            { new: true }
        );
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'location_reminder', 'update', { id: req.params.id });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, data: reminder, message: 'Family backup activated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
