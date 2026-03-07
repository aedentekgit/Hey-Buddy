const config = require('../config/env');
const Reminder = require('../models/Reminder');
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

exports.getReminders = async (req, res) => {
    try {
        const query = {
            $or: [
                { userId: req.user._id },
                { 'sharedWith.user': req.user._id },
                { assignedTo: req.user._id }
            ]
        };
        const results = await paginate(Reminder, query, req.query);

        // Populate creator and share details
        results.data = await Reminder.populate(results.data, [
            { path: 'userId', select: 'name email' },
            { path: 'sharedWith.user', select: 'name email' }
        ]);

        res.status(200).json({ success: true, ...results });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createReminder = async (req, res) => {
    try {
        const {
            title, description, date, time, location, intent, priority,
            bufferTime, alerts, smartFeatures, syncToGoogle,
            coordinates, geofenceRadius
        } = req.body;

        if (!title || !date || !time) {
            return res.status(400).json({ success: false, message: 'Title, date, and time are required' });
        }

        const userId = req.user._id;
        let googleEventId = null;

        // Sync to Google if connected
        if (req.user.googleRefreshToken) {
            try {
                googleEventId = await createGoogleCalendarEvent(userId, { title, date, time, location, description });
                console.log("[ReminderController] Automatic Google Sync Success:", googleEventId);
            } catch (calError) {
                console.error("Google Sync Failed during Create:", calError.message);
            }
        }

        const reminder = await Reminder.create({
            userId,
            title,
            description,
            date,
            time,
            location,
            coordinates,
            geofenceRadius: geofenceRadius || 500,
            intent: intent || 'generic',
            priority: priority || 'medium',
            bufferTime: bufferTime || 0,
            alerts: alerts || { push: true, sms: false, email: false },
            smartFeatures: smartFeatures || { earlyWarning: false, trafficAware: false, itemExitGuards: false },
            googleEventId,
            source: googleEventId ? 'google' : 'buddy'
        });

        res.status(201).json({ success: true, data: reminder });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateReminder = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id } = req.params;
        const updateData = req.body;

        const reminder = await Reminder.findOne({ _id: id, userId });
        if (!reminder) {
            return res.status(404).json({ success: false, message: 'Reminder not found' });
        }

        // Sync to Google if connected
        let googleEventId = reminder.googleEventId;
        if (req.user.googleRefreshToken) {
            try {
                const mergedData = { ...reminder.toObject(), ...updateData };
                if (googleEventId) {
                    await updateGoogleCalendarEvent(userId, googleEventId, mergedData);
                } else {
                    googleEventId = await createGoogleCalendarEvent(userId, mergedData);
                    updateData.googleEventId = googleEventId;
                    updateData.source = 'google';
                }
            } catch (calError) {
                console.error("Google Sync Failed during Update:", calError.message);
            }
        }

        const updatedReminder = await Reminder.findByIdAndUpdate(id, updateData, { new: true });

        res.status(200).json({ success: true, data: updatedReminder });
    } catch (error) {
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
                await deleteGoogleCalendarEvent(userId, reminder.googleEventId);
            } catch (calError) {
                console.error("Google Sync Failed during Delete:", calError.message);
            }
        }

        await Reminder.findByIdAndDelete(id);

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
        const updateData = {};
        if (tokens.refresh_token) updateData.googleRefreshToken = tokens.refresh_token;

        await User.findByIdAndUpdate(userId, updateData);

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

        let origin;
        if (lat && lng) {
            origin = { lat: parseFloat(lat), lng: parseFloat(lng) };
        } else {
            const user = await User.findById(req.user._id);
            if (!user || !user.currentLocation?.lat || !user.currentLocation?.lng) {
                return res.status(400).json({ success: false, message: 'User location not available' });
            }
            origin = user.currentLocation;
        }

        if (!reminder.coordinates?.lat || !reminder.coordinates?.lng) {
            return res.status(400).json({ success: false, message: 'Reminder location coordinates not found' });
        }

        const { getTrafficAwareTravelTime } = require('../services/smartReminderService');
        const stats = await getTrafficAwareTravelTime(origin, reminder.coordinates);

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
