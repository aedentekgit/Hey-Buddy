const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const { google } = require('googleapis');
const User = require('../models/User');
const { sendPushNotification } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');

exports.getReminders = async (req, res) => {
    try {
        const reminders = await Reminder.find({
            $or: [
                { userId: req.user._id },
                { 'sharedWith.user': req.user._id },
                { assignedTo: req.user._id }
            ]
        }).sort({ date: 1 }).populate('userId', 'name email').populate('assignedTo', 'name email');
        res.status(200).json({ success: true, data: reminders });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createReminder = async (req, res) => {
    try {
        const { title, description, date, time, location, syncToGoogle } = req.body;

        const reminder = await Reminder.create({
            userId: req.user._id,
            title,
            description,
            date,
            time,
            location,
            source: 'buddy'
        });

        // Sync to Google if requested
        if (syncToGoogle && req.user.googleRefreshToken) {
            reminder.googleEventId = 'pending_sync';
            await reminder.save();
        }

        // Create notification
        await Notification.create({
            userId: req.user._id,
            title: 'New Reminder Created',
            message: `Reminder "${title}" set for ${new Date(date).toLocaleDateString()} at ${time}`,
            type: 'reminder',
            relatedId: reminder._id,
            onModel: 'Reminder'
        });

        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );

        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        res.status(200).json({ success: true, data: reminder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteReminder = async (req, res) => {
    try {
        const reminder = await Reminder.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        res.status(200).json({ success: true, message: 'Reminder deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.batchDeleteReminders = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ success: false, message: 'Invalid IDs' });
        }

        await Reminder.deleteMany({
            _id: { $in: ids },
            userId: req.user._id
        });

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

        // Remove user from sharedWith array
        reminder.sharedWith = reminder.sharedWith.filter(s => s.user.toString() !== userId);
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

        res.status(200).json({ success: true, message: 'User removed from shared list' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
