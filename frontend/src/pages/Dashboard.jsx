import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

const Dashboard = () => {
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

    useEffect(() => {
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
        fetchStats();
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
                                                    <p className="activity-meta"><Clock size={12} /> {row.time || 'All Day'}</p>
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
                                    <button className="quick-action-btn"><Mic size={20} /><span>Speak</span></button>
                                    <button className="quick-action-btn"><Calendar size={20} /><span>Reminder</span></button>
                                    <button className="quick-action-btn"><Brain size={20} /><span>Memory</span></button>
                                    {isAdmin && <button className="quick-action-btn"><Settings size={20} /><span>Settings</span></button>}
                                </div>
                            </motion.div>
                        </div>

                    </div>
                </main>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

                .premium-dashboard {
                    font-family: 'Outfit', sans-serif;
                    min-height: 100vh;
                    margin: -20px;
                    color: white;
                    position: relative;
                    overflow-x: hidden;
                }
                
                /* Backgrounds - Keep existing logic */
                .dashboard-bg-mesh { position: fixed; inset: 0; z-index: -2; background: radial-gradient(at 0% 0%, rgba(0, 117, 255, 0.08) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.06) 0, transparent 50%); }
                .dashboard-glow-1 { position: fixed; top: -10%; left: -10%; width: 50vw; height: 50vw; background: rgba(99, 102, 241, 0.15); filter: blur(100px); border-radius: 50%; z-index: -1; animation: float 10s infinite ease-in-out; }
                .dashboard-glow-2 { position: fixed; bottom: -10%; right: -10%; width: 40vw; height: 40vw; background: rgba(16, 185, 129, 0.1); filter: blur(100px); border-radius: 50%; z-index: -1; animation: float 15s infinite reverse; }
                .dashboard-glow-3 { position: fixed; top: 50%; left: 50%; width: 60%; height: 60%; transform: translate(-50%,-50%); background: rgba(139, 92, 246, 0.05); filter: blur(100px); z-index: -1; animation: pulse-glow 15s infinite; }

                @keyframes float { 0% { transform: translate(0, 0); } 50% { transform: translate(20px, 20px); } 100% { transform: translate(0, 0); } }
                @keyframes pulse-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

                .dashboard-scroll-container { 
                    min-height: 100vh; 
                    padding: 32px; 
                    scroll-behavior: smooth;
                }
                
                .dashboard-content { 
                    margin: 0 auto; 
                    padding-bottom: 40px; 
                }
                
                /* Main Grid Layout */
                .dashboard-main-grid { display: flex; flex-direction: column; gap: 24px; }
                
                .dashboard-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
                
                /* Stat Cards */
                .stat-card { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 24px; position: relative; overflow: hidden; backdrop-filter: blur(10px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
                .stat-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.1); }
                .stat-card-inner { position: relative; z-index: 2; display: flex; justify-content: space-between; align-items: flex-start; }
                .stat-info h3 { font-size: 2rem; font-weight: 700; margin: 4px 0; background: linear-gradient(to right, #fff, #cbd5e1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                .stat-info label { color: #94a3b8; font-size: 0.875rem; font-weight: 500; }
                .stat-change { display: flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 20px; width: fit-content; margin-top: 8px; }
                .stat-change.positive { background: rgba(16, 185, 129, 0.1); color: #34d399; }
                .stat-icon-wrap { width: 48px; height: 48px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 8px 16px rgba(0,0,0,0.2); }
                .stat-card-gradient { position: absolute; inset: 0; opacity: 0.05; z-index: 1; mask-image: linear-gradient(to bottom, black, transparent); }
                .stat-sparkle { position: absolute; top: 12px; right: 12px; opacity: 0; transition: 0.3s; color: rgba(255,255,255,0.4); }
                .stat-card:hover .stat-sparkle { opacity: 1; transform: rotate(90deg); }
                
                /* Charts Layout */
                .charts-section { display: flex; flex-direction: column; gap: 24px; }
                .glass-panel { background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; overflow: hidden; backdrop-filter: blur(10px); }
                .chart-card { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
                .charts-grid-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                
                .panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding: 24px 24px 0; }
                .chart-card .panel-header { padding: 0; margin-bottom: 0; }
                .header-title { display: flex; gap: 16px; align-items: center; }
                .icon-badge { width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: var(--primary-color); border: 1px solid rgba(255,255,255,0.05); }
                .panel-header h3 { font-size: 1.1rem; font-weight: 600; margin: 0 0 2px 0; }
                .panel-subtitle { font-size: 0.8rem; color: #94a3b8; margin: 0; }
                
                .panel-header-small { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
                .panel-header-small h4 { margin: 0; font-size: 1rem; font-weight: 600; color: #e2e8f0; }

                .chart-wrapper { width: 100%; position: relative; }
                .fixed-height-300 { height: 300px; }
                .fixed-height-200 { height: 200px; }
                
                /* Bottom Row */
                .bottom-row-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
                
                /* Activity List */
                .activity-list { padding: 0 24px 24px; display: flex; flex-direction: column; gap: 12px; }
                .activity-row { display: flex; align-items: center; gap: 16px; padding: 12px; border-radius: 16px; background: rgba(255,255,255,0.02); transition: 0.2s; cursor: pointer; border: 1px solid transparent; }
                .activity-row:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.05); }
                .status-dot { width: 8px; height: 8px; border-radius: 50%; }
                .status-dot.pending { background: #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.4); }
                .status-dot.completed { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
                .status-dot.expired { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.4); }
                .activity-main { flex: 1; }
                .activity-title { font-size: 0.95rem; font-weight: 500; margin: 0 0 4px 0; color: #f1f5f9; }
                .activity-meta { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #94a3b8; }
                .badge { font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
                .badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
                .badge.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                
                /* Quick Actions */
                .quick-actions { padding: 0; }
                .quick-actions-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 0 24px 24px; }
                .quick-action-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; color: #cbd5e1; cursor: pointer; transition: 0.2s; }
                .quick-action-btn:hover { background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); color: #38bdf8; transform: translateY(-2px); }
                .quick-action-btn span { font-size: 0.85rem; font-weight: 500; }
                
                .text-btn { background: none; border: none; color: var(--primary-color); font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 12px; transition: 0.2s; }
                .text-btn:hover { background: rgba(99, 102, 241, 0.1); }
                
                /* Skeleton */
                .skeleton { background: rgba(255,255,255,0.05); animation: pulse 1.5s infinite; height: 160px; border-radius: 24px; }
                @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
                
                /* Empty State */
                .empty-state { padding: 40px; text-align: center; color: #64748b; display: flex; flex-direction: column; align-items: center; }
                .empty-icon-wrapper { width: 80px; height: 80px; background: rgba(255,255,255,0.02); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; position: relative; }
                .empty-glow { position: absolute; inset: 0; background: radial-gradient(circle, rgba(99,102,241,0.2), transparent 70%); border-radius: 50%; }
                
                /* Responsive */
                @media (max-width: 1400px) {
                    .dashboard-stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .charts-grid-row { grid-template-columns: repeat(2, 1fr); }
                    .bottom-row-grid { grid-template-columns: 1fr; }
                }
                
                @media (max-width: 1024px) {
                    .dashboard-content { padding: 0 0 80px; }
                }
                
                @media (max-width: 768px) {
                    .dashboard-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
                    .stat-card { padding: 16px; min-height: 120px; }
                    .stat-icon-wrap { width: 36px; height: 36px; border-radius: 10px; }
                    .stat-icon-wrap svg { width: 18px; height: 18px; }
                    .stat-info h3 { font-size: 1.5rem; margin-bottom: 2px; }
                    .stat-info label { font-size: 0.75rem; }
                    
                    .charts-grid-row { grid-template-columns: 1fr; }
                    .fixed-height-300 { height: 220px; }
                    
                    /* Compact Panel Headers */
                    .panel-header { padding: 16px 16px 0; margin-bottom: 12px; }
                    .icon-badge { width: 32px; height: 32px; border-radius: 8px; }
                    .icon-badge svg { width: 16px; height: 16px; }
                    .panel-header h3 { font-size: 1rem; }

                    /* Quick Actions Grid */
                    .quick-actions-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 0 16px 16px; }
                    .quick-action-btn { padding: 12px; border-radius: 12px; gap: 8px; }
                    .quick-action-btn svg { width: 18px; height: 18px; }
                    .quick-action-btn span { font-size: 0.8rem; }
                    
                    /* Activity List Padding */
                    .activity-list { padding: 0 16px 16px; }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
