const Notification = require('../models/Notification');
const { sendPushNotification } = require('../services/notificationService');

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.sendTestNotification = async (req, res) => {
    try {
        const user = req.user;
        if (!user.fcmTokens || user.fcmTokens.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No device tokens registered. Please enable notifications in your browser."
            });
        }

        console.log(`[Test] Sending notification to ${user.name}`);
        const promises = user.fcmTokens.map(token =>
            sendPushNotification(
                token,
                "Buddy AI: Test Alert 🔔",
                "This is a successfull result! Your browser notifications are working perfectly.",
                { type: 'test' }
            ).catch(e => console.error(`[Test] Failed for token: ${token}`, e.message))
        );

        await Promise.all(promises);

        res.status(200).json({ success: true, message: "Test notification sent to your device!" });
    } catch (error) {
        console.error("Test Notification Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, read: false },
            { read: true }
        );

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
