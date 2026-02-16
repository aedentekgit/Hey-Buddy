const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');

const startReminderWorker = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            console.log('Checking reminders (Timezone Aware)...');

            // Find all pending reminders that haven't been notified
            const pendingReminders = await Reminder.find({
                status: 'pending',
                notified: false
            }).populate('userId');

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
                const [rYear, rMonth, rDay] = reminder.date.split('-').map(Number);

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
                const isToday = (rYear === userYear && rMonth === userMonth && rDay === userDay);
                const isPastDueCurrentDay = isToday && (reminderTargetMinutes <= userNowMinutes);
                const isOverduePastDay = (rYear < userYear) || (rYear === userYear && rMonth < userMonth) || (rYear === userYear && rMonth === userMonth && rDay < userDay);

                if (isPastDueCurrentDay || isOverduePastDay) {
                    // Check if this reminder has push alerts enabled
                    if (reminder.alerts && !reminder.alerts.push) {
                        console.log(`[Worker] Skipping "${reminder.title}" - push disabled.`);
                        reminder.notified = true;
                        await reminder.save();
                        continue;
                    }

                    if (user.fcmTokens && user.fcmTokens.length > 0) {
                        console.log(`[Worker] Sending: "${reminder.title}" to ${user.name} (${userTimezone})`);

                        const notificationPromises = user.fcmTokens.map(token =>
                            sendPushNotification(
                                token,
                                `Buddy Reminder: ${reminder.intent ? reminder.intent.toUpperCase() : 'ALERT'}`,
                                reminder.title,
                                {
                                    reminderId: reminder._id.toString(),
                                    type: 'reminder_alert',
                                    intent: reminder.intent || 'generic'
                                }
                            ).catch(err => console.error(`[Worker] Push failed for ${user.name}:`, err.message))
                        );

                        await Promise.all(notificationPromises);
                    } else {
                        console.warn(`[Worker] User ${user.name} has no FCM tokens registered.`);
                    }

                    // Mark as notified to ensure it's only sent once
                    reminder.notified = true;
                    await reminder.save();
                    console.log(`[Worker] Done: "${reminder.title}"`);
                }
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker };
