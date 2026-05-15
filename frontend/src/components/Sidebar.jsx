import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Settings,
    Users,
    User,
    BarChart3,
    LogOut,
    ShieldCheck,
    X,
    Mic,
    ListTodo,
    Brain,
    Home,
    ChevronRight,
    Calendar,
    Plus,
    Eye,
    Cpu,
    BookOpen,
    Fingerprint,
    MapPin,
    Heart
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { AnimatePresence, motion } from 'framer-motion';
import { config as envConfig } from '../config/env';
import { getImageUrl } from '../utils/imageUrl';

const Sidebar = ({ isOpen, setIsOpen, isCollapsed }) => {
    const { user, logout } = useAuth();
    const { settings } = useSettings();

    const branding = settings?.general || {};

    const menuGroups = [
        {
            title: 'DASHBOARDS',
            items: [
                { id: 'dashboard', name: 'Dashboard', icon: Home, path: '/admin/dashboard' },
            ].filter(item => user?.allowedPages?.includes(item.id))
        },
        {
            title: 'AI POWERED',
            items: [
                { id: 'buddy', name: 'Buddy AI', icon: Mic, path: '/admin/buddy' },
                { id: 'vision', name: 'Buddy Vision', icon: Eye, path: '/admin/vision' },
                { id: 'knowledge', name: 'Knowledge Base', icon: BookOpen, path: '/admin/knowledge' },
                { id: 'automations', name: 'Automations', icon: Cpu, path: '/admin/automations' },
                { id: 'memories', name: 'Buddy Memory', icon: Brain, path: '/admin/memories' },
            ].filter(item => user?.allowedPages?.includes(item.id))
        },
        {
            title: 'APPLICATIONS',
            items: [
                { id: 'calendar', name: 'Calendar', icon: Calendar, path: '/admin/calendar' },
                { id: 'reminders', name: 'My Reminders', icon: ListTodo, path: '/admin/reminders' },
                { id: 'location-reminders', name: 'Location Reminders', icon: MapPin, path: '/admin/location-reminders' },
                { id: 'family-hub', name: 'Family Hub', icon: Heart, path: '/admin/family-hub' },
            ].filter(item => {
                if (item.id === 'family-hub') return true;
                return user?.allowedPages?.includes('reminders') || user?.allowedPages?.includes(item.id);
            })
        },
        {
            title: 'PAGES',
            items: [
                { id: 'users', name: 'Users', icon: Users, path: '/admin/users' },
                { id: 'management', name: 'Admin Management', icon: ShieldCheck, path: '/admin/management' },
                { id: 'roles', name: 'Roles', icon: Fingerprint, path: '/admin/roles' },
                { id: 'settings', name: 'System Settings', icon: Settings, path: '/admin/settings' },
                { id: 'profile', name: 'My Settings', icon: User, path: '/user/settings' }
            ].filter(item => {
                // Profile/My Settings is always available to authenticated users
                if (item.id === 'profile') return true;

                // Explicitly hide sensitive admin pages from 'user' role, unrelated to allowedPages
                if (user?.role === 'user' && ['settings', 'roles', 'management', 'users'].includes(item.id)) {
                    return false;
                }

                // Other pages depend on permissions
                return user?.allowedPages?.includes(item.id);
            })
        }
    ].filter(group => group.items.length > 0);

    const getLogoUrl = () => {
        return getImageUrl(branding.logo);
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="mobile-overlay"
                    />
                )}
            </AnimatePresence>

            <aside
                className={`sidebar-vision ${isOpen ? 'mobile-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                style={{ width: isCollapsed ? '80px' : '260px' }}
            >
                {/* Logo Section */}
                <div className="sidebar-logo-container">
                    <div className="logo-flex">
                        <div className="logo-icon-box" style={{
                            background: branding.logo ? 'transparent' : 'var(--primary-gradient)',
                            boxShadow: branding.logo ? 'none' : '0 4px 12px color-mix(in srgb, var(--primary-color) 25%, transparent)',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {branding.logo ? (
                                <img
                                    src={getLogoUrl()}
                                    alt="Logo"
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                            ) : (
                                <ShieldCheck size={18} color="#FFFFFF" />
                            )}
                        </div>
                        {!isCollapsed && <span className="logo-text">{branding.companyName || 'BUDDY AI'}</span>}
                    </div>
                </div>

                <div className="sidebar-separator" />

                {/* Navigation Links */}
                <div className="sidebar-nav-scroll sidebar-scroll">
                    {menuGroups.map((group, gIdx) => (
                        <div key={gIdx} className="nav-group">
                            {!isCollapsed && <h6 className="nav-group-title">{group.title}</h6>}
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.id}
                                    to={item.action ? { pathname: item.path } : item.path}
                                    state={item.action ? { action: item.action } : null}
                                    onClick={() => setIsOpen(false)}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                >
                                    <div className="nav-icon-wrapper">
                                        <item.icon size={18} />
                                    </div>
                                    {!isCollapsed && <span className="nav-label">{item.name}</span>}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer Section / Logout */}
                <div className="sidebar-footer">
                    <button onClick={logout} className="logout-button">
                        <div className="logout-icon">
                            {user?.isGuest ? <X size={16} /> : <LogOut size={16} />}
                        </div>
                        {!isCollapsed && (
                            <span className="logout-label">
                                {user?.isGuest ? 'Exit Guest Mode' : 'Sign Out'}
                            </span>
                        )}
                    </button>
                </div>
            </aside>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

                .sidebar-vision {
                    position: fixed;
                    left: 20px;
                    top: 20px;
                    bottom: 20px;
                    background: var(--bg-color);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    display: flex;
                    flex-direction: column;
                    transition: width 0.3s ease;
                    z-index: 1000;
                    box-shadow: var(--card-shadow);
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }

                .sidebar-logo-container {
                    padding: 24px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    transition: all 0.3s ease;
                }

                .collapsed .sidebar-logo-container {
                    padding: 24px 0;
                    justify-content: center;
                }

                .logo-flex {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    transition: all 0.3s ease;
                }

                .collapsed .logo-flex {
                    gap: 0;
                    justify-content: center;
                }

                .logo-icon-box {
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-sm);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .logo-text {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-main);
                    white-space: nowrap;
                }

                .sidebar-separator {
                    height: 1px;
                    background: var(--border-color);
                    margin: 0 20px 20px;
                    transition: all 0.3s ease;
                }

                .collapsed .sidebar-separator {
                    margin: 0 15px 20px;
                }

                .sidebar-nav-scroll {
                    flex: 1;
                    padding: 0 12px;
                    overflow-y: auto;
                    transition: all 0.3s ease;
                }

                .collapsed .sidebar-nav-scroll {
                    padding: 0 8px;
                }

                .nav-group {
                    margin-bottom: 24px;
                }

                .nav-group-title {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05rem;
                    margin: 0 0 12px 12px;
                }

                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border-radius: 14px;
                    color: var(--text-sub);
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.875rem;
                    margin: 0 8px 4px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .collapsed .nav-link {
                    justify-content: center;
                    padding: 12px 0;
                    margin: 0 8px 6px;
                    gap: 0;
                }

                .nav-link:hover {
                    background: rgba(0, 0, 0, 0.03);
                    color: var(--primary-color);
                }
                
                .nav-link.active {
                    background: white; 
                    color: var(--primary-color) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
                }

                .nav-icon-wrapper {
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: inherit;
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .nav-link.active .nav-icon-wrapper {
                    color: var(--primary-color);
                    transform: scale(1.1);
                }

                .nav-link.active .nav-label {
                    color: var(--primary-color);
                    font-weight: 700;
                }

                .nav-label {
                    font-size: 0.9rem;
                    letter-spacing: -0.01em;
                    white-space: nowrap;
                }

                .sidebar-footer {
                    padding: 20px 12px;
                    border-top: 1px solid var(--border-color);
                    transition: all 0.3s ease;
                }

                .collapsed .sidebar-footer {
                    padding: 20px 8px;
                }

                .logout-button {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 12px;
                    border-radius: var(--radius-md);
                    color: var(--danger-color);
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                }

                .collapsed .logout-button {
                    justify-content: center;
                    padding: 10px 0;
                    gap: 0;
                }

                .logout-button:hover {
                    background: color-mix(in srgb, var(--danger-color) 8%, transparent);
                }

                .logout-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    flex-shrink: 0;
                }

                @media (max-width: 1023px) {
                    .sidebar-vision {
                        transform: translateX(-110%);
                        left: 0;
                        top: 0;
                        bottom: 0;
                        border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
                        width: 260px !important;
                    }
                    .sidebar-vision.mobile-open {
                        transform: translateX(0);
                    }
                }

                .sidebar-scroll::-webkit-scrollbar { display: none; }
                .sidebar-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
};

export default Sidebar;
