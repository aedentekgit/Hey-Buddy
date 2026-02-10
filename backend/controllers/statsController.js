const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Role = require('../models/Role');

exports.getDashboardStats = async (req, res) => {
    try {
        let totalUsers, totalReminders, totalRoles, googleLinkedUsers, chartData, recentReminders;

        if (req.user.role === 'admin') {
            totalUsers = await User.countDocuments();
            totalReminders = await Reminder.countDocuments();
            totalRoles = await Role.countDocuments();
            googleLinkedUsers = await User.countDocuments({ googleRefreshToken: { $ne: null } });

            chartData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                const endOfDay = new Date(date.setHours(23, 59, 59, 999));
                const count = await Reminder.countDocuments({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
                chartData.push({ date: startOfDay.toLocaleDateString('en-IN', { weekday: 'short' }), count });
            }

            recentReminders = await Reminder.find().sort({ createdAt: -1 }).limit(5).populate('userId', 'name email');
        } else {
            totalReminders = await Reminder.countDocuments({ userId: req.user._id });
            const user = await User.findById(req.user._id);
            googleLinkedUsers = user.googleRefreshToken ? 1 : 0;
            totalUsers = 1;
            totalRoles = 1;

            chartData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                const endOfDay = new Date(date.setHours(23, 59, 59, 999));
                const count = await Reminder.countDocuments({ userId: req.user._id, createdAt: { $gte: startOfDay, $lte: endOfDay } });
                chartData.push({ date: startOfDay.toLocaleDateString('en-IN', { weekday: 'short' }), count });
            }
            recentReminders = await Reminder.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5);
        }

        res.status(200).json({
            success: true,
            data: {
                stats: [
                    { label: req.user.role === 'admin' ? 'Total Users' : 'Profile Status', value: req.user.role === 'admin' ? totalUsers : 'Active', icon: 'users', color: '#6366f1' },
                    { label: req.user.role === 'admin' ? 'Total Reminders' : 'My Reminders', value: totalReminders, icon: 'mic', color: '#8b5cf6' },
                    { label: req.user.role === 'admin' ? 'Active Roles' : 'System Guard', value: req.user.role === 'admin' ? totalRoles : 'Protected', icon: 'shield', color: '#10b981' },
                    { label: 'Google Linked', value: googleLinkedUsers > 0 ? 'Linked' : 'Not Linked', icon: 'calendar', color: '#f59e0b' }
                ],
                chartData,
                recentReminders
            }
        });
    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch dashboard stats" });
    }
};
