const LocationReminder = require('../models/LocationReminder');
const paginate = require('../utils/paginate');
const { emitDataSync } = require('../utils/socketEmitter');
const axios = require('axios');

const { triggerVectorReload } = require('./reminders/helpers');

// ─── GET all location reminders for current user ──────────────────────────────
exports.getLocationReminders = async (req, res) => {
    try {
        const results = await paginate(LocationReminder, {
            userId: req.user._id
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
        const reminder = await LocationReminder.findOne({
            _id: req.params.id,
            userId: req.user._id
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

        const reminder = await LocationReminder.create({
            userId: req.user._id,
            title,
            description: description || '',
            location,
            coordinates: finalCoordinates,
            date: date || '',
            time: time || '',
            status: status || 'on_track',
            warningLevel: warningLevel || 'medium',
            bufferTime: bufferTime ?? 15,
            notifyPhone: notifyPhone ?? true,
            notifyFamily: notifyFamily ?? false,
            notifyEmergency: notifyEmergency ?? false,
            notifyEmail: true,
            earlyWarningSet: req.body.earlyWarningSet ?? true,
            trafficAware: req.body.trafficAware ?? true,
            itemExitGuards: req.body.itemExitGuards ?? true,
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
        if (warningLevel !== undefined) allowedUpdate.warningLevel = warningLevel;
        if (bufferTime !== undefined) allowedUpdate.bufferTime = bufferTime;
        if (notifyPhone !== undefined) allowedUpdate.notifyPhone = notifyPhone;
        if (notifyFamily !== undefined) allowedUpdate.notifyFamily = notifyFamily;
        if (notifyEmergency !== undefined) allowedUpdate.notifyEmergency = notifyEmergency;

        if (geofenceRadius !== undefined) allowedUpdate.geofenceRadius = geofenceRadius;

        const reminder = await LocationReminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
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
        const reminder = await LocationReminder.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
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

        const reminder = await LocationReminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            {
                $set: {
                    earlyWarningSet: true,
                    bufferTime: bufferTime ?? 15,
                    warningLevel: warningLevel || 'medium',
                    notifyPhone: notifyPhone ?? true,
                    notifyFamily: notifyFamily ?? false,
                    notifyEmergency: notifyEmergency ?? false,
                    notifyEmail: req.body.notifyEmail ?? true,
                    trafficAware: req.body.trafficAware ?? true,
                    itemExitGuards: req.body.itemExitGuards ?? true
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
        const reminder = await LocationReminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: { notifyFamily: true } },
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
