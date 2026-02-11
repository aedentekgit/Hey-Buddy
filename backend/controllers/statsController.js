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

exports.getDetailedAnalytics = async (req, res) => {
    try {
        const query = req.user.role === 'admin' ? {} : { userId: req.user._id };

        // 1. Completion Rate
        const totalCount = await Reminder.countDocuments(query);
        const completedCount = await Reminder.countDocuments({ ...query, status: 'completed' });
        const pendingCount = await Reminder.countDocuments({ ...query, status: 'pending' });
        const snoozedCount = await Reminder.countDocuments({ ...query, status: 'snoozed' });

        // 2. Intent Distribution
        const intents = ['meeting', 'medicine', 'pickup', 'bill', 'personal', 'generic'];
        const intentStats = await Promise.all(intents.map(async intent => ({
            name: intent,
            value: await Reminder.countDocuments({ ...query, intent })
        })));

        // 3. Priority Distribution
        const priorities = ['high', 'medium', 'low'];
        const priorityStats = await Promise.all(priorities.map(async priority => ({
            name: priority,
            value: await Reminder.countDocuments({ ...query, priority })
        })));

        // 4. Source Breakdown
        const googleCount = await Reminder.countDocuments({ ...query, googleEventId: { $ne: null } });
        const buddyCount = totalCount - googleCount;

        // 5. Activity Trends (Last 7 Days)
        const trends = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const start = new Date(date.setHours(0, 0, 0, 0));
            const end = new Date(date.setHours(23, 59, 59, 999));

            trends.push({
                date: start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                created: await Reminder.countDocuments({ ...query, createdAt: { $gte: start, $lte: end } }),
                completed: await Reminder.countDocuments({ ...query, status: 'completed', updatedAt: { $gte: start, $lte: end } })
            });
        }

        res.status(200).json({
            success: true,
            data: {
                summary: [
                    { label: 'Total Reminders', value: totalCount, icon: 'list', color: '#6366f1' },
                    { label: 'Completed', value: completedCount, icon: 'check', color: '#10b981' },
                    { label: 'Completion Rate', value: totalCount ? Math.round((completedCount / totalCount) * 100) + '%' : '0%', icon: 'trending-up', color: '#8b5cf6' },
                    { label: 'Google Synced', value: googleCount, icon: 'calendar', color: '#4285F4' }
                ],
                intentStats: intentStats.filter(s => s.value > 0),
                priorityStats,
                sourceStats: [
                    { name: 'Buddy AI', value: buddyCount },
                    { name: 'Google Calendar', value: googleCount }
                ],
                statusStats: [
                    { name: 'Completed', value: completedCount },
                    { name: 'Pending', value: pendingCount },
                    { name: 'Snoozed', value: snoozedCount }
                ],
                trends
            }
        });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch analytics" });
    }
};
