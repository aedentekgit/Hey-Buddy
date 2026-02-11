import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    Home, Users, Mic, ListTodo, Settings, Brain, ShieldCheck,
    MoreHorizontal, Eye, BookOpen, Cpu, Calendar, User, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const MobileNavbar = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const menuRef = useRef(null);

    // Primary items always visible in the footer
    const primaryNavItems = [
        { id: 'dashboard', icon: Home, path: '/admin/dashboard', label: 'Home' },
        { id: 'reminders', icon: ListTodo, path: '/admin/reminders', label: 'Tasks' },
        { id: 'buddy', icon: Mic, path: '/admin/buddy', label: 'Buddy' },
        { id: 'memories', icon: Brain, path: '/admin/memories', label: 'Memory' },
    ].filter(item => user?.allowedPages?.includes(item.id));

    // Secondary items shown in the "More" menu
    const overflowItems = [
        { id: 'users', icon: Users, path: '/admin/users', label: 'Users' },
        { id: 'vision', icon: Eye, path: '/admin/vision', label: 'Buddy Vision' },
        { id: 'knowledge', icon: BookOpen, path: '/admin/knowledge', label: 'Knowledge Base' },
        { id: 'automations', icon: Cpu, path: '/admin/automations', label: 'Automations' },
        { id: 'calendar', icon: Calendar, path: '/admin/calendar', label: 'Calendar' },
        { id: 'management', icon: ShieldCheck, path: '/admin/management', label: 'Management' },
        { id: 'roles', icon: ShieldCheck, path: '/admin/roles', label: 'Roles' },
        { id: 'settings', icon: Settings, path: '/admin/settings', label: 'System Settings' },
        { id: 'profile', icon: User, path: '/user/settings', label: 'My Settings' }
    ].filter(item => {
        if (item.id === 'profile') return true;
        if (user?.role === 'user' && ['settings', 'roles', 'management', 'users'].includes(item.id)) return false;
        return user?.allowedPages?.includes(item.id);
    });

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Check if any overflow item is active
    const isAnyOverflowActive = overflowItems.some(item => location.pathname === item.path);

    return (
        <div className="mobile-navbar-container">
            <AnimatePresence>
                {isMoreOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="more-menu-overlay"
                            onClick={() => setIsMoreOpen(false)}
                        />
                        <motion.div
                            ref={menuRef}
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="more-menu-sheet"
                        >
                            <div className="menu-header">
                                <h3>More Pages</h3>
                                <button className="close-btn" onClick={() => setIsMoreOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="menu-grid">
                                {overflowItems.map((item) => (
                                    <NavLink
                                        key={item.id}
                                        to={item.path}
                                        onClick={() => setIsMoreOpen(false)}
                                        className={({ isActive }) => `menu-grid-item ${isActive ? 'active' : ''}`}
                                    >
                                        <div className="menu-icon-box">
                                            <item.icon size={20} />
                                        </div>
                                        <span className="menu-label">{item.label}</span>
                                    </NavLink>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <div className="mobile-navbar">
                {primaryNavItems.map((item) => (
                    <NavLink
                        key={item.id}
                        to={item.path}
                        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''} ${item.id === 'buddy' ? 'buddy-center-btn' : ''}`}
                    >
                        <item.icon size={item.id === 'buddy' ? 24 : 20} className="nav-icon" />
                        <span className="nav-label">{item.label}</span>
                    </NavLink>
                ))}

                <button
                    className={`mobile-nav-item more-toggle ${isMoreOpen || isAnyOverflowActive ? 'active' : ''}`}
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                >
                    <MoreHorizontal size={20} className="nav-icon" />
                    <span className="nav-label">More</span>
                </button>
            </div>

            <style>{`
                .mobile-navbar-container {
                    display: contents;
                }

                .mobile-navbar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 80px;
                    background: var(--glass-bg);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    padding: 0 10px 10px 10px;
                    z-index: 1000;
                    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.1);
                    display: none;
                }

                @media (max-width: 767px) {
                    .mobile-navbar {
                        display: flex;
                    }
                }

                .mobile-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    text-decoration: none;
                    color: var(--text-sub);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    width: 60px;
                    height: 100%;
                    padding-top: 10px;
                    background: none;
                    border: none;
                    cursor: pointer;
                }

                .nav-icon {
                    opacity: 0.7;
                    transition: all 0.3s ease;
                    color: inherit;
                }

                .nav-label {
                    font-size: 0.65rem;
                    font-weight: 600;
                    opacity: 0.7;
                    color: inherit;
                }

                .mobile-nav-item.active {
                    color: var(--primary-color);
                }

                .mobile-nav-item.active .nav-icon {
                    opacity: 1;
                    transform: translateY(-2px);
                    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--primary-color) 40%, transparent));
                }

                .mobile-nav-item.active .nav-label {
                    opacity: 1;
                    font-weight: 700;
                }

                .buddy-center-btn {
                    transform: translateY(-20px);
                    background: var(--button-gradient);
                    border-radius: 50%;
                    width: 56px !important;
                    height: 56px !important;
                    box-shadow: 0 4px 15px color-mix(in srgb, var(--primary-color) 40%, transparent);
                    border: 4px solid var(--bg-color);
                    justify-content: center;
                    align-items: center;
                    overflow: visible;
                    padding-top: 0 !important;
                }

                .buddy-center-btn .nav-icon {
                    color: white;
                    opacity: 1 !important;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                    margin: 0;
                    position: relative;
                    top: 0;
                }

                .buddy-center-btn .nav-label {
                    position: absolute;
                    bottom: -22px;
                    color: var(--text-main);
                    width: max-content;
                    font-weight: 700;
                }

                /* More Menu Styling */
                .more-menu-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    z-index: 1100;
                }

                .more-menu-sheet {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: var(--card-bg);
                    backdrop-filter: blur(20px);
                    border-radius: 24px 24px 0 0;
                    padding: 24px;
                    z-index: 1200;
                    max-height: 80vh;
                    overflow-y: auto;
                    border-top: 1px solid var(--border-color);
                    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
                }

                .menu-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .menu-header h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text-main);
                    letter-spacing: 0.02em;
                }

                .close-btn {
                    background: var(--bg-lite);
                    border: none;
                    color: var(--text-main);
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: 1px solid var(--border-color);
                }

                .menu-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                    padding-bottom: 20px;
                }

                .menu-grid-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 16px 8px;
                    border-radius: 16px;
                    text-decoration: none;
                    color: var(--text-sub);
                    background: var(--bg-lite);
                    transition: all 0.2s ease;
                    border: 1px solid var(--border-color);
                }

                .menu-grid-item.active {
                    background: color-mix(in srgb, var(--primary-color) 8%, transparent);
                    border-color: var(--primary-color);
                    color: var(--primary-color);
                }

                .menu-icon-box {
                    width: 44px;
                    height: 44px;
                    background: var(--bg-lite);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    border: 1px solid var(--border-color);
                }

                .menu-grid-item.active .menu-icon-box {
                    background: var(--primary-color);
                    color: white;
                    box-shadow: 0 4px 12px color-mix(in srgb, var(--primary-color) 40%, transparent);
                }

                .menu-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-align: center;
                }
            `}</style>
        </div>
    );
};

export default MobileNavbar;

