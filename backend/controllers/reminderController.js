const config = require('../config/env');
const Reminder = require('../models/Reminder');
const LocationReminder = require('../models/LocationReminder');
const Notification = require('../models/Notification');
const { google } = require('googleapis');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const paginate = require('../utils/paginate');

const {
    createGoogleCalendarEvent,
    updateGoogleCalendarEvent,
    deleteGoogleCalendarEvent
} = require('../services/googleCalendarService');

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
        console.log('[AI-SYNC] Vector store reload triggered successfully');
    } catch (error) {
        console.error('[AI-SYNC] Failed to trigger vector store reload:', error.message);
    }
}

// ─── Shared Helper ────────────────────────────────────────────────────────────
/**
 * Given a pickup time string ("HH:MM" or "HH:MM AM/PM"), subtract total prepare
 * minutes and return a formatted adjusted time string.
 *
 * @param {string} pickupTime  - "23:00" or "11:00 PM" or "11:00 pm"
 * @param {number} travelMin   - estimated travel time in minutes
 * @param {number} bufferMin   - safety buffer in minutes
 * @param {string} timeFormat  - "12" or "24", defaults to "12"
 * @returns {{ adjustedTime: string, pickupFormatted: string, totalPrepare: number }}
 */
function calcAdjustedNotification(pickupTime, travelMin, bufferMin, timeFormat = '12') {
    if (!pickupTime) return null;
    const total = (Number(travelMin) || 0) + (Number(bufferMin) || 0);

    // Parse pickup time (supports "HH:MM", "HH:MM AM", "HH:MM PM")
    let [timePart, meridiem] = pickupTime.trim().split(' ');
    let [hStr, mStr] = timePart.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;

    if (meridiem) {
        if (meridiem.toLowerCase() === 'pm' && h < 12) h += 12;
        if (meridiem.toLowerCase() === 'am' && h === 12) h = 0;
    }

    // Build a base date (today) and subtract
    const base = new Date();
    base.setHours(h, m, 0, 0);
    const adjusted = new Date(base.getTime() - total * 60000);

    const fmt = (d, fmt12) => {
        const ah = d.getHours();
        const am = d.getMinutes();
        if (fmt12 === '24') {
            return `${String(ah).padStart(2, '0')}:${String(am).padStart(2, '0')}`;
        }
        const period = ah >= 12 ? 'PM' : 'AM';
        const displayH = ah % 12 || 12;
        return `${String(displayH).padStart(2, '0')}:${String(am).padStart(2, '0')} ${period}`;
    };

    return {
        adjustedTime: fmt(adjusted, timeFormat),
        pickupFormatted: fmt(base, timeFormat),
        totalPrepare: total
    };
}

// ─── Adjusted Notification Endpoint ──────────────────────────────────────────
/**
 * POST /reminders/adjusted-notification
 * Body: { pickup_time, estimated_travel_time_minutes, safety_buffer_minutes, time_format? }
 */
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

// ─── Overdue Status Helper ──────────────────────────────────────────────────
function appendOverdueStatus(data) {
    const isArray = Array.isArray(data);
    const records = isArray ? data : [data];
    const now = new Date();

    const augmented = records.map(r => {
        let isOverdue = false;
        // Evaluate if past the deadline, regardless of status, so UI can show Pending switch if needed
        if (r.date && r.time) {
            let reminderHour = 0;
            let reminderMin = 0;
            const timeStr = r.time || '00:00';
            const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

            if (ampmMatch) {
                reminderHour = parseInt(ampmMatch[1], 10);
                reminderMin = parseInt(ampmMatch[2], 10);
                const period = ampmMatch[3].toLowerCase();
                if (period === 'pm' && reminderHour < 12) reminderHour += 12;
                if (period === 'am' && reminderHour === 12) reminderHour = 0;
            } else {
                const parts = timeStr.split(':');
                reminderHour = parseInt(parts[0], 10) || 0;
                reminderMin = parseInt(parts[1], 10) || 0;
            }

            const reminderDateTime = new Date(r.date);
            reminderDateTime.setHours(reminderHour, reminderMin, 0, 0);

            if (reminderDateTime < now) {
                isOverdue = true;
            }
        }

        const obj = typeof r.toObject === 'function' ? r.toObject() : r;
        return {
            ...obj,
            isOverdue
        };
    });

    return isArray ? augmented : augmented[0];
}

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

        // Apply filters to both collections
        const reminderQuery = { ...baseQuery, ...dateQuery };
        // We *don't* exclude 'location' type here anymore to ensure all Reminder docs are included
        
        const locReminderQuery = { ...baseQuery, ...dateQuery };

        // Fetch from both in parallel
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

        // Merge and tag them so UI can identify the model if needed
        const combined = [
            ...stdReminders.map(r => ({ ...r, _model: 'Reminder' })),
            ...locReminders.map(r => ({ ...r, _model: 'LocationReminder', reminderType: 'location' }))
        ];

        // Sort combined list by updatedAt desc (or date/time if preferred)
        combined.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        // Paginate manually if needed, but for mobile limits are high (100)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const paginated = combined.slice(skip, skip + limit);

        // Process records to append `isOverdue` dynamically
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

exports.createReminder = async (req, res) => {
    try {
        const {
            title, description, date, time, location, intent, priority,
            bufferTime, alerts, smartFeatures, syncToGoogle,
            coordinates, geofenceRadius, reminderType,
            sharedWith, notifyCreator
        } = req.body;

        if (!title || !date || !time) {
            return res.status(400).json({ success: false, message: 'Title, date, and time are required' });
        }

        const userId = req.user._id;

        let finalCoordinates = coordinates;

        // AUTO-GEOCODE: Use location name to find coordinates if missing
        if (location && (!finalCoordinates?.lat || !finalCoordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../services/smartReminderService');
                const User = require('../models/User');
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

        // Create reminder in database
        const reminder = await Reminder.create({
            userId,
            title,
            description,
            date,
            time,
            location,
            coordinates: finalCoordinates,
            geofenceRadius: geofenceRadius || 500,
            reminderType: reminderType || (location ? 'location' : 'time'),
            intent: intent || 'generic',
            priority: priority || 'medium',
            bufferTime: bufferTime || 0,
            alerts: alerts || { push: true, email: true, notifyFamily: false, notifyEmergency: false },
            smartFeatures: smartFeatures || { earlyWarning: true, trafficAware: true, itemExitGuards: true },
            sharedWith: sharedWith || [],
            notifyCreator: notifyCreator !== undefined ? notifyCreator : true
        });

        // Background Google Calendar Sync
        const { syncReminder } = require('../services/googleCalendarService');
        syncReminder(req.user, reminder).then(async (googleEventId) => {
            if (googleEventId) {
                await Reminder.findByIdAndUpdate(reminder._id, {
                    googleEventId,
                    source: 'google'
                });
                console.log(`[ReminderSync] Updated reminder ${reminder._id} with Google Event ID: ${googleEventId}`);
            }
        }).catch(err => console.error('[ReminderSync] Background sync error:', err));

        // NEW COLLABORATION LOGIC: Alert newly added users
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

        // Return populated
        const fullyPopulated = await Reminder.findById(reminder._id)
            .populate('userId', 'name email profilePicture')
            .populate('sharedWith.user', 'name email profilePicture');

        // EMIT REAL-TIME SYNC: Notify the creator and any added collaborators
        const syncUserIds = [userId, ...(reminder.sharedWith.map(s => s.user.toString()))];
        emitDataSync(req, res, syncUserIds, 'task', 'create', { id: reminder._id });

        // TRigger AI vector store reload to index the new reminder
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


exports.updateReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const updateData = req.body;

        const reminder = await Reminder.findOne({
            _id: id,
            $or: [{ userId }, { 'sharedWith.user': userId }]
        });

        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found or access denied' });
        }

        const isOwner = reminder.userId.toString() === userId.toString();
        console.log(`[DEBUG_REMINDER] Update by ${req.user.name}. isOwner: ${isOwner}`);

        // Security: Only owner can modify collaboration list
        if (!isOwner && updateData.sharedWith) {
            console.warn(`[DEBUG_REMINDER] Non-owner ${userId} blocked from modifying collaboration list.`);
            delete updateData.sharedWith;
        }

        // Capture previous collaborators for diffing before update
        const oldSharedWithIds = (reminder.sharedWith || [])
            .map(s => s.user ? s.user.toString() : null)
            .filter(Boolean);

        // Sanitize incoming sharedWith
        if (updateData.sharedWith && Array.isArray(updateData.sharedWith)) {
            const originalCount = updateData.sharedWith.length;
            updateData.sharedWith = updateData.sharedWith.filter(s => {
                const uid = s.user && typeof s.user === 'object' ? (s.user._id || s.user.id) : s.user;
                return uid && uid !== 'null' && uid !== 'undefined' && uid !== '';
            });
            console.log(`[DEBUG_REMINDER] Shared list sanitized: ${originalCount} -> ${updateData.sharedWith.length}`);
        }

        // Handle Auto-Geocode if location changed
        if (updateData.location && (!updateData.coordinates?.lat || !updateData.coordinates?.lng)) {
            try {
                const { geocodeAddress } = require('../services/smartReminderService');
                const user = await User.findById(userId);
                const coords = await geocodeAddress(updateData.location, user?.currentLocation);
                if (coords) updateData.coordinates = coords;
            } catch (err) {
                console.warn("[DEBUG_REMINDER] Geocode failed:", err.message);
            }
        }

        // AUTO-ADJUST REMINDER TYPE: If location is added/changed, ensure it's categorized as 'location'
        if (updateData.location !== undefined) {
             updateData.reminderType = updateData.location ? 'location' : 'time';
        } else if (reminder.location) {
             updateData.reminderType = 'location';
        }

        // Explicitly handle sharedWith assignment to ensure Mongoose detects change
        if (updateData.sharedWith) {
            reminder.sharedWith = updateData.sharedWith;
            delete updateData.sharedWith;
        }

        // Apply remaining updates and SAVE
        Object.assign(reminder, updateData);
        const updatedReminder = await reminder.save();
        console.log(`[DEBUG_REMINDER] Saved "${updatedReminder.title}". Shared count: ${updatedReminder.sharedWith.length}`);

        // Collaboration Diff & Notifications
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

        // Return fully populated doc
        const fullyPopulated = await Reminder.findById(id)
            .populate('userId', 'name email profilePicture')
            .populate('sharedWith.user', 'name email profilePicture');

        // EMIT REAL-TIME SYNC: Update all relevant users (owner, previous, and new collaborators)
        const syncUserIds = [userId, ...oldSharedWithIds, ...newSharedWithIds];
        emitDataSync(req, res, syncUserIds, 'task', 'update', { id });

        // Trigger AI vector store reload to index the updated reminder
        triggerVectorReload();

        res.status(200).json({ success: true, data: appendOverdueStatus(fullyPopulated) });

    } catch (error) {
        console.error('[ReminderController] Update Global Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;

        const reminder = await Reminder.findOne({ _id: id, userId });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        // Sync to Google
        if (reminder.googleEventId) {
            try {
                const { deleteGoogleCalendarEvent } = require('../services/googleCalendarService');
                await deleteGoogleCalendarEvent(userId, reminder.googleEventId);
            } catch (calError) {
                console.error("Google Sync Failed during Delete:", calError.message);
            }
        }

        // EMIT REAL-TIME SYNC: Notify owner and any shared users before deletion is complete/final
        const syncUserIds = [userId, ...(reminder.sharedWith.map(s => s.user.toString()))];
        emitDataSync(req, res, syncUserIds, 'task', 'delete', { id });

        await Reminder.findByIdAndDelete(id);

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.batchDeleteReminders = async (req, res) => {
    try {
        const userId = req.user._id;
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, message: 'Invalid IDs' });
        }

        // Fetch reminders to check for Google events before deleting
        const reminders = await Reminder.find({ _id: { $in: ids }, userId });

        // Delete from Google Calendar in parallel
        await Promise.allSettled(reminders.map(r => {
            if (r.googleEventId) {
                return deleteGoogleCalendarEvent(userId, r.googleEventId);
            }
            return Promise.resolve();
        }));

        await Reminder.deleteMany({
            _id: { $in: ids },
            userId
        });

        // Trigger AI vector store reload
        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Reminders deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.shareReminder = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, permissions } = req.body;

        const targetUser = await User.findOne({ email });
        if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const reminder = await Reminder.findOne({ _id: id, userId: req.user._id });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found or you do not have permission' });
        }

        // Check if already shared
        const alreadyShared = reminder.sharedWith.find(s => s.user.toString() === targetUser._id.toString());
        if (alreadyShared) {
            alreadyShared.permissions = permissions || 'view';
        } else {
            reminder.sharedWith.push({ user: targetUser._id, permissions: permissions || 'view' });
        }

        await reminder.save();

        const shareMessage = `${req.user.name} shared a reminder with you: "${reminder.title}"`;

        // 1. Notify target user via Database
        await Notification.create({
            userId: targetUser._id,
            title: 'New Shared Reminder',
            message: shareMessage,
            type: 'reminder',
            relatedId: reminder._id,
            onModel: 'Reminder',
            actionUrl: '/admin/reminders'
        });

        // 2. Trigger Real-time Push Notification via FCM
        if (targetUser.fcmTokens && targetUser.fcmTokens.length > 0) {
            console.log(`Sending Real-time share push to ${targetUser.name}`);
            const notificationPromises = targetUser.fcmTokens.map(token =>
                sendPushNotification(
                    token,
                    'New Shared Reminder',
                    shareMessage,
                    { type: 'reminder_share', reminderId: reminder._id.toString() }
                ).catch(err => console.error(`Failed to send push to token ${token}:`, err.message))
            );
            await Promise.all(notificationPromises);
        }

        // 3. Send Email Invitation
        try {
            console.log(`Sending Real-time share email to ${email}`);
            await sendEmail(
                email,
                'New Shared Reminder - Buddy AI',
                shareMessage,
                `<div style="font-family: sans-serif; padding: 20px; color: #333;">
                    <h2>Hello ${targetUser.name},</h2>
                    <p>${req.user.name} has shared a reminder with you on <b>Buddy AI</b>.</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin: 0; color: #0075ff;">${reminder.title}</h3>
                        <p style="margin: 10px 0 0 0;"><b>Schedule:</b> ${reminder.date} at ${reminder.time}</p>
                    </div>
                    <p>Log in to your account to view the details.</p>
                </div>`
            );
        } catch (emailErr) {
            console.warn("Could not send share email invitation:", emailErr.message);
            // Don't fail the whole request if email fails, as push/db already worked
        }

        // Trigger AI vector store reload to update collaborator access
        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Reminder shared successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.unshareReminder = async (req, res) => {
    try {
        const { id, userId } = req.params;

        const reminder = await Reminder.findOne({ _id: id, userId: req.user._id });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found or you do not have permission' });
        }

        // Remove user from sharedWith array safely
        const initialCount = reminder.sharedWith.length;
        reminder.sharedWith = reminder.sharedWith.filter(s => {
            if (!s.user) return false; // Remove ghost/null users automatically
            return s.user.toString() !== userId;
        });

        if (reminder.sharedWith.length === initialCount) {
            // If nothing changed, maybe the userId passed was actually a subdocument _id?
            reminder.sharedWith = reminder.sharedWith.filter(s => s._id.toString() !== userId);
        }

        await reminder.save();

        // Notify the user that access was revoked
        const targetUser = await User.findById(userId);
        if (targetUser) {
            await Notification.create({
                userId: targetUser._id,
                title: 'Reminder Access Revoked',
                message: `${req.user.name} has stopped sharing "${reminder.title}" with you`,
                type: 'reminder',
                relatedId: reminder._id,
                onModel: 'Reminder'
            });
        }

        // Trigger AI vector store reload to update collaborator access
        triggerVectorReload();

        res.status(200).json({ success: true, message: 'User removed from shared list' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getGoogleAuthUrl = async (req, res) => {
    try {
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne().select('+googleCalendar.clientSecret');

        const googleConfig = settings?.googleCalendar;

        const clientId = googleConfig?.clientId;
        const clientSecret = googleConfig?.clientSecret;
        const redirectUri = googleConfig?.redirectUri || config.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret) {
            return res.status(400).json({ success: false, message: "Google Calendar credentials not configured." });
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );
        const scopes = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.readonly'];
        const state = req.user._id.toString();
        const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes, state: state, prompt: 'consent' });
        res.status(200).json({ success: true, url });
    } catch (error) {
        console.error("Auth URL Error:", error);
        res.status(500).json({ success: false, message: "Could not generate Auth URL" });
    }
};

exports.googleCallback = async (req, res) => {
    try {
        const { code, state: userId } = req.query;
        if (!code) return res.status(400).send("No code provided from Google");

        const Settings = require('../models/Settings');
        const settings = await Settings.findOne().select('+googleCalendar.clientSecret');

        const googleConfig = settings?.googleCalendar;

        const clientId = googleConfig?.clientId;
        const clientSecret = googleConfig?.clientSecret;
        const redirectUri = googleConfig?.redirectUri || config.GOOGLE_REDIRECT_URI;

        if (!clientId || !clientSecret) {
            throw new Error('Google Calendar credentials not configured.');
        }

        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );

        const { tokens } = await oauth2Client.getToken(code);
        const User = require('../models/User');

        // Build the update object
        const updateData = {
            googleCalendarConnected: true  // Always mark as connected on manual connect
        };

        if (tokens.refresh_token) {
            updateData.googleRefreshToken = tokens.refresh_token;
            console.log('[Calendar Callback] New refresh token stored for user:', userId);
        } else {
            console.warn('[Calendar Callback] No refresh token in response. User may need to revoke access and reconnect.');
        }

        // Try to get the user's Google email from the ID token if provided
        if (tokens.id_token) {
            try {
                const ticket = await oauth2Client.verifyIdToken({
                    idToken: tokens.id_token,
                    audience: clientId
                });
                const payload = ticket.getPayload();
                if (payload?.email) {
                    updateData.googleEmail = payload.email.toLowerCase();
                }
            } catch (idTokenErr) {
                console.warn('[Calendar Callback] Could not decode id_token for email:', idTokenErr.message);
                // Not critical — just means email won't be updated
            }
        }

        await User.findByIdAndUpdate(userId, updateData);
        console.log('[Calendar Callback] User', userId, 'calendar connected. Fields updated:', Object.keys(updateData).join(', '));

        // Retroactively sync all existing unsynced reminders
        const { syncAllReminders } = require('../services/googleCalendarService');
        syncAllReminders(userId).catch(err => console.error('[Calendar Callback] Background sync failed:', err));

        res.send(`

            <html>
                <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0;">
                    <div style="text-align: center; background: #1e293b; padding: 3rem; border-radius: 24px;">
                        <h2 style="color: white; margin: 0 0 1rem;">Connected!</h2>
                        <p style="color: #94a3b8; margin-bottom: 2rem;">Your Google Calendar is now successfully linked.</p>
                        <script>
                            if (window.opener) window.opener.postMessage("GOOGLE_AUTH_SUCCESS", "*");
                            setTimeout(() => { window.close(); }, 3000);
                        </script>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error("Callback Error:", error);
        res.status(500).send("Authentication failed.");
    }
};

exports.getTravelStats = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.query;

        const reminder = await Reminder.findById(id);
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        const user = await User.findById(req.user._id);

        let origin;
        if (lat && lng) {
            origin = { lat: parseFloat(lat), lng: parseFloat(lng) };
        } else {
            if (!user || !user.currentLocation?.lat || !user.currentLocation?.lng) {
                return res.status(400).json({ success: false, message: 'User location not available' });
            }
            origin = user.currentLocation;
        }

        const { getTrafficAwareTravelTime, geocodeAddress } = require('../services/smartReminderService');
        let destCoords = reminder.coordinates;

        // AUTO-GEOCODE: If coordinates missing but location name exists, try to geocode on the fly
        if ((!destCoords?.lat || !destCoords?.lng) && reminder.location) {
            console.log(`[ReminderController] Geocoding missing destination for stats: "${reminder.location}"`);
            const coords = await geocodeAddress(reminder.location, origin);
            if (coords) {
                destCoords = coords;
                await Reminder.findByIdAndUpdate(id, { coordinates: coords });
            }
        }

        if (!destCoords?.lat || !destCoords?.lng) {
            return res.status(400).json({ success: false, message: 'Reminder location coordinates not found or could not be resolved' });
        }

        // SANITY CHECK: If origin is >1000km from destination (e.g. emulator GPS = San Francisco),
        // fall back to user's stored currentLocation which is the real location.
        const haversineKm = (a, b) => {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
        };

        const distanceKm = haversineKm(origin, destCoords);
        if (distanceKm > 1000 && user?.currentLocation?.lat && user?.currentLocation?.lng) {
            console.log(`[TravelStats] Origin is ${distanceKm.toFixed(0)}km away — likely bad GPS. Falling back to stored user location.`);
            origin = user.currentLocation;
        }

        const stats = await getTrafficAwareTravelTime(origin, destCoords);

        // ─── Augment with Adjusted Notification Time ──────────────────────────
        let adjustedNotificationTime = null;
        let totalPrepareTime = null;
        if (reminder.time) {
            const bufferMin = reminder.bufferTime || 5;
            // durationInTraffic is in seconds; convert to whole minutes
            const travelMin = stats?.durationInTraffic ? Math.ceil(stats.durationInTraffic / 60) : 0;
            const user = await User.findById(req.user._id).select('timeFormat');
            const timeFormat = user?.timeFormat === '24' ? '24' : '12';
            const adj = calcAdjustedNotification(reminder.time, travelMin, bufferMin, timeFormat);
            if (adj) {
                adjustedNotificationTime = adj.adjustedTime;
                totalPrepareTime = adj.totalPrepare;
            }
        }

        res.status(200).json({
            success: true,
            data: {
                ...stats,
                adjusted_notification_time: adjustedNotificationTime,
                total_prepare_time: totalPrepareTime
            },
            resolvedCoordinates: destCoords
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get reminder counts per day for calendar view
 * @route   GET /api/reminders/calendar-stats
 * @access  Private
 */
exports.getCalendarStats = async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const { start, end } = req.query;

        const query = {
            $or: [
                { userId },
                { 'sharedWith.user': userId },
                { assignedTo: userId }
            ]
        };

        if (start && end) {
            query.date = { $gte: start, $lte: end };
        }

        // Aggregate from both collections
        const [stdStats, locStats] = await Promise.all([
            Reminder.aggregate([
                { $match: query },
                { $group: { _id: "$date", count: { $sum: 1 } } }
            ]),
            LocationReminder.aggregate([
                { $match: query },
                { $group: { _id: "$date", count: { $sum: 1 } } }
            ])
        ]);

        const formattedData = {};
        
        // Merge standard reminders
        stdStats.forEach(item => {
            if (item._id) formattedData[item._id] = (formattedData[item._id] || 0) + item.count;
        });

        // Merge location reminders
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
