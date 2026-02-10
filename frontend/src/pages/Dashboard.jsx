import React, { useState, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Mic, Shield, Calendar, Search, Settings,
    Globe as GlobeIcon, Bell, ChevronRight, Activity, Clock,
    TrendingUp, Zap, Target, BarChart3, Brain, Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Globe = ({ themeMode }) => {
    const canvasRef = useRef();

    useEffect(() => {
        let phi = 0;

        const globe = createGlobe(canvasRef.current, {
            devicePixelRatio: 2,
            width: 900 * 2,
            height: 900 * 2,
            phi: 0,
            theta: 0.3,
            dark: 1,
            diffuse: 1.2,
            mapSamples: 25000,
            mapBrightness: 6,
            baseColor: [0.05, 0.05, 0.2],
            markerColor: [0.1, 0.8, 1],
            glowColor: [0.1, 0.5, 1],
            markers: [
                { location: [37.7595, -122.4367], size: 0.03 },
                { location: [19.0760, 72.8777], size: 0.03 },
                { location: [51.5074, -0.1278], size: 0.03 },
            ],
            onRender: (state) => {
                state.phi = phi;
                phi += 0.002;
            },
        });

        return () => globe.destroy();
    }, []);

    return (
        <div className="vision-globe-wrapper">
            <canvas
                ref={canvasRef}
                style={{ width: '900px', height: '900px', maxWidth: '100%', aspectRatio: '1' }}
            />
            <div className="globe-aura" />
        </div>
    );
};

const Dashboard = () => {
    const { themeMode } = useTheme();
    const { user } = useAuth();
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentReminders, setRecentReminders] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

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
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        const fetchStats = async () => {
            try {
                const res = await api.get('/stats');
                if (res.data.success) {
                    setStats(res.data.data.stats || []);
                    setRecentReminders(res.data.data.recentReminders || []);
                }
            } catch (error) {
                console.error("Dashboard Stats Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
        return () => clearInterval(timer);
    }, []);

    const pageVariants = {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="premium-dashboard">
            {/* Ambient Background Elements */}
            <div className="dashboard-bg-mesh" />
            <div className="dashboard-glow-1" />
            <div className="dashboard-glow-2" />
            <div className="dashboard-glow-3" />

            <Globe themeMode={themeMode} />

            <div className="dashboard-scroll-container">
                <main className="dashboard-content">
                    {/* Enhanced Header Section */}
                    <header className="dashboard-header">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="header-welcome"
                        >
                            <div className="greeting-section">
                                <div className="clock-pill">
                                    <Clock size={14} className="pulse" />
                                    <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="date-sep">|</span>
                                    <span>{currentTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <h1 className="greeting-text">
                                    {getGreeting()}, <span className="user-name">{user?.name || 'User'}</span>
                                </h1>
                            </div>
                            <h2>
                                {isAdmin ? 'System' : 'Your'} <span className="text-gradient">Overview</span>
                            </h2>
                            <p className="subtitle">
                                {isAdmin
                                    ? 'Monitor your platform performance and user activity'
                                    : 'Track your reminders, memories, and Buddy AI interactions'
                                }
                            </p>
                        </motion.div>

                        <div className="header-actions">
                            <div className="search-bar">
                                <Search size={18} />
                                <input type="text" placeholder="Quick search..." />
                            </div>
                            <button className="icon-btn">
                                <Bell size={20} />
                                <span className="notification-dot" />
                            </button>
                        </div>
                    </header>

                    <div className="dashboard-main-grid">
                        <section className="dashboard-left-col">
                            {/* Enhanced Stats Grid */}
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

                            {/* Enhanced Activity Section */}
                            <motion.div
                                className="activity-card glass-panel"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                transition={{ delay: 0.3 }}
                            >
                                <div className="panel-header">
                                    <div className="header-title">
                                        <div className="icon-badge">
                                            <Activity size={18} />
                                        </div>
                                        <div>
                                            <h3>Recent Activity</h3>
                                            <p className="panel-subtitle">Your latest reminders and tasks</p>
                                        </div>
                                    </div>
                                    <button className="text-btn">
                                        View All <ChevronRight size={14} />
                                    </button>
                                </div>

                                <div className="activity-list">
                                    {recentReminders.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon-wrapper">
                                                <Calendar size={48} />
                                                <div className="empty-glow" />
                                            </div>
                                            <h4>No Activity Yet</h4>
                                            <p>Start creating reminders with Buddy AI to see them here</p>
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
                                                    <p className="activity-meta">
                                                        <Clock size={12} />
                                                        {row.time || 'All Day'}
                                                    </p>
                                                </div>
                                                <div className="activity-status">
                                                    <span className={`badge ${row.status}`}>{row.status}</span>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </motion.div>

                            {/* Quick Actions Panel */}
                            <motion.div
                                className="quick-actions glass-panel"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                transition={{ delay: 0.4 }}
                            >
                                <div className="panel-header">
                                    <div className="header-title">
                                        <div className="icon-badge">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <h3>Quick Actions</h3>
                                            <p className="panel-subtitle">Common tasks at your fingertips</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="quick-actions-grid">
                                    <button className="quick-action-btn">
                                        <Mic size={20} />
                                        <span>Talk to Buddy</span>
                                    </button>
                                    <button className="quick-action-btn">
                                        <Calendar size={20} />
                                        <span>New Reminder</span>
                                    </button>
                                    <button className="quick-action-btn">
                                        <Brain size={20} />
                                        <span>View Memories</span>
                                    </button>
                                    {isAdmin && (
                                        <button className="quick-action-btn">
                                            <Settings size={20} />
                                            <span>Settings</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </section>

                        <aside className="dashboard-right-col hide-mobile">
                            {/* Space for the Globe */}
                        </aside>
                    </div>
                </main>
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

                .premium-dashboard {
                    position: relative;
                    min-height: 100vh;
                    font-family: 'Outfit', sans-serif;
                    background: #020617;
                    margin: -20px;
                    overflow: hidden;
                    color: white;
                }

                .dashboard-bg-mesh {
                    position: fixed;
                    inset: 0;
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(0, 117, 255, 0.08) 0, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.06) 0, transparent 50%);
                    z-index: -2;
                }

                .dashboard-glow-1 {
                    position: fixed;
                    top: -15%;
                    right: -15%;
                    width: 70%;
                    height: 70%;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.12) 0%, transparent 70%);
                    filter: blur(140px);
                    z-index: -1;
                    animation: float 20s ease-in-out infinite;
                }

                .dashboard-glow-2 {
                    position: fixed;
                    bottom: -15%;
                    left: -15%;
                    width: 50%;
                    height: 50%;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%);
                    filter: blur(120px);
                    z-index: -1;
                    animation: float 25s ease-in-out infinite reverse;
                }

                .dashboard-glow-3 {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 60%;
                    height: 60%;
                    background: radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%);
                    filter: blur(100px);
                    z-index: -1;
                    animation: pulse-glow 15s ease-in-out infinite;
                }

                @keyframes float {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(30px, -30px); }
                }

                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }

                .vision-globe-wrapper {
                    position: fixed;
                    top: 50%;
                    right: -12%;
                    transform: translateY(-50%);
                    width: 900px;
                    height: 900px;
                    z-index: 0;
                    pointer-events: none;
                }

                .globe-aura {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.1) 0%, transparent 70%);
                    filter: blur(100px);
                }

                canvas {
                    mask-image: radial-gradient(circle, black 35%, transparent 85%);
                }

                .dashboard-scroll-container {
                    position: relative;
                    z-index: 10;
                    height: 100vh;
                    overflow-y: auto;
                    padding: 48px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }

                .dashboard-scroll-container::-webkit-scrollbar {
                    width: 8px;
                }

                .dashboard-scroll-container::-webkit-scrollbar-track {
                    background: transparent;
                }

                .dashboard-scroll-container::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }

                .dashboard-scroll-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }

                .dashboard-content {
                    max-width: 1500px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 56px;
                }

                .greeting-section {
                    margin-bottom: 16px;
                }

                .greeting-text {
                    font-size: 1.5rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.7);
                    margin: 12px 0 0;
                }

                .user-name {
                    color: white;
                    font-weight: 700;
                }

                .header-welcome h2 {
                    font-size: 3rem;
                    font-weight: 900;
                    margin: 8px 0 12px;
                    letter-spacing: -0.03em;
                    line-height: 1.1;
                }

                .subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    font-weight: 500;
                    margin: 0;
                }

                .text-gradient {
                    background: linear-gradient(135deg, var(--primary-color) 0%, #00f2ad 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .clock-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 18px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 100px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(10px);
                }

                .date-sep {
                    margin: 0 4px;
                    color: rgba(255, 255, 255, 0.3);
                }

                .pulse {
                    color: var(--primary-color);
                    animation: pulse-ring 2s infinite;
                }

                @keyframes pulse-ring {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }

                .header-actions {
                    display: flex;
                    gap: 16px;
                }

                .search-bar {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 18px;
                    padding: 0 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 320px;
                    height: 52px;
                    backdrop-filter: blur(20px);
                    transition: all 0.3s;
                }

                .search-bar:focus-within {
                    border-color: var(--primary-color);
                    background: rgba(15, 23, 42, 0.8);
                    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.1);
                }

                .search-bar input {
                    background: transparent;
                    border: none;
                    color: white;
                    width: 100%;
                    outline: none;
                    font-weight: 500;
                    font-size: 0.95rem;
                }

                .search-bar input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }

                .icon-btn {
                    width: 52px;
                    height: 52px;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 18px;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.3s;
                }

                .icon-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                }

                .notification-dot {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 10px;
                    height: 10px;
                    background: #f43f5e;
                    border-radius: 50%;
                    border: 2px solid #020617;
                    animation: pulse-dot 2s infinite;
                }

                @keyframes pulse-dot {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); }
                    50% { box-shadow: 0 0 0 6px rgba(244, 63, 94, 0); }
                }

                /* GRID SYSTEM */
                .dashboard-main-grid {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 48px;
                }

                .dashboard-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 24px;
                    margin-bottom: 32px;
                }

                .stat-card {
                    background: rgba(15, 23, 42, 0.5);
                    backdrop-filter: blur(30px);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 28px;
                    padding: 28px;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .stat-card:hover {
                    border-color: rgba(255, 255, 255, 0.15);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                }

                .stat-card-inner {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }

                .stat-info label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    margin-bottom: 12px;
                }

                .stat-info h3 {
                    font-size: 2.25rem;
                    font-weight: 900;
                    margin: 0 0 8px;
                    letter-spacing: -0.03em;
                }

                .stat-change {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 8px;
                }

                .stat-change.positive {
                    color: #10b981;
                    background: rgba(16, 185, 129, 0.1);
                }

                .stat-icon-wrap {
                    width: 64px;
                    height: 64px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 12px 24px rgba(0,0,0,0.3);
                    flex-shrink: 0;
                }

                .stat-card-gradient {
                    position: absolute;
                    bottom: -60px;
                    right: -60px;
                    width: 140px;
                    height: 140px;
                    filter: blur(70px);
                    opacity: 0.15;
                    transition: opacity 0.3s;
                }

                .stat-card:hover .stat-card-gradient {
                    opacity: 0.35;
                }

                .stat-sparkle {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    color: rgba(255, 255, 255, 0.1);
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .stat-card:hover .stat-sparkle {
                    opacity: 1;
                    animation: sparkle 2s infinite;
                }

                @keyframes sparkle {
                    0%, 100% { transform: rotate(0deg) scale(1); }
                    50% { transform: rotate(180deg) scale(1.2); }
                }

                .glass-panel {
                    background: rgba(15, 23, 42, 0.5);
                    backdrop-filter: blur(40px);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 32px;
                    padding: 36px;
                    margin-bottom: 32px;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .icon-badge {
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, var(--primary-color) 0%, #00f2ad 100%);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 20px rgba(var(--primary-rgb), 0.3);
                }

                .header-title h3 {
                    margin: 0 0 4px;
                    font-size: 1.35rem;
                    font-weight: 800;
                }

                .panel-subtitle {
                    margin: 0;
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.5);
                    font-weight: 500;
                }

                .text-btn {
                    background: transparent;
                    border: none;
                    color: var(--primary-color);
                    font-weight: 700;
                    font-size: 0.9rem;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 8px 16px;
                    border-radius: 12px;
                }

                .text-btn:hover {
                    background: rgba(var(--primary-rgb), 0.1);
                    transform: translateX(4px);
                }

                .activity-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .activity-row {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 24px;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .activity-row:hover {
                    background: rgba(255, 255, 255, 0.06);
                    border-color: rgba(255, 255, 255, 0.1);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.3);
                }

                .status-dot {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                }

                .status-dot.pending { 
                    background: #eab308; 
                    box-shadow: 0 0 12px rgba(234, 179, 8, 0.5), 0 0 0 4px rgba(234, 179, 8, 0.1);
                }
                .status-dot.completed { 
                    background: #10b981; 
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.5), 0 0 0 4px rgba(16, 185, 129, 0.1);
                }
                .status-dot.expired { 
                    background: #f43f5e; 
                    box-shadow: 0 0 12px rgba(244, 63, 94, 0.5), 0 0 0 4px rgba(244, 63, 94, 0.1);
                }

                .activity-main {
                    flex: 1;
                }

                .activity-title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    margin: 0 0 6px;
                }

                .activity-meta {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.5);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin: 0;
                }

                .badge {
                    padding: 8px 16px;
                    border-radius: 100px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }

                .badge.pending { background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); }
                .badge.completed { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
                .badge.expired { background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); }

                .empty-state {
                    text-align: center;
                    padding: 80px 20px;
                }

                .empty-icon-wrapper {
                    position: relative;
                    display: inline-block;
                    margin-bottom: 24px;
                    color: rgba(255, 255, 255, 0.15);
                }

                .empty-glow {
                    position: absolute;
                    inset: -20px;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.1) 0%, transparent 70%);
                    filter: blur(30px);
                }

                .empty-state h4 {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin: 0 0 8px;
                    color: rgba(255, 255, 255, 0.6);
                }

                .empty-state p {
                    color: rgba(255, 255, 255, 0.3);
                    font-size: 0.95rem;
                    margin: 0;
                }

                .quick-actions-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                }

                .quick-action-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.3s;
                    color: white;
                    font-weight: 700;
                    font-size: 0.9rem;
                }

                .quick-action-btn:hover {
                    background: rgba(var(--primary-rgb), 0.1);
                    border-color: var(--primary-color);
                    transform: translateY(-4px);
                    box-shadow: 0 12px 30px rgba(var(--primary-rgb), 0.2);
                }

                .skeleton {
                    background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%);
                    background-size: 200% 100%;
                    animation: skeleton-loading 1.5s infinite;
                    min-height: 140px;
                }

                @keyframes skeleton-loading {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* Mobile Optimizations */
                @media (max-width: 1200px) {
                    .dashboard-main-grid { grid-template-columns: 1fr; }
                    .dashboard-right-col { display: none; }
                    .vision-globe-wrapper { right: -25%; opacity: 0.3; }
                }

                @media (max-width: 768px) {
                    .dashboard-scroll-container { padding: 24px 20px; }
                    .dashboard-stats-grid { grid-template-columns: 1fr; }
                    .dashboard-header { flex-direction: column; gap: 28px; }
                    .header-actions { width: 100%; }
                    .search-bar { flex: 1; }
                    .header-welcome h2 { font-size: 2.25rem; }
                    .greeting-text { font-size: 1.25rem; }
                    .glass-panel { padding: 24px; }
                    .quick-actions-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
