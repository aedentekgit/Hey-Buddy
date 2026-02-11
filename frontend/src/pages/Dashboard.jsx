import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Users, Mic, Shield, Calendar, Globe as GlobeIcon, ChevronRight, Activity, Clock,
    TrendingUp, Zap, Target, BarChart3, Brain, Sparkles,
    CheckCircle, AlertTriangle, PieChart as PieChartIcon, Settings
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, BarChart, Bar, Legend, AreaChart, Area
} from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatTime } from '../utils/dateUtils';

const Dashboard = () => {
    const navigate = useNavigate();
    const { themeMode } = useTheme();
    const { user } = useAuth();
    const [stats, setStats] = useState([]);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentReminders, setRecentReminders] = useState([]);

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const PRIORITY_COLORS = {
        high: '#ef4444',
        medium: '#f59e0b',
        low: '#10b981'
    };

    const isAdmin = user?.role === 'admin';

    const iconMap = {
        users: Users,
        mic: Mic,
        shield: Shield,
        calendar: Calendar,
        globe: GlobeIcon,
        activity: Activity,
        trending: TrendingUp,
        zap: Zap,
        target: Target,
        chart: BarChart3,
        brain: Brain
    };

    const fetchStats = async () => {
        try {
            const [res, analyticsRes] = await Promise.all([
                api.get('/stats'),
                api.get('/stats/detailed')
            ]);

            if (res.data.success) {
                setStats(res.data.data.stats || []);
                setRecentReminders(res.data.data.recentReminders || []);
            }
            if (analyticsRes.data.success) {
                setAnalyticsData(analyticsRes.data.data);
            }
        } catch (error) {
            console.error("Dashboard Stats Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Listen for background updates
    useEffect(() => {
        const handleUpdate = () => {
            console.log("📊 Dashboard refreshing data...");
            fetchStats();
        };
        window.addEventListener('buddy-data-updated', handleUpdate);
        return () => window.removeEventListener('buddy-data-updated', handleUpdate);
    }, []);

    const pageVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    return (
        <div className="premium-dashboard">
            {/* Ambient Background Elements */}
            <div className="dashboard-bg-mesh" />
            <div className="dashboard-glow-1" />
            <div className="dashboard-glow-2" />
            <div className="dashboard-glow-3" />

            <div className="dashboard-scroll-container">
                <main className="dashboard-content">
                    <div className="dashboard-main-grid">

                        {/* 1. Stats Overview */}
                        <div className="dashboard-stats-grid">
                            {loading ? (
                                [1, 2, 3, 4].map(i => <div key={i} className="stat-card skeleton" />)
                            ) : (
                                stats.map((item, index) => {
                                    const Icon = iconMap[item.icon] || GlobeIcon;
                                    return (
                                        <motion.div
                                            key={index}
                                            className="stat-card"
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            whileHover={{ y: -8, scale: 1.02 }}
                                        >
                                            <div className="stat-card-inner">
                                                <div className="stat-info">
                                                    <label>{item.label}</label>
                                                    <h3>{item.value}</h3>
                                                    {item.change && (
                                                        <div className="stat-change positive">
                                                            <TrendingUp size={14} />
                                                            <span>{item.change}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="stat-icon-wrap" style={{
                                                    background: `linear-gradient(135deg, ${item.color || 'var(--primary-color)'} 0%, color-mix(in srgb, ${item.color || 'var(--primary-color)'} 40%, black) 100%)`
                                                }}>
                                                    <Icon size={24} />
                                                </div>
                                            </div>
                                            <div className="stat-card-gradient" style={{ background: item.color || 'var(--primary-color)' }} />
                                            <div className="stat-sparkle">
                                                <Sparkles size={16} />
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* 2. Analytics Charts Section */}
                        {analyticsData && (
                            <div className="charts-section">
                                <motion.div
                                    className="chart-card glass-panel main-chart"
                                    variants={pageVariants}
                                    initial="initial"
                                    animate="animate"
                                >
                                    <div className="panel-header">
                                        <div className="header-title">
                                            <div className="icon-badge">
                                                <Activity size={18} />
                                            </div>
                                            <div>
                                                <h3>Activity Trends</h3>
                                                <p className="panel-subtitle">Performance over the last 7 days</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="chart-wrapper fixed-height-300">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={analyticsData.trends}>
                                                <defs>
                                                    <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                                <XAxis dataKey="date" stroke="var(--text-sub)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-sub)" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)' }} />
                                                <Area type="monotone" dataKey="created" name="Created" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCreated)" />
                                                <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </motion.div>

                                <div className="charts-grid-row">
                                    <motion.div className="chart-card glass-panel" variants={pageVariants}>
                                        <div className="panel-header-small">
                                            <CheckCircle size={16} color="var(--primary-color)" />
                                            <h4>Task Status</h4>
                                        </div>
                                        <div className="chart-wrapper fixed-height-200">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={analyticsData.statusStats}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={70}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {analyticsData.statusStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={['#10b981', '#f59e0b', '#ef4444'][index % 3]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }} />
                                                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>

                                    <motion.div className="chart-card glass-panel" variants={pageVariants}>
                                        <div className="panel-header-small">
                                            <AlertTriangle size={16} color="#f59e0b" />
                                            <h4>Priority</h4>
                                        </div>
                                        <div className="chart-wrapper fixed-height-200">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analyticsData.priorityStats}>
                                                    <XAxis dataKey="name" stroke="var(--text-sub)" fontSize={10} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }} />
                                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                        {analyticsData.priorityStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name.toLowerCase()] || '#6366f1'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>

                                    <motion.div className="chart-card glass-panel" variants={pageVariants}>
                                        <div className="panel-header-small">
                                            <PieChartIcon size={16} color="#8b5cf6" />
                                            <h4>Categories</h4>
                                        </div>
                                        <div className="chart-wrapper fixed-height-200">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={analyticsData.intentStats}
                                                        cx="50%"
                                                        cy="50%"
                                                        outerRadius={70}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                    >
                                                        {analyticsData.intentStats.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ background: 'var(--card-bg)', border: 'none', borderRadius: '8px' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        )}

                        {/* 3. Bottom Row: Activity & Actions */}
                        <div className="bottom-row-grid">
                            <motion.div
                                className="activity-card glass-panel"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                            >
                                <div className="panel-header">
                                    <div className="header-title">
                                        <div className="icon-badge">
                                            <Activity size={18} />
                                        </div>
                                        <div>
                                            <h3>Recent Activity</h3>
                                            <p className="panel-subtitle">Latest reminders and tasks</p>
                                        </div>
                                    </div>
                                    <button className="text-btn">View All <ChevronRight size={14} /></button>
                                </div>

                                <div className="activity-list">
                                    {recentReminders.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon-wrapper">
                                                <Calendar size={48} />
                                                <div className="empty-glow" />
                                            </div>
                                            <h4>No Activity Yet</h4>
                                            <p>Start creating reminders with Buddy AI</p>
                                        </div>
                                    ) : (
                                        recentReminders.map((row, i) => (
                                            <motion.div
                                                key={i}
                                                className="activity-row"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                whileHover={{ x: 8, scale: 1.01 }}
                                            >
                                                <div className="activity-icon">
                                                    <div className={`status-dot ${row.status}`} />
                                                </div>
                                                <div className="activity-main">
                                                    <p className="activity-title">{row.title}</p>
                                                    <p className="activity-meta"><Clock size={12} /> {formatTime(row.time)}</p>
                                                </div>
                                                <span className={`badge ${row.status}`}>{row.status}</span>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </motion.div>

                            <motion.div
                                className="quick-actions glass-panel"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                            >
                                <div className="panel-header">
                                    <div className="header-title">
                                        <div className="icon-badge"><Zap size={18} /></div>
                                        <h3>Quick Actions</h3>
                                    </div>
                                </div>
                                <div className="quick-actions-grid">
                                    <button className="quick-action-btn" onClick={() => navigate('/admin/buddy')}><Mic size={20} /><span>Speak</span></button>
                                    <button className="quick-action-btn" onClick={() => navigate('/admin/reminders')}><Calendar size={20} /><span>Reminder</span></button>
                                    <button className="quick-action-btn" onClick={() => navigate('/admin/memories')}><Brain size={20} /><span>Memory</span></button>
                                    {isAdmin && <button className="quick-action-btn" onClick={() => navigate('/admin/settings')}><Settings size={20} /><span>Settings</span></button>}
                                </div>
                            </motion.div>
                        </div>

                    </div>
                </main>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

                .premium-dashboard {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    min-height: 100vh;
                    margin: -20px;
                    color: var(--text-main);
                    position: relative;
                }
                
                .dashboard-scroll-container { 
                    padding: 32px; 
                }
                
                /* Main Grid Layout */
                .dashboard-main-grid { display: flex; flex-direction: column; gap: 24px; }
                
                .dashboard-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                
                /* Stat Cards */
                .stat-card { 
                    background: var(--card-bg); 
                    border: 1px solid var(--border-color); 
                    border-radius: var(--radius-lg); 
                    padding: 24px; 
                    position: relative; 
                    overflow: hidden; 
                    transition: all 0.2s ease; 
                    box-shadow: var(--card-shadow);
                }
                .stat-card:hover { transform: translateY(-4px); border-color: var(--primary-color); }
                .stat-card-inner { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: center; }
                .stat-info h3 { 
                    font-size: 1.85rem; 
                    font-weight: 800; 
                    margin: 2px 0; 
                    color: var(--text-main);
                    letter-spacing: -0.04em;
                }
                .stat-info label { color: var(--text-sub); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-change { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; width: fit-content; margin-top: 8px; }
                .stat-change.positive { background: color-mix(in srgb, var(--success-color) 10%, transparent); color: var(--success-color); }
                .stat-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
                
                /* Charts Layout */
                .charts-section { display: flex; flex-direction: column; gap: 24px; }
                .glass-panel { 
                    background: var(--card-bg); 
                    border: 1px solid var(--border-color); 
                    border-radius: var(--radius-lg); 
                    overflow: hidden; 
                    box-shadow: var(--card-shadow);
                }
                .chart-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
                .charts-grid-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                
                .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 24px 24px 0; }
                .header-title { display: flex; gap: 12px; align-items: center; }
                .icon-badge { width: 40px; height: 40px; border-radius: 10px; background: var(--bg-lite); display: flex; align-items: center; justify-content: center; color: var(--primary-color); border: 1px solid var(--border-color); }
                .panel-header h3 { font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--text-main); }
                .panel-subtitle { font-size: 0.8rem; color: var(--text-sub); margin: 0; font-weight: 500; }
                
                .panel-header-small { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
                .panel-header-small h4 { margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.02em; }

                .chart-wrapper { width: 100%; position: relative; }
                .fixed-height-300 { height: 300px; }
                .fixed-height-200 { height: 200px; }
                
                /* Bottom Row */
                .bottom-row-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
                
                /* Activity List */
                .activity-list { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 8px; }
                .activity-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--radius-md); background: var(--bg-lite); transition: all 0.1s ease; cursor: pointer; border: 1px solid var(--border-color); }
                .activity-row:hover { background: var(--row-hover); border-color: var(--primary-color); }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; }
                .status-dot.pending { background: var(--warning-color); }
                .status-dot.completed { background: var(--success-color); }
                .status-dot.expired { background: var(--danger-color); }
                .activity-main { flex: 1; }
                .activity-title { font-size: 0.9rem; font-weight: 600; margin: 0 0 2px 0; color: var(--text-main); }
                .activity-meta { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-sub); font-weight: 500; }
                .badge { font-size: 0.65rem; font-weight: 700; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid transparent; }
                .badge.pending { 
                    background: color-mix(in srgb, var(--warning-color) 8%, transparent); 
                    color: var(--warning-color); 
                    border-color: color-mix(in srgb, var(--warning-color) 20%, transparent); 
                }
                .badge.completed { 
                    background: color-mix(in srgb, var(--success-color) 8%, transparent); 
                    color: var(--success-color); 
                    border-color: color-mix(in srgb, var(--success-color) 20%, transparent); 
                }
                .badge.expired { 
                    background: color-mix(in srgb, var(--danger-color) 8%, transparent); 
                    color: var(--danger-color); 
                    border-color: color-mix(in srgb, var(--danger-color) 20%, transparent); 
                }
                
                /* Quick Actions */
                .quick-actions { padding: 0; }
                .quick-actions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 0 24px 24px; }
                .quick-action-btn { background: var(--bg-lite); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--text-main); cursor: pointer; transition: 0.2s; }
                .quick-action-btn:hover { background: var(--row-hover); border-color: var(--primary-color); color: var(--primary-color); }
                .quick-action-btn span { font-size: 0.8rem; font-weight: 700; }
                
                .text-btn { background: none; border: none; color: var(--primary-color); font-weight: 600; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 8px 12px; border-radius: var(--radius-sm); transition: 0.2s; }
                .text-btn:hover { background: var(--row-hover); }
                
                /* Skeleton */
                .skeleton { background: var(--bg-lite); animation: pulse 1.5s infinite; height: 160px; border-radius: var(--radius-lg); }
                
                /* Empty State */
                .empty-state { padding: 40px; text-align: center; color: var(--text-sub); display: flex; flex-direction: column; align-items: center; }
                .empty-icon-wrapper { width: 64px; height: 64px; background: var(--bg-lite); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; border: 1px solid var(--border-color); }
                .empty-state h4 { color: var(--text-main); font-weight: 700; font-size: 1rem; margin-bottom: 4px; }
                .empty-state p { font-size: 0.85rem; }
                
                /* Responsive */
                @media (max-width: 1400px) {
                    .dashboard-stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .charts-grid-row { grid-template-columns: repeat(2, 1fr); }
                    .bottom-row-grid { grid-template-columns: 1fr; }
                }
                
                @media (max-width: 1024px) {
                    .dashboard-scroll-container { padding: 20px; }
                }
                
                @media (max-width: 768px) {
                    .dashboard-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .stat-card { padding: 16px; border-radius: 12px; }
                    .stat-info h3 { font-size: 1.35rem; }
                    .stat-info label { font-size: 0.65rem; }
                    .stat-icon-wrap { width: 32px; height: 32px; }
                    .stat-icon-wrap svg { width: 16px; height: 16px; }
                    
                    /* Double up small charts too */
                    .charts-grid-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .chart-card { padding: 12px; }
                    .panel-header-small h4 { font-size: 0.75rem; }
                    
                    .quick-actions-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 0 16px 16px; }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
