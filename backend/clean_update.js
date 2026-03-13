const Reminder = require('../models/Reminder');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');

// Helper to append overdue status
function appendOverdueStatus(r) {
    if (!r) return r;
    const isArray = Array.isArray(r);
    const records = isArray ? r : [r];
    const now = new Date();

    const augmented = records.map(item => {
        let isOverdue = false;
        if (item.date && item.time) {
            let reminderHour = 0;
            let reminderMin = 0;
            const timeStr = item.time || '00:00';
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

            const reminderDateTime = new Date(item.date);
            reminderDateTime.setHours(reminderHour, reminderMin, 0, 0);
            if (reminderDateTime < now) isOverdue = true;
        }

        const obj = typeof item.toObject === 'function' ? item.toObject() : item;
        return { ...obj, isOverdue };
    });

    return isArray ? augmented : augmented[0];
}

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

        // Capture previous collaborators for diffing
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

        // Explicitly handle sharedWith assignment
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
                                    reminderId: updatedReminder._id
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

        res.status(200).json({ success: true, data: appendOverdueStatus(fullyPopulated) });

    } catch (error) {
        console.error('[ReminderController] Update Global Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
