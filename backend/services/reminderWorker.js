const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');
const { findAgentByUserId } = require('../sockets/voiceHandler');
const { calculateDistance } = require('./smartReminderService');
const { sendEmail } = require('./emailService');
const { sendTestSMS } = require('./smsService');
const Settings = require('../models/Settings');

const triggerNotification = async (reminder, user, io) => {
    // 1. Create Internal Notification & Emit (if In-App enabled)
    let notification = null;
    if (user.notificationPreferences?.inApp?.enabled !== false) {
        notification = await Notification.create({
            userId: user._id,
            title: `Reminder: ${reminder.intent ? reminder.intent.toUpperCase() : 'ALERT'}`,
            message: reminder.title,
            type: 'reminder',
            relatedId: reminder._id,
            onModel: 'Reminder',
            actionUrl: '/admin/reminders'
        });

        if (io) {
            io.to(user._id.toString()).emit('notification', notification);
            console.log(`[Worker] Emitted real-time notification to user: ${user._id}`);
        }
    }

    // 2. Trigger AI Assistant Voice Reminder
    if (user.notificationPreferences?.voice?.enabled !== false) {
        const activeAgent = findAgentByUserId(user._id.toString());
        if (activeAgent) {
            const voiceMessage = `[SYSTEM NOTIFICATION]: A scheduled reminder just triggered. Please immediately announce to the user out loud exactly this: "Pardon the interruption, but I have a reminder for you: ${reminder.title}." Do not add any conversational filler.`;
            activeAgent.say(voiceMessage);
        }
    }

    // 3. Send Push Notifications
    if (reminder.alerts?.push !== false && user.notificationPreferences?.push?.enabled !== false) {
        if (user.fcmTokens && user.fcmTokens.length > 0) {
            const tokensToRemove = [];
            const notificationPromises = user.fcmTokens.map(token =>
                sendPushNotification(
                    token,
                    notification?.title || `Reminder: ${reminder.title}`,
                    notification?.message || reminder.title,
                    {
                        reminderId: reminder._id.toString(),
                        type: 'reminder_alert',
                        notificationId: notification?._id.toString() || ''
                    }
                ).catch(err => {
                    if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token') {
                        tokensToRemove.push(token);
                    }
                })
            );
            await Promise.all(notificationPromises);

            if (tokensToRemove.length > 0) {
                await User.findByIdAndUpdate(user._id, {
                    $pull: { fcmTokens: { $in: tokensToRemove } }
                });
            }
        }
    }
};

const notifyBackupContacts = async (reminder, user) => {
    if (!reminder.backupContacts || reminder.backupContacts.length === 0) return;

    const message = `URGENT: ${user.name} has an unacknowledged reminder: "${reminder.title}". Please check on them.`;

    for (const contact of reminder.backupContacts) {
        console.log(`[Worker] Escalating to backup contact ${contact.name} (${contact.phone})`);

        // SMS
        if (contact.phone) {
            try {
                const settings = await Settings.findOne();
                if (settings?.sms?.enabled) {
                    await sendTestSMS(settings.sms, contact.phone); // Re-using sendTestSMS logic for now if no generic sendSMS
                }
            } catch (err) {
                console.error(`[Worker] Backup SMS failed: ${err.message}`);
            }
        }

        // Email (if we had email for backup contacts, but schema says name/phone only)
    }
};

const startReminderWorker = (io) => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            console.log('--- [Reminder Worker] Checking Reminders ---');

            // Find all pending reminders that haven't been notified
            const pendingReminders = await Reminder.find({
                status: 'pending',
                notified: false
            }).populate('userId');

            if (pendingReminders.length === 0) return;

            for (const reminder of pendingReminders) {
                const user = reminder.userId;
                if (!user) continue;

                // Get User's Timezone (default to UTC if missing)
                const userTimezone = user.timezone || 'UTC';

                // Get Current Time in User's Timezone
                const now = new Date();

                // Get User local date components for robust comparison
                const userYear = parseInt(now.toLocaleDateString('en-CA', { timeZone: userTimezone, year: 'numeric' }));
                const userMonth = parseInt(now.toLocaleDateString('en-CA', { timeZone: userTimezone, month: 'numeric' })) - 1;
                const userDay = parseInt(now.toLocaleDateString('en-CA', { timeZone: userTimezone, day: 'numeric' }));
                const userHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, hour: '2-digit', hour12: false }));
                const userMinute = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, minute: '2-digit' }));

                const userNowMinutes = (userHour * 60) + userMinute;

                // Parse Reminder Date (YYYY-MM-DD)
                if (!reminder.date) continue;
                const dateParts = reminder.date.split('-');
                if (dateParts.length !== 3) continue;
                const [rYear, rMonth, rDay] = dateParts.map(Number);
                const rMonthAdjusted = rMonth - 1;

                // Parse Reminder Time
                let rHour, rMin;
                const timeStr = reminder.time || '00:00';
                const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

                if (ampmMatch) {
                    rHour = parseInt(ampmMatch[1]);
                    rMin = parseInt(ampmMatch[2]);
                    const period = ampmMatch[3].toLowerCase();
                    if (period === 'pm' && rHour < 12) rHour += 12;
                    if (period === 'am' && rHour === 12) rHour = 0;
                } else {
                    const parts = timeStr.split(':');
                    rHour = parseInt(parts[0]);
                    rMin = parseInt(parts[1]) || 0;
                }

                const reminderTargetMinutes = (rHour * 60) + rMin;
                const adjustedReminderTargetMinutes = reminderTargetMinutes - (reminder.bufferTime || 0);

                // Check if Date matches
                const isToday = (rYear === userYear && rMonthAdjusted === userMonth && rDay === userDay);
                const isPastDueCurrentDay = isToday && (adjustedReminderTargetMinutes <= userNowMinutes);
                const isOverduePastDay = (rYear < userYear) || (rYear === userYear && rMonthAdjusted < userMonth) || (rYear === userYear && rMonthAdjusted === userMonth && rDay < userDay);

                let locationMatch = true;
                // If it's a PURE location reminder (no time set), then geofence is mandatory.
                // If it HAS a time, the location is a destination, so we trigger on time regardless.
                if (!reminder.time && reminder.coordinates && reminder.coordinates.lat && reminder.coordinates.lng && reminder.geofenceRadius) {
                    locationMatch = false;
                    if (user.currentLocation && user.currentLocation.lat && user.currentLocation.lng) {
                        const distance = calculateDistance(
                            user.currentLocation.lat, user.currentLocation.lng,
                            reminder.coordinates.lat, reminder.coordinates.lng
                        );
                        if (distance <= reminder.geofenceRadius) {
                            locationMatch = true;
                            console.log(`[Worker] Geofence reached for "${reminder.title}" (${Math.round(distance)}m <= ${reminder.geofenceRadius}m)`);
                        }
                    }
                }

                if ((isPastDueCurrentDay || isOverduePastDay) && locationMatch) {
                    console.log(`[Worker] TRIGGERED: "${reminder.title}" for ${user.name}`);
                    await triggerNotification(reminder, user, io);
                    reminder.notified = true;
                    await reminder.save();
                }
            }

            // --- ESCALATION CHECK ---
            // Find non-completed reminders that were notified but not acknowledged (stayed pending)
            // and have reached their escalation time
            const escalationPending = await Reminder.find({
                status: 'pending',
                notified: true,
                escalated: { $ne: true },
                backupContacts: { $exists: true, $ne: [] }
            }).populate('userId');

            for (const reminder of escalationPending) {
                const user = reminder.userId;
                if (!user) continue;

                const userTimezone = user.timezone || 'UTC';
                const now = new Date();

                // Get robust user local time components
                const userHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, hour: '2-digit', hour12: false }));
                const userMinute = parseInt(now.toLocaleTimeString('en-GB', { timeZone: userTimezone, minute: '2-digit' }));
                const userNowMinutes = (userHour * 60) + userMinute;

                // Parse Reminder Time
                let rHour, rMin;
                const timeStr = reminder.time || '00:00';
                const ampmMatch = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);

                if (ampmMatch) {
                    rHour = parseInt(ampmMatch[1]);
                    rMin = parseInt(ampmMatch[2]);
                    const period = ampmMatch[3].toLowerCase();
                    if (period === 'pm' && rHour < 12) rHour += 12;
                    if (period === 'am' && rHour === 12) rHour = 0;
                } else {
                    const parts = timeStr.split(':');
                    rHour = parseInt(parts[0]);
                    rMin = parseInt(parts[1]) || 0;
                }
                const reminderTargetMinutes = (rHour * 60) + rMin;

                const minutesPassed = userNowMinutes - reminderTargetMinutes;

                if (minutesPassed >= (reminder.escalationTime || 0)) {
                    await notifyBackupContacts(reminder, user);
                    reminder.escalated = true;
                    await reminder.save();
                }
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker };
