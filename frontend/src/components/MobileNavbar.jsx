import { NavLink } from 'react-router-dom';
import {
    Home, Mic, ListTodo, Brain, MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileNavbar = () => {
    const { user } = useAuth();

    // Primary items always visible in the footer
    const primaryNavItems = [
        { id: 'dashboard', icon: Home, path: '/admin/dashboard', label: 'Home' },
        { id: 'reminders', icon: ListTodo, path: '/admin/reminders', label: 'Tasks' },
        { id: 'buddy', icon: Mic, path: '/admin/buddy', label: 'Buddy' },
        { id: 'memories', icon: Brain, path: '/admin/memories', label: 'Memory' },
    ].filter(item => user?.allowedPages?.includes(item.id));

    return (
        <div className="mobile-navbar-container">
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

                <NavLink
                    to="/admin/more"
                    className={({ isActive }) => `mobile-nav-item more-toggle ${isActive ? 'active' : ''}`}
                >
                    <MoreHorizontal size={20} className="nav-icon" />
                    <span className="nav-label">More</span>
                </NavLink>
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

