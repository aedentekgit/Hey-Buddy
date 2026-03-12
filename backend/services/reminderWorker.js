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

// Settings cache with 5-minute TTL
let settingsCache = null;
let settingsCacheTime = null;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedSettings = async () => {
    const now = Date.now();
    if (!settingsCache || !settingsCacheTime || (now - settingsCacheTime) > SETTINGS_CACHE_TTL) {
        settingsCache = await Settings.findOne();
        settingsCacheTime = now;
    }
    return settingsCache;
};

const triggerNotification = async (reminder, user, io) => {
    console.log(`[Worker] Triggering notification for reminder: ${reminder.title} (User: ${user.email})`);
    // 1. Create Internal Notification & Emit (if In-App enabled)
    let notification = null;
    if (user.notificationPreferences?.inApp?.enabled !== false) {
        const formattedDate = reminder.date ? reminder.date.split('-').reverse().join('/') : ''; // DD/MM/YYYY
        notification = await Notification.create({
            userId: user._id,
            title: `Reminder: ${reminder.intent ? reminder.intent.toUpperCase() : 'ALERT'}`,
            message: `${reminder.title} - Set for ${formattedDate} at ${reminder.time}`,
            type: 'reminder',
            relatedId: reminder._id,
            onModel: 'Reminder',
            actionUrl: '/admin/reminders'
        });

        if (io) {
            io.to(user._id.toString()).emit('notification', notification);
            console.log(`[Worker] Emitted real-time notification to user: ${user._id}`);

            if (user.notificationPreferences?.voice?.enabled !== false) {
                const voiceAlertStr = `Pardon the interruption, but I have a reminder for you: ${reminder.title}.`;
                io.to(user._id.toString()).emit('voice_alert', {
                    text: voiceAlertStr,
                    gender: user.voicePreferences?.gender || 'female',
                    tone: user.voicePreferences?.tone || 'soft'
                });
            }
        }
    }

    // 2. Trigger AI Assistant Voice Reminder (REMOVED: Now handled by global voice_alert)
    // if (user.notificationPreferences?.voice?.enabled !== false) {
    //     const activeAgent = findAgentByUserId(user._id.toString());
    //     if (activeAgent) {
    //         const voiceMessage = `[SYSTEM NOTIFICATION]: A scheduled reminder just triggered. Please immediately announce to the user out loud exactly this: "Pardon the interruption, but I have a reminder for you: ${reminder.title}." Do not add any conversational filler.`;
    //         activeAgent.say(voiceMessage);
    //     }
    // }

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
            await Promise.allSettled(notificationPromises);

            if (tokensToRemove.length > 0) {
                await User.findByIdAndUpdate(user._id, {
                    $pull: { fcmTokens: { $in: tokensToRemove } }
                });
            }
        }
    }

    // 4. Send SMS Notifications
    if (reminder.alerts?.sms !== false && user.notificationPreferences?.sms?.enabled !== false && user.phone) {
        try {
            const settings = await getCachedSettings();
            if (settings?.sms?.enabled) {
                console.log(`[Worker] Sending SMS reminder to ${user.phone}`);
                await sendTestSMS(settings.sms, user.phone);
            }
        } catch (err) {
            console.error(`[Worker] SMS failed: ${err.message}`);
        }
    }

    // 5. Send Email Notifications
    if (reminder.alerts?.email !== false && user.notificationPreferences?.email?.enabled !== false && user.email) {
        try {
            console.log(`[Worker] Sending Email reminder to ${user.email}`);
            await sendEmail({
                to: user.email,
                subject: `Reminder: ${reminder.title}`,
                text: `Hello ${user.name},\n\nThis is a reminder for: ${reminder.title}\n\nTime: ${reminder.time}\nDate: ${reminder.date}\nNotes: ${reminder.notes || 'None'}`,
                html: `<div style="font-family: sans-serif; padding: 20px;">
                    <h2>Reminder Alert</h2>
                    <p><strong>Title:</strong> ${reminder.title}</p>
                    <p><strong>Time:</strong> ${reminder.time}</p>
                    <p><strong>Date:</strong> ${reminder.date}</p>
                    ${reminder.notes ? `<p><strong>Notes:</strong> ${reminder.notes}</p>` : ''}
                    <hr />
                    <p>Sent via Buddy AI Assistant</p>
                </div>`
            });
        } catch (err) {
            console.error(`[Worker] Email failed: ${err.message}`);
        }
    }
};

const notifyBackupContacts = async (reminder, user, io) => {
    if (!reminder.backupContacts || reminder.backupContacts.length === 0) return;

    const message = `URGENT: ${user.name} has an unacknowledged reminder: "${reminder.title}". Please check on them.`;

    for (const contact of reminder.backupContacts) {
        console.log(`[Worker] Escalating to backup contact ${contact.name} (${contact.phone})`);

        // SMS
        if (contact.phone) {
            try {
                const settings = await getCachedSettings();
                if (settings?.sms?.enabled) {
                    await sendTestSMS(settings.sms, contact.phone); // Re-using sendTestSMS logic for now if no generic sendSMS
                }
            } catch (err) {
                console.error(`[Worker] Backup SMS failed: ${err.message}`);
            }
        }

        // Email (if we had email for backup contacts, but schema says name/phone only)

        // Voice announcement for backup contact alert
        if (user.notificationPreferences?.voice?.enabled !== false) {
            if (io) {
                io.to(user._id.toString()).emit('voice_alert', {
                    text: `Backup contact alert sent for reminder "${reminder.title}" to ${contact.name}.`,
                    gender: user.voicePreferences?.gender || 'female',
                    tone: user.voicePreferences?.tone || 'soft'
                });
            }
        }
    }
};

const startReminderWorker = (io) => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            console.log('--- [Reminder Worker] Checking Unified Reminders ---');

            // Find all pending reminders that haven't been notified
            const pendingReminders = await Reminder.find({
                status: 'pending',
                notified: false
            }).limit(500).populate('userId');

            if (pendingReminders.length === 0) return;

            for (let reminder of pendingReminders) {
                const user = reminder.userId;
                if (!user) continue;

                const userTimezone = user.timezone || 'UTC';
                const now = new Date();
                const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));

                let shouldTrigger = false;
                const type = reminder.reminderType || 'time';

                if (type === 'time') {
                    // --- TIME-BASED LOGIC ---
                    const userHour = userNow.getHours();
                    const userMinute = userNow.getMinutes();
                    const userNowMinutes = (userHour * 60) + userMinute;

                    // Parse Date (YYYY-MM-DD)
                    if (!reminder.date) continue;
                    const [rYear, rMonth, rDay] = reminder.date.split('-').map(Number);
                    const rMonthAdjusted = rMonth - 1;

                    // Parse Time
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
                    const adjustedTarget = reminderTargetMinutes - (reminder.bufferTime || 0);

                    const isToday = (rYear === userNow.getFullYear() && rMonthAdjusted === userNow.getMonth() && rDay === userNow.getDate());
                    const isPastDueCurrentDay = isToday && (adjustedTarget <= userNowMinutes);
                    const isOverduePastDay = (rYear < userNow.getFullYear()) ||
                        (rYear === userNow.getFullYear() && rMonthAdjusted < userNow.getMonth()) ||
                        (rYear === userNow.getFullYear() && rMonthAdjusted === userNow.getMonth() && rDay < userNow.getDate());

                    if (isPastDueCurrentDay || isOverduePastDay) {
                        shouldTrigger = true;
                    }
                } else if (type === 'location') {
                    // --- LOCATION-BASED LOGIC ---
                    if (reminder.coordinates?.lat && reminder.coordinates?.lng && user.currentLocation?.lat) {
                        const distance = calculateDistance(
                            user.currentLocation.lat, user.currentLocation.lng,
                            reminder.coordinates.lat, reminder.coordinates.lng
                        );
                        const radius = reminder.geofenceRadius || 500;
                        if (distance <= radius) {
                            shouldTrigger = true;
                            console.log(`[Worker] Location trigger: "${reminder.title}" at ${Math.round(distance)}m`);
                        }
                    }
                }

                if (shouldTrigger) {
                    console.log(`[Worker] TRIGGERING: "${reminder.title}" (Type: ${type}) for ${user.email}`);
                    await triggerNotification(reminder, user, io);

                    // Handle Family/Emergency notifications if enabled
                    if (reminder.alerts?.notifyFamily || reminder.alerts?.notifyEmergency) {
                        const Family = require('../models/Family');
                        const family = await Family.findById(user.familyId);
                        if (family) {
                            const message = `[Buddy Safety] Alert for ${user.name}: Reminder "${reminder.title}" triggered at location: ${reminder.location || 'Unknown'}.`;

                            // Notify Family Members
                            if (reminder.alerts.notifyFamily) {
                                for (const memberId of family.members) {
                                    if (memberId === user._id) continue;
                                    const member = await User.findById(memberId);
                                    if (member && member.fcmTokens) {
                                        member.fcmTokens.forEach(token =>
                                            sendPushNotification(token, 'Family Reminder Alert', message, { type: 'family_alert' })
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Update database
                    await Reminder.findByIdAndUpdate(reminder._id, { notified: true });
                }
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker, triggerNotification };
