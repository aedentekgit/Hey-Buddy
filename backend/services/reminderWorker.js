const cron = require('node-cron');
const Reminder = require('../models/Reminder');
const User = require('../models/User');
const { sendPushNotification } = require('./notificationService');

const startReminderWorker = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            const currentDate = now.toISOString().split('T')[0];
            const currentTime = now.toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit' });

            console.log(`Checking reminders for ${currentDate} ${currentTime}...`);

            // Find reminders due now or missed recently that haven't been notified
            // date: currentDate, time: <= currentTime ensures we catch missed ones
            const dueReminders = await Reminder.find({
                date: currentDate,
                time: { $lte: currentTime },
                status: 'pending',
                notified: false
            }).populate('userId');

            for (const reminder of dueReminders) {
                // Check if this reminder has push alerts enabled
                if (reminder.alerts && !reminder.alerts.push) {
                    console.log(`Skipping push for "${reminder.title}" - push alerts disabled.`);
                    reminder.notified = true;
                    await reminder.save();
                    continue;
                }

                const user = reminder.userId;
                if (user && user.fcmTokens && user.fcmTokens.length > 0) {
                    console.log(`[Worker] Sending notification to ${user.name} for: ${reminder.title}`);

                    const notificationPromises = user.fcmTokens.map(token =>
                        sendPushNotification(
                            token,
                            `Buddy Reminder: ${reminder.intent ? reminder.intent.toUpperCase() : 'TASK'}`,
                            reminder.title,
                            {
                                reminderId: reminder._id.toString(),
                                type: 'reminder_alert',
                                intent: reminder.intent || 'generic'
                            }
                        ).catch(err => console.error(`Failed to send to token ${token}:`, err.message))
                    );

                    await Promise.all(notificationPromises);
                } else {
                    console.log(`[Worker] No FCM tokens for user ${user?.name || 'Unknown'}`);
                }

                // Mark as notified even if some tokens failed
                reminder.notified = true;
                await reminder.save();
                console.log(`[Worker] Marked reminder "${reminder.title}" as notified.`);
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker };
