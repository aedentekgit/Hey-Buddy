const LocationReminder = require('../models/LocationReminder');

// ─── GET all location reminders for current user ──────────────────────────────
exports.getLocationReminders = async (req, res) => {
    try {
        const reminders = await LocationReminder.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: reminders });
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

        const reminder = await LocationReminder.create({
            userId: req.user._id,
            title,
            description: description || '',
            location,
            coordinates: coordinates || { lat: null, lng: null },
            date,
            time,
            status: status || 'on_track',
            warningLevel: warningLevel || 'medium',
            bufferTime: bufferTime ?? 15,
            notifyPhone: notifyPhone ?? true,
            notifyFamily: notifyFamily ?? false,
            notifyEmergency: notifyEmergency ?? false,
            geofenceRadius: geofenceRadius ?? 500
        });

        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        console.error('[LocationReminder] create error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// ─── UPDATE location reminder ─────────────────────────────────────────────────
exports.updateLocationReminder = async (req, res) => {
    try {
        // SECURITY: Explicit whitelist of updatable fields to prevent mass assignment.
        // Previously used { $set: req.body } which allowed callers to overwrite any field
        // including userId, _id, or internal system fields.
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
            { $set: { familyBackupSet: true } },
            { new: true }
        );
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Location reminder not found' });
        }
        res.status(200).json({ success: true, data: reminder, message: 'Family backup activated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};
