import React, { useState, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Mic, Shield, Calendar, Search, Settings,
    Globe as GlobeIcon, Bell, ChevronRight, Activity, Clock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';

const Globe = ({ themeMode }) => {
    const canvasRef = useRef();

    useEffect(() => {
        let phi = 0;

        const globe = createGlobe(canvasRef.current, {
            devicePixelRatio: 2,
            width: 800 * 2,
            height: 800 * 2,
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
                style={{ width: '800px', height: '800px', maxWidth: '100%', aspectRatio: '1' }}
            />
            <div className="globe-aura" />
        </div>
    );
};

const Dashboard = () => {
    const { themeMode } = useTheme();
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentReminders, setRecentReminders] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    const iconMap = {
        users: Users,
        mic: Mic,
        shield: Shield,
        calendar: Calendar,
        globe: GlobeIcon,
        activity: Activity
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

    return (
        <div className="premium-dashboard">
            {/* Ambient Background Elements */}
            <div className="dashboard-bg-mesh" />
            <div className="dashboard-glow-1" />
            <div className="dashboard-glow-2" />

            <Globe themeMode={themeMode} />

            <div className="dashboard-scroll-container">
                <main className="dashboard-content">
                    {/* Header Section */}
                    <header className="dashboard-header">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="header-welcome"
                        >
                            <div className="clock-pill">
                                <Clock size={14} className="pulse" />
                                <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="date-sep">|</span>
                                <span>{currentTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <h2>Overview <span className="text-gradient">Performance</span></h2>
                            <p>Everything is looking good today! Here's what's happening.</p>
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
                            {/* Stats Grid */}
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
                                                whileHover={{ y: -5, scale: 1.02 }}
                                            >
                                                <div className="stat-card-inner">
                                                    <div className="stat-info">
                                                        <label>{item.label}</label>
                                                        <h3>{item.value}</h3>
                                                    </div>
                                                    <div className="stat-icon-wrap" style={{
                                                        background: `linear-gradient(135deg, ${item.color || 'var(--primary-color)'} 0%, color-mix(in srgb, ${item.color || 'var(--primary-color)'} 40%, black) 100%)`
                                                    }}>
                                                        <Icon size={24} />
                                                    </div>
                                                </div>
                                                <div className="stat-card-gradient" style={{ background: item.color || 'var(--primary-color)' }} />
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Activity Section */}
                            <motion.div
                                className="activity-card glass-panel"
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                transition={{ delay: 0.3 }}
                            >
                                <div className="panel-header">
                                    <div className="header-title">
                                        <Activity size={18} color="var(--primary-color)" />
                                        <h3>Recent Reminders</h3>
                                    </div>
                                    <button className="text-btn">View All <ChevronRight size={14} /></button>
                                </div>

                                <div className="activity-list">
                                    {recentReminders.length === 0 ? (
                                        <div className="empty-state">
                                            <div className="empty-icon"><Calendar size={40} /></div>
                                            <p>No activity yet.</p>
                                        </div>
                                    ) : (
                                        recentReminders.map((row, i) => (
                                            <motion.div
                                                key={i}
                                                className="activity-row"
                                                whileHover={{ x: 5 }}
                                            >
                                                <div className="activity-icon">
                                                    <div className={`status-dot ${row.status}`} />
                                                </div>
                                                <div className="activity-main">
                                                    <p className="activity-title">{row.title}</p>
                                                    <p className="activity-meta">{row.time || 'All Day'}</p>
                                                </div>
                                                <div className="activity-status">
                                                    <span className={`badge ${row.status}`}>{row.status}</span>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </section>

                        <aside className="dashboard-right-col hide-mobile">
                            {/* Empty space for the Globe */}
                        </aside>
                    </div>
                </main>
            </div>

            <motion.button
                className="floating-settings"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
            >
                <Settings size={28} />
            </motion.button>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

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
                        radial-gradient(at 0% 0%, rgba(0, 117, 255, 0.05) 0, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(20, 25, 60, 0.1) 0, transparent 50%);
                    z-index: -2;
                }

                .dashboard-glow-1 {
                    position: fixed;
                    top: -10%;
                    right: -10%;
                    width: 60%;
                    height: 60%;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.1) 0%, transparent 70%);
                    filter: blur(120px);
                    z-index: -1;
                }

                .dashboard-glow-2 {
                    position: fixed;
                    bottom: -10%;
                    left: -10%;
                    width: 40%;
                    height: 40%;
                    background: radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 70%);
                    filter: blur(100px);
                    z-index: -1;
                }

                .vision-globe-wrapper {
                    position: fixed;
                    top: 50%;
                    right: -10%;
                    transform: translateY(-50%);
                    width: 800px;
                    height: 800px;
                    z-index: 0;
                    pointer-events: none;
                }

                .globe-aura {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%);
                    filter: blur(80px);
                }

                canvas {
                    mask-image: radial-gradient(circle, black 40%, transparent 85%);
                }

                .dashboard-scroll-container {
                    position: relative;
                    z-index: 10;
                    height: 100vh;
                    overflow-y: auto;
                    padding: 40px;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255,255,255,0.1) transparent;
                }

                .dashboard-content {
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 50px;
                }

                .header-welcome h2 {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin: 12px 0 8px;
                    letter-spacing: -0.02em;
                }

                .text-gradient {
                    background: linear-gradient(135deg, var(--primary-color) 0%, #00f2ad 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .header-welcome p {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    font-weight: 500;
                }

                .clock-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 16px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 100px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: rgba(255, 255, 255, 0.8);
                }

                .date-sep {
                    margin: 0 4px;
                    color: rgba(255, 255, 255, 0.2);
                }

                .pulse {
                    color: var(--primary-color);
                    animation: pulse-ring 2s infinite;
                }

                @keyframes pulse-ring {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }

                .header-actions {
                    display: flex;
                    gap: 16px;
                }

                .search-bar {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 0 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 280px;
                    height: 48px;
                    backdrop-filter: blur(10px);
                    transition: border-color 0.3s;
                }

                .search-bar:focus-within {
                    border-color: var(--primary-color);
                }

                .search-bar input {
                    background: transparent;
                    border: none;
                    color: white;
                    width: 100%;
                    outline: none;
                    font-weight: 500;
                }

                .icon-btn {
                    width: 48px;
                    height: 48px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
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
                }

                .notification-dot {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    width: 8px;
                    height: 8px;
                    background: #f43f5e;
                    border-radius: 50%;
                    border: 2px solid #020617;
                }

                /* GRID SYSTEM */
                .dashboard-main-grid {
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 40px;
                }

                .dashboard-stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .stat-card {
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 24px;
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    cursor: pointer;
                }

                .stat-card-inner {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .stat-info label {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: rgba(255, 255, 255, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 8px;
                }

                .stat-info h3 {
                    font-size: 2rem;
                    font-weight: 800;
                    margin: 0;
                    letter-spacing: -0.02em;
                }

                .stat-icon-wrap {
                    width: 56px;
                    height: 56px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                }

                .stat-card-gradient {
                    position: absolute;
                    bottom: -50px;
                    right: -50px;
                    width: 120px;
                    height: 120px;
                    filter: blur(60px);
                    opacity: 0.15;
                    transition: opacity 0.3s;
                }

                .stat-card:hover .stat-card-gradient {
                    opacity: 0.3;
                }

                .glass-panel {
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(30px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 32px;
                    padding: 32px;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                }

                .header-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .header-title h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
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
                    transition: opacity 0.2s;
                }

                .text-btn:hover {
                    opacity: 0.8;
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
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .activity-row:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.2);
                }

                .status-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }

                .status-dot.pending { background: #eab308; box-shadow: 0 0 10px rgba(234, 179, 8, 0.4); }
                .status-dot.completed { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); }
                .status-dot.expired { background: #f43f5e; box-shadow: 0 0 10px rgba(244, 63, 94, 0.4); }

                .activity-main {
                    flex: 1;
                }

                .activity-title {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0 0 4px;
                }

                .activity-meta {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.4);
                }

                .badge {
                    padding: 6px 14px;
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .badge.pending { background: rgba(234, 179, 8, 0.1); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.2); }
                .badge.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .badge.expired { background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); }

                .floating-settings {
                    position: fixed;
                    bottom: 40px;
                    right: 40px;
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, var(--primary-color) 0%, #00f2ad 100%);
                    border: none;
                    border-radius: 20px;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 12px 30px rgba(var(--primary-rgb), 0.3);
                    z-index: 100;
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 0;
                    color: rgba(255, 255, 255, 0.2);
                }

                .empty-icon {
                    margin-bottom: 16px;
                }

                /* Mobile Optimizations */
                @media (max-width: 1200px) {
                    .dashboard-main-grid { grid-template-columns: 1fr; }
                    .dashboard-right-col { display: none; }
                    .vision-globe-wrapper { right: -20%; opacity: 0.4; pointer-events: none; }
                }

                @media (max-width: 768px) {
                    .dashboard-scroll-container { padding: 20px; }
                    .dashboard-stats-grid { grid-template-columns: 1fr; }
                    .dashboard-header { flex-direction: column; gap: 24px; }
                    .header-actions { width: 100%; }
                    .search-bar { flex: 1; }
                    .header-welcome h2 { font-size: 2rem; }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
