const Reminder = require('../../models/Reminder');
const LocationReminder = require('../../models/LocationReminder');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { sendPushNotification } = require('../../services/notificationService');
const { sendEmail } = require('../../services/emailService');
const { emitDataSync } = require('../../utils/socketEmitter');
const { triggerVectorReload, appendOverdueStatus, calcAdjustedNotification } = require('./helpers');

// ─── Get Reminders ─────────────────────────────────────────────────────────────
exports.getReminders = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const baseQuery = {
            $or: [
                { userId },
                { 'sharedWith.user': userId },
                { assignedTo: userId }
            ]
        };

        const { start, end } = req.query;
        const dateQuery = {};
        if (start && end) {
            dateQuery.date = { $gte: start, $lte: end };
        }

        const reminderQuery = { ...baseQuery, ...dateQuery };
        const locReminderQuery = { ...baseQuery, ...dateQuery };

        const [stdReminders, locReminders] = await Promise.all([
            Reminder.find(reminderQuery)
                .populate('userId', 'name email profilePicture')
                .populate('sharedWith.user', 'name email profilePicture')
                .lean()
                .sort({ updatedAt: -1 }),
            LocationReminder.find(locReminderQuery)
                .populate('userId', 'name email profilePicture')
                .lean()
                .sort({ updatedAt: -1 })
        ]);

        const combined = [
            ...stdReminders.map(r => ({ ...r, _model: 'Reminder' })),
            ...locReminders.map(r => ({ ...r, _model: 'LocationReminder', reminderType: 'location' }))
        ];

        combined.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const paginated = combined.slice(skip, skip + limit);

        const augmentedData = appendOverdueStatus(paginated);

        res.status(200).json({
            success: true,
            data: augmentedData,
            pagination: {
                total: combined.length,
                totalPages: Math.ceil(combined.length / limit),
                currentPage: page,
                limit,
                hasNextPage: page < Math.ceil(combined.length / limit),
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('[ReminderController] getReminders Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Create Reminder ──────────────────────────────────────────────────────────
exports.createReminder = async (req, res) => {
    try {
        const {
            title, description, date, time, location, intent, priority,
            bufferTime, alerts, smartFeatures, syncToGoogle,
            coordinates, geofenceRadius, reminderType,
            sharedWith, notifyCreator
        } = req.body;

        // Flexible validation based on reminder type
        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        if (reminderType === 'location' && !location) {
            return res.status(400).json({ success: false, message: 'Location is required for location reminders' });
        }

        if ((!reminderType || reminderType === 'time') && (!date || !time)) {
            return res.status(400).json({ success: false, message: 'Date and time are required for time-based reminders' });
        }

        const userId = req.user._id;

        let finalCoordinates = coordinates;

        // AUTO-GEOCODE: Use location name to find coordinates if missing
        if (location && (!finalCoordinates?.lat || !finalCoordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../../services/smartReminderService');
                const user = await User.findById(userId);
                const coords = await geocodeAddress(location, user?.currentLocation);
                if (coords) {
                    finalCoordinates = coords;
                    console.log(`[ReminderController] Auto-geocoded "${location}" to:`, coords);
                }
            } catch (err) {
                console.warn("[ReminderController] Auto-geocoding failed during Create:", err.message);
            }
        }

        const reminder = await Reminder.create({
            userId,
            title,
            description,
            date,
            time,
            location,
            coordinates: finalCoordinates,
            geofenceRadius: geofenceRadius || 500,
            reminderType: reminderType || 'time',
            intent: intent || 'generic',
            priority: priority || 'medium',
            bufferTime: bufferTime || 0,
            alerts: alerts || { push: true, email: true, notifyFamily: false, notifyEmergency: false },
            smartFeatures: smartFeatures || { earlyWarning: true, trafficAware: true, itemExitGuards: true },
            sharedWith: sharedWith || [],
            notifyCreator: notifyCreator !== undefined ? notifyCreator : true
        });

        // Background Google Calendar Sync
        const { syncReminder } = require('../../services/googleCalendarService');
        syncReminder(req.user, reminder).then(async (googleEventId) => {
            if (googleEventId) {
                await Reminder.findByIdAndUpdate(reminder._id, {
                    googleEventId,
                    source: 'google'
                });
                console.log(`[ReminderSync] Updated reminder ${reminder._id} with Google Event ID: ${googleEventId}`);
            }
        }).catch(err => console.error('[ReminderSync] Background sync error:', err));

        // COLLABORATION LOGIC: Alert newly added users
        if (reminder.sharedWith && reminder.sharedWith.length > 0) {
            const shareMessage = `${req.user.name} shared a reminder with you: "${reminder.title}"`;
            for (const shared of reminder.sharedWith) {
                const targetUserId = shared.user;
                const targetUser = await User.findById(targetUserId);
                if (targetUser) {
                    await Notification.create({
                        userId: targetUser._id,
                        title: 'New Shared Reminder',
                        message: shareMessage,
                        type: 'reminder',
                        relatedId: reminder._id,
                        onModel: 'Reminder',
                        actionUrl: '/admin/reminders'
                    });

                    if (targetUser.fcmTokens && targetUser.fcmTokens.length > 0) {
                        const pushPromises = targetUser.fcmTokens.map(token =>
                            sendPushNotification(token, 'New Shared Reminder', shareMessage, { type: 'reminder_share', reminderId: reminder._id.toString() })
                                .catch(err => console.error(`Failed to push to token ${token}:`, err.message))
                        );
                        await Promise.all(pushPromises);
                    }

                    if (targetUser.email) {
                        try {
                            await sendEmail(
                                targetUser.email,
                                'New Shared Reminder - Buddy AI',
                                shareMessage,
                                `<div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h2>Hello ${targetUser.name},</h2>
                                    <p>${req.user.name} has shared a reminder with you on <b>Buddy AI</b>.</p>
                                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h3 style="margin: 0; color: #0075ff;">${reminder.title}</h3>
                                        <p style="margin: 10px 0 0 0;"><b>Schedule:</b> ${reminder.date || 'TBD'} at ${reminder.time || 'TBD'}</p>
                                    </div>
                                    <p>Log in to your account to view the details.</p>
                                </div>`
                            );
                        } catch (e) {
                            console.warn("Share email failed:", e.message);
                        }
                    }
                }
            }
        }

        const fullyPopulated = await Reminder.findById(reminder._id)
            .populate('userId', 'name email profilePicture')
            .populate('sharedWith.user', 'name email profilePicture');

        const syncUserIds = [userId, ...(reminder.sharedWith.map(s => s.user.toString()))];
        emitDataSync(req, res, syncUserIds, 'task', 'create', { id: reminder._id });

        triggerVectorReload();

        res.status(201).json({
            success: true,
            data: appendOverdueStatus(fullyPopulated)
        });
    } catch (error) {
        const fs = require('fs');
        const logMsg = `[${new Date().toISOString()}] Standard Create Error: ${error.message}\nStack: ${error.stack}\nBody: ${JSON.stringify(req.body)}\nUser: ${req.user?._id}\n---\n`;
        fs.appendFileSync('error_debug.log', logMsg);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Update Reminder ───────────────────────────────────────────────────────────
exports.updateReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const updateData = req.body;

        // 1. Try finding in standard Reminder collection
        let reminder = await Reminder.findOne({
            _id: id,
            $or: [{ userId }, { 'sharedWith.user': userId }]
        });
        let modelType = 'Reminder';

        // 2. FALLBACK: Try finding in LocationReminder collection
        if (!reminder) {
            reminder = await LocationReminder.findOne({ _id: id, userId });
            modelType = 'LocationReminder';
        }

        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found or access denied' });
        }

        const isOwner = reminder.userId.toString() === userId.toString();

        // Security: Only owner can modify collaboration list (standard Reminder only)
        if (modelType === 'Reminder' && !isOwner && updateData.sharedWith) {
            delete updateData.sharedWith;
        }

        const oldSharedWithIds = modelType === 'Reminder' ? (reminder.sharedWith || [])
            .map(s => s.user ? s.user.toString() : null)
            .filter(Boolean) : [];

        if (modelType === 'Reminder' && updateData.sharedWith && Array.isArray(updateData.sharedWith)) {
            updateData.sharedWith = updateData.sharedWith.filter(s => {
                const uid = s.user && typeof s.user === 'object' ? (s.user._id || s.user.id) : s.user;
                return uid && uid !== 'null' && uid !== 'undefined' && uid !== '';
            });
        }

        // Handle Auto-Geocode if location changed
        if (updateData.location && (!updateData.coordinates?.lat || !updateData.coordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../../services/smartReminderService');
                const user = await User.findById(userId);
                const coords = await geocodeAddress(updateData.location, user?.currentLocation);
                if (coords) updateData.coordinates = coords;
            } catch (err) {
                console.warn("[DEBUG_REMINDER] Geocode failed:", err.message);
            }
        }

        // Explicitly handle sharedWith assignment (standard Reminder only)
        if (modelType === 'Reminder' && updateData.sharedWith) {
            reminder.sharedWith = updateData.sharedWith;
            delete updateData.sharedWith;
        }

        Object.assign(reminder, updateData);
        const updatedReminder = await reminder.save();

        // Collaboration Diff & Notifications (standard Reminder only)
        if (modelType === 'Reminder') {
            const newSharedWithIds = updatedReminder.sharedWith
                .map(s => s.user ? s.user.toString() : null)
                .filter(Boolean);

            const newlyAddedUsers = newSharedWithIds.filter(uid => !oldSharedWithIds.includes(uid));
            const removedUsers = oldSharedWithIds.filter(uid => !newSharedWithIds.includes(uid));

            if (newlyAddedUsers.length > 0) {
                const shareMessage = `${req.user.name} shared a reminder: "${updatedReminder.title}"`;
                for (const targetUserId of newlyAddedUsers) {
                    try {
                        const targetUser = await User.findById(targetUserId);
                        if (targetUser) {
                            await Notification.create({
                                userId: targetUser._id,
                                title: 'New Shared Reminder',
                                message: shareMessage,
                                type: 'reminder',
                                relatedId: updatedReminder._id,
                                onModel: 'Reminder'
                            });

                            if (targetUser.fcmTokens?.length > 0) {
                                for (const token of targetUser.fcmTokens) {
                                    sendPushNotification(token, 'New Shared Reminder', shareMessage, {
                                        type: 'reminder_share',
                                        reminderId: updatedReminder._id.toString()
                                    }).catch(() => { });
                                }
                            }

                            if (targetUser.email) {
                                sendEmail(targetUser.email, 'Shared Reminder - Buddy AI', shareMessage).catch(() => { });
                            }
                        }
                    } catch (e) { console.error("[DEBUG_REMINDER] Notify error:", e.message); }
                }
            }

            if (removedUsers.length > 0) {
                for (const rid of removedUsers) {
                    Notification.create({
                        userId: rid,
                        title: 'Access Revoked',
                        message: `You no longer have access to "${updatedReminder.title}"`,
                        type: 'reminder',
                        relatedId: updatedReminder._id,
                        onModel: 'Reminder'
                    }).catch(() => { });
                }
            }
        }

        const syncUserIds = [userId, ...oldSharedWithIds];
        if (modelType === 'Reminder' && updatedReminder.sharedWith) {
            updatedReminder.sharedWith.forEach(s => {
                if (s.user) syncUserIds.push(s.user.toString());
            });
        }
        
        emitDataSync(req, res, [...new Set(syncUserIds)], 'task', 'update', { id });
        triggerVectorReload();

        res.status(200).json({ 
            success: true, 
            data: appendOverdueStatus(updatedReminder),
            _model: modelType 
        });

    } catch (error) {
        console.error('[ReminderController] Update Global Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Delete Reminder ──────────────────────────────────────────────────────────
exports.deleteReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        // 1. Try finding in standard Reminder collection
        let reminder = await Reminder.findOne({ _id: id, userId });
        let modelUsed = Reminder;

        // 2. FALLBACK: Try finding in LocationReminder collection
        if (!reminder) {
            reminder = await LocationReminder.findOne({ _id: id, userId });
            modelUsed = LocationReminder;
        }

        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        if (reminder.googleEventId) {
            try {
                const { deleteGoogleCalendarEvent } = require('../../services/googleCalendarService');
                await deleteGoogleCalendarEvent(userId, reminder.googleEventId);
            } catch (calError) {
                console.error("Google Sync Failed during Delete:", calError.message);
            }
        }

        const syncUserIds = [userId];
        if (reminder.sharedWith) {
            reminder.sharedWith.forEach(s => syncUserIds.push(s.user.toString()));
        }

        emitDataSync(req, res, [...new Set(syncUserIds)], 'task', 'delete', { id });

        await modelUsed.findByIdAndDelete(id);

        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Batch Delete Reminders ───────────────────────────────────────────────────
exports.batchDeleteReminders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, message: 'Invalid IDs' });
        }

        // Find reminders across both collections for Google Calendar sync
        const [remindersStd, remindersLoc] = await Promise.all([
            Reminder.find({ _id: { $in: ids }, userId }),
            LocationReminder.find({ _id: { $in: ids }, userId })
        ]);

        const allReminders = [...remindersStd, ...remindersLoc];

        // Background Google Calendar Sync
        const { deleteGoogleCalendarEvent } = require('../../services/googleCalendarService');
        await Promise.allSettled(allReminders.map(r => {
            if (r.googleEventId) {
                return deleteGoogleCalendarEvent(userId, r.googleEventId);
            }
            return Promise.resolve();
        }));

        // Delete from both collections
        const [stdResult, locResult] = await Promise.all([
            Reminder.deleteMany({ _id: { $in: ids }, userId }),
            LocationReminder.deleteMany({ _id: { $in: ids }, userId })
        ]);

        const totalDeleted = (stdResult.deletedCount || 0) + (locResult.deletedCount || 0);

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, [userId], 'task', 'batch_delete', { ids });

        triggerVectorReload();

        res.status(200).json({ 
            success: true, 
            message: `${totalDeleted} reminders deleted successfully`,
            deletedCount: totalDeleted 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Adjusted Notification Endpoint ──────────────────────────────────────────
exports.getAdjustedNotification = (req, res) => {
    try {
        const { pickup_time, estimated_travel_time_minutes, safety_buffer_minutes, time_format } = req.body;
        if (!pickup_time) {
            return res.status(400).json({ success: false, message: 'pickup_time is required' });
        }

        const travelMin = Number(estimated_travel_time_minutes) || 0;
        const bufferMin = Number(safety_buffer_minutes) || 0;
        const fmt = time_format === '24' ? '24' : '12';

        const result = calcAdjustedNotification(pickup_time, travelMin, bufferMin, fmt);
        if (!result) {
            return res.status(400).json({ success: false, message: 'Invalid pickup_time format. Use HH:MM or HH:MM AM/PM' });
        }

        const totalPrepare = travelMin + bufferMin;

        return res.json({
            success: true,
            pickup_time: result.pickupFormatted,
            estimated_travel_time: travelMin > 0 ? `${travelMin} mins` : '0 mins',
            safety_buffer_time: `${bufferMin} mins`,
            total_prepare_time: `${totalPrepare} mins`,
            adjusted_notification_time: result.adjustedTime
        });
    } catch (error) {
        console.error('[AdjustedNotification]', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Calendar Stats ───────────────────────────────────────────────────────────
exports.getCalendarStats = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const { start, end } = req.query;

        const stdQuery = {
            $or: [
                { userId },
                { 'sharedWith.user': userId },
                { assignedTo: userId }
            ]
        };

        const locQuery = { userId }; // LocationReminder doesn't have sharedWith/assignedTo

        if (start && end) {
            stdQuery.date = { $gte: start, $lte: end };
            locQuery.date = { $gte: start, $lte: end };
        }

        const [stdStats, locStats] = await Promise.all([
            Reminder.aggregate([
                { $match: stdQuery },
                { $group: { _id: "$date", count: { $sum: 1 } } }
            ]),
            LocationReminder.aggregate([
                { $match: locQuery },
                { $group: { _id: "$date", count: { $sum: 1 } } }
            ])
        ]);

        const formattedData = {};

        stdStats.forEach(item => {
            if (item._id) formattedData[item._id] = (formattedData[item._id] || 0) + item.count;
        });

        locStats.forEach(item => {
            if (item._id) formattedData[item._id] = (formattedData[item._id] || 0) + item.count;
        });

        res.status(200).json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error("Calendar Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
