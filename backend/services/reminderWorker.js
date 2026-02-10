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

            // Find reminders due now that haven't been notified
            const dueReminders = await Reminder.find({
                date: currentDate,
                time: currentTime,
                status: 'pending',
                notified: false
            }).populate('userId');

            for (const reminder of dueReminders) {
                const user = reminder.userId;
                if (user && user.fcmTokens && user.fcmTokens.length > 0) {
                    console.log(`Sending notification to ${user.name} for: ${reminder.title}`);

                    const notificationPromises = user.fcmTokens.map(token =>
                        sendPushNotification(
                            token,
                            `Buddy Reminder: ${reminder.intent.toUpperCase()}`,
                            reminder.title,
                            { reminderId: reminder._id.toString() }
                        ).catch(err => console.error(`Failed to send to token ${token}:`, err.message))
                    );

                    await Promise.all(notificationPromises);
                }

                // Mark as notified even if some tokens failed
                reminder.notified = true;
                await reminder.save();
            }
        } catch (error) {
            console.error("Reminder Worker Error:", error);
        }
    });
};

module.exports = { startReminderWorker };
