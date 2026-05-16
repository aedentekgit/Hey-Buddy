const Reminder = require('../../models/Reminder');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { sendPushNotification } = require('../../services/notificationService');
const { sendEmail } = require('../../services/emailService');
const { triggerVectorReload } = require('./helpers');

// ─── Share Reminder ────────────────────────────────────────────────────────────
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

        // 1. Notify via Database
        await Notification.create({
            userId: targetUser._id,
            title: 'New Shared Reminder',
            message: shareMessage,
            type: 'reminder',
            relatedId: reminder._id,
            onModel: 'Reminder',
            actionUrl: '/admin/reminders'
        });

        // 2. Push notification via FCM
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

        // 3. Email
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
        }

        triggerVectorReload();

        res.status(200).json({ success: true, message: 'Reminder shared successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Unshare Reminder ─────────────────────────────────────────────────────────
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
            if (!s.user) return false;
            return s.user.toString() !== userId;
        });

        if (reminder.sharedWith.length === initialCount) {
            // Maybe the userId passed was actually a subdocument _id
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

        triggerVectorReload();

        res.status(200).json({ success: true, message: 'User removed from shared list' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};