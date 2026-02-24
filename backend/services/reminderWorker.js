const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');
const { findAgentByUserId } = require('../sockets/voiceHandler');

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
                    rMin = parseInt(parts[1]);
                }

                const reminderTargetMinutes = (rHour * 60) + rMin;

                // Check if Date matches
                const isToday = (rYear === userYear && rMonthAdjusted === userMonth && rDay === userDay);
                const isPastDueCurrentDay = isToday && (reminderTargetMinutes <= userNowMinutes);
                const isOverduePastDay = (rYear < userYear) || (rYear === userYear && rMonthAdjusted < userMonth) || (rYear === userYear && rMonthAdjusted === userMonth && rDay < userDay);

                if (isPastDueCurrentDay || isOverduePastDay) {
                    console.log(`[Worker] TRIGGERED: "${reminder.title}" for ${user.name}`);

                    // 1. Create Internal Notification (for Bell Icon)
                    const notification = await Notification.create({
                        userId: user._id,
                        title: `Reminder: ${reminder.intent ? reminder.intent.toUpperCase() : 'ALERT'}`,
                        message: reminder.title,
                        type: 'reminder',
                        relatedId: reminder._id,
                        onModel: 'Reminder',
                        actionUrl: '/admin/reminders'
                    });

                    // 2. Clear real-time update to Frontend Bell Icon
                    if (io) {
                        io.to(user._id.toString()).emit('notification', notification);
                        console.log(`[Worker] Emitted real-time notification to user: ${user._id}`);
                    }

                    // 3. Trigger AI Assistant Voice Reminder (if session active)
                    const activeAgent = findAgentByUserId(user._id.toString());
                    if (activeAgent) {
                        const voiceMessage = `Pardon the interruption, but I have a reminder for you: ${reminder.title}.`;
                        activeAgent.say(voiceMessage);
                        console.log(`[Worker] Triggered AI Voice-over for session: ${activeAgent.socket.id}`);
                    }

                    // 4. Send Push Notifications (Firebase)
                    if (reminder.alerts?.push !== false) {
                        if (user.fcmTokens && user.fcmTokens.length > 0) {
                            const notificationPromises = user.fcmTokens.map(token =>
                                sendPushNotification(
                                    token,
                                    notification.title,
                                    notification.message,
                                    {
                                        reminderId: reminder._id.toString(),
                                        type: 'reminder_alert',
                                        notificationId: notification._id.toString()
                                    }
                                ).catch(err => console.error(`[Worker] Push fail:`, err.message))
                            );
                            await Promise.all(notificationPromises);
                        }
                    }

                    // Mark as notified
                    reminder.notified = true;
                    await reminder.save();
                }
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker };
