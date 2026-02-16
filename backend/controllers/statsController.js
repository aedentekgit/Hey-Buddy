const User = require('../models/User');
const Reminder = require('../models/Reminder');
const Role = require('../models/Role');

exports.getDashboardStats = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const userId = req.user._id;

        // Date range for chart (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // 1. Basic Counts using Facets (Wait for them in parallel or use separate calls if needed, but aggregation is best)
        const statsPromises = [];

        if (isAdmin) {
            statsPromises.push(User.countDocuments());
            statsPromises.push(Reminder.countDocuments());
            statsPromises.push(Role.countDocuments());
            statsPromises.push(User.countDocuments({ googleRefreshToken: { $ne: null } }));
        } else {
            statsPromises.push(Promise.resolve(1)); // Dummy for total users
            statsPromises.push(Reminder.countDocuments({ userId }));
            statsPromises.push(Promise.resolve(1)); // Dummy for total roles
            statsPromises.push(User.findById(userId).then(u => u.googleRefreshToken ? 1 : 0));
        }

        // 2. Chart Data using Aggregation (Single query for all 7 days)
        const matchQuery = isAdmin ? { createdAt: { $gte: sevenDaysAgo } } : { userId, createdAt: { $gte: sevenDaysAgo } };

        const chartDataPromise = Reminder.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        // 3. Recent Reminders
        const recentQuery = isAdmin ? {} : { userId };
        const recentRemindersPromise = Reminder.find(recentQuery)
            .sort({ createdAt: -1 })
            .limit(5)
            .populate(isAdmin ? { path: 'userId', select: 'name email' } : []);

        // Execute all in parallel
        const [totalUsers, totalReminders, totalRoles, googleLinkedUsers, rawChartData, recentReminders] =
            await Promise.all([...statsPromises, chartDataPromise, recentRemindersPromise]);

        // Process Chart Data to ensure all 7 days are present
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short' });

            const existing = rawChartData.find(item => item._id === dateStr);
            chartData.push({
                date: dayLabel,
                count: existing ? existing.count : 0
            });
        }

        res.status(200).json({
            success: true,
            data: {
                stats: [
                    { label: isAdmin ? 'Total Users' : 'Profile Status', value: isAdmin ? totalUsers : 'Active', icon: 'users', color: '#6366f1' },
                    { label: isAdmin ? 'Total Reminders' : 'My Reminders', value: totalReminders, icon: 'mic', color: '#8b5cf6' },
                    { label: isAdmin ? 'Active Roles' : 'System Guard', value: isAdmin ? totalRoles : 'Protected', icon: 'shield', color: '#10b981' },
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
        const isAdmin = req.user.role === 'admin';
        const userId = req.user._id;
        const matchQuery = isAdmin ? {} : { userId };

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const aggregation = await Reminder.aggregate([
            { $match: matchQuery },
            {
                $facet: {
                    statusStats: [
                        { $group: { _id: "$status", value: { $sum: 1 } } }
                    ],
                    intentStats: [
                        { $group: { _id: "$intent", value: { $sum: 1 } } }
                    ],
                    priorityStats: [
                        { $group: { _id: "$priority", value: { $sum: 1 } } }
                    ],
                    sourceStats: [
                        {
                            $group: {
                                _id: { $cond: [{ $ifNull: ["$googleEventId", false] }, "google", "buddy"] },
                                value: { $sum: 1 }
                            }
                        }
                    ],
                    createdTrends: [
                        { $match: { createdAt: { $gte: sevenDaysAgo } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    completedTrends: [
                        { $match: { status: 'completed', updatedAt: { $gte: sevenDaysAgo } } },
                        {
                            $group: {
                                _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const results = aggregation[0];
        const totalCount = results.totalCount[0]?.count || 0;

        // Process Trends
        const trends = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

            const created = results.createdTrends.find(t => t._id === dateStr)?.count || 0;
            const completed = results.completedTrends.find(t => t._id === dateStr)?.count || 0;

            trends.push({ date: displayDate, created, completed });
        }

        // Format priority stats
        const priorityOrder = ['high', 'medium', 'low'];
        const priorityStats = priorityOrder.map(p => ({
            name: p.charAt(0).toUpperCase() + p.slice(1),
            value: results.priorityStats.find(s => s._id === p)?.value || 0
        }));

        // Format status stats
        const statusStats = [
            { name: 'Completed', value: results.statusStats.find(s => s._id === 'completed')?.value || 0 },
            { name: 'Pending', value: results.statusStats.find(s => s._id === 'pending')?.value || 0 },
            { name: 'Snoozed', value: results.statusStats.find(s => s._id === 'snoozed')?.value || 0 }
        ];

        // Format source stats
        const googleCount = results.sourceStats.find(s => s._id === 'google')?.value || 0;
        const buddyCount = results.sourceStats.find(s => s._id === 'buddy')?.value || 0;

        res.status(200).json({
            success: true,
            data: {
                summary: [
                    { label: 'Total Reminders', value: totalCount, icon: 'list', color: '#6366f1' },
                    { label: 'Completed', value: statusStats[0].value, icon: 'check', color: '#10b981' },
                    { label: 'Completion Rate', value: totalCount ? Math.round((statusStats[0].value / totalCount) * 100) + '%' : '0%', icon: 'trending-up', color: '#8b5cf6' },
                    { label: 'Google Synced', value: googleCount, icon: 'calendar', color: '#4285F4' }
                ],
                intentStats: results.intentStats.map(s => ({ name: s._id || 'generic', value: s.value })),
                priorityStats,
                sourceStats: [
                    { name: 'Buddy AI', value: buddyCount },
                    { name: 'Google Calendar', value: googleCount }
                ],
                statusStats,
                trends
            }
        });
    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch analytics" });
    }
};
