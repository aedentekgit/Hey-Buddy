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
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { AnimatePresence, motion } from 'framer-motion';

const Sidebar = ({ isOpen, setIsOpen, isCollapsed }) => {
    const { user, logout } = useAuth();
    const { settings } = useSettings();

    const branding = settings?.general || {};

    const menuGroups = [
        {
            title: 'DASHBOARDS',
            items: [
                { id: 'dashboard', name: 'Default', icon: Home, path: '/admin/dashboard' },
            ].filter(item => user?.allowedPages?.includes(item.id))
        },
        {
            title: 'APPLICATIONS',
            items: [
                { id: 'buddy', name: 'Buddy AI', icon: Mic, path: '/admin/buddy' },
                { id: 'memories', name: 'Buddy Memory', icon: Brain, path: '/admin/memories' },
                { id: 'reminders', name: 'My Reminders', icon: ListTodo, path: '/admin/reminders' },
            ].filter(item => user?.allowedPages?.includes(item.id))
        },
        {
            title: 'PAGES',
            items: [
                { id: 'users', name: 'Users', icon: Users, path: '/admin/users' },
                { id: 'management', name: 'Admin Management', icon: ShieldCheck, path: '/admin/management' },
                { id: 'roles', name: 'Roles', icon: ShieldCheck, path: '/admin/roles' },
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
                className={`sidebar-vision ${isOpen ? 'mobile-open' : ''}`}
                style={{ width: isCollapsed ? '90px' : '260px' }}
            >
                {/* Logo Section */}
                <div className="sidebar-logo-container">
                    <div className="logo-flex">
                        <div className="logo-icon-box">
                            <ShieldCheck size={18} color="white" />
                        </div>
                        {!isCollapsed && <span className="logo-text">BUDDY AI</span>}
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
                                    key={item.path}
                                    to={item.path}
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
                            <LogOut size={16} />
                        </div>
                        {!isCollapsed && <span className="logout-label">Sign Out</span>}
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
                    background: rgba(6, 11, 40, 0.94);
                    backdrop-filter: blur(40px) saturate(200%);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 24px;
                    display: flex;
                    flex-direction: column;
                    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 1000;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                    font-family: 'Plus Jakarta Sans', sans-serif;
                }

                .sidebar-logo-container {
                    padding: 30px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logo-flex {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                }

                .logo-icon-box {
                    width: 32px;
                    height: 32px;
                    background: linear-gradient(135deg, #0075ff 0%, #00f2ad 100%);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    box-shadow: 0 4px 12px rgba(0, 117, 255, 0.3);
                }

                .logo-text {
                    font-weight: 800;
                    font-size: 1rem;
                    letter-spacing: 0.1em;
                    color: white;
                    background: linear-gradient(135deg, #fff 0%, #a5f3fc 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .sidebar-separator {
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                    margin: 0 24px 20px;
                }

                .sidebar-nav-scroll {
                    flex: 1;
                    padding: 0 16px;
                    overflow-y: auto;
                    overflow-x: hidden;
                }

                .nav-group {
                    margin-bottom: 28px;
                }

                .nav-group-title {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: rgba(255, 255, 255, 0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    margin: 0 0 16px 14px;
                }

                .nav-link {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 12px 14px;
                    border-radius: 15px;
                    color: rgba(255, 255, 255, 0.7);
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 0.82rem;
                    margin-bottom: 4px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .nav-link:hover {
                    background: rgba(255, 255, 255, 0.03);
                    color: white;
                }

                .nav-link.active {
                    background: rgba(255, 255, 255, 0.05); /* Glass Background for active row */
                    color: white;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }

                .nav-icon-wrapper {
                    width: 30px;
                    height: 30px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(20, 26, 68, 0.6);
                    color: var(--primary-color);
                    transition: all 0.2s;
                    flex-shrink: 0;
                }

                .nav-link.active .nav-icon-wrapper {
                    background: var(--primary-color);
                    color: white;
                    box-shadow: 0 4px 10px rgba(var(--primary-rgb), 0.4);
                }

                .nav-label {
                    transition: opacity 0.2s;
                }

                .sidebar-footer {
                    padding: 24px 16px;
                }

                .logout-button {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 12px 14px;
                    border-radius: 15px;
                    color: #ff3b3b;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-family: inherit;
                    font-weight: 700;
                    font-size: 0.82rem;
                    transition: all 0.2s;
                    opacity: 0.8;
                }

                .logout-button:hover {
                    background: rgba(255, 59, 59, 0.05);
                    opacity: 1;
                }

                .logout-icon {
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                @media (max-width: 1023px) {
                    .sidebar-vision {
                        transform: translateX(-110%);
                        left: 0;
                        top: 0;
                        bottom: 0;
                        border-radius: 0 24px 24px 0;
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
