import { NavLink } from 'react-router-dom';
import { Home, Users, Mic, ListTodo, Settings, Brain, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MobileNavbar = () => {
    const { user } = useAuth();
    const navItems = [
        { id: 'dashboard', icon: Home, path: '/admin/dashboard', label: 'Home' },
        { id: 'reminders', icon: ListTodo, path: '/admin/reminders', label: 'Tasks' },
        { id: 'buddy', icon: Mic, path: '/admin/buddy', label: 'Buddy' },
        { id: 'users', icon: Users, path: '/admin/users', label: 'Users' },
        { id: 'settings', icon: Settings, path: '/admin/settings', label: 'Config' }
    ].filter(item => user?.allowedPages?.includes(item.id));

    return (
        <div className="mobile-navbar">
            {navItems.map((item) => (
                <NavLink
                    key={item.id}
                    to={item.path}
                    className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''} ${item.id === 'buddy' ? 'buddy-center-btn' : ''}`}
                >
                    <item.icon size={item.id === 'buddy' ? 24 : 20} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                </NavLink>
            ))}

            <style>{`
                .mobile-navbar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 80px; /* Increased from ~60-65px to accomodate safe area and better touch targets */
                    background: rgba(15, 23, 42, 0.85); /* Darker, more opaque background visibility */
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    padding: 0 10px 10px 10px; /* Added bottom padding for modern gesture bars */
                    z-index: 1000;
                    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
                    display: none; /* Hidden by default (desktop) */
                }

                .mobile-nav-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    text-decoration: none;
                    color: var(--text-sub);
                    transition: all 0.3s ease;
                    width: 60px;
                    height: 100%; /* Full height of container */
                    padding-top: 10px; /* Center the content visually vs the bottom padding */
                }

                .nav-icon {
                    opacity: 0.6;
                    transition: all 0.3s ease;
                }

                .nav-label {
                    font-size: 0.65rem;
                    font-weight: 500;
                    opacity: 0.6;
                }

                .mobile-nav-item.active {
                    color: var(--primary-color);
                }

                .mobile-nav-item.active .nav-icon {
                    opacity: 1;
                    transform: translateY(-2px);
                    filter: drop-shadow(0 0 8px rgba(var(--primary-rgb), 0.4)); /* Glow effect if css vars allow */
                }

                .mobile-nav-item.active .nav-label {
                    opacity: 1;
                    font-weight: 700;
                }

                /* Buddy Center Button Styling */
                .buddy-center-btn {
                    transform: translateY(-20px);
                    background: var(--primary-color);
                    border-radius: 50%;
                    width: 56px !important;
                    height: 56px !important;
                    box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.5);
                    border: 4px solid #0f172a; /* Matches approximate dark bg to create cutout effect */
                    justify-content: center;
                    overflow: visible;
                }

                .buddy-center-btn .nav-icon {
                    color: white;
                    opacity: 1 !important;
                    margin-bottom: 0;
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
                }

                .buddy-center-btn .nav-label {
                    position: absolute;
                    bottom: -22px;
                    width: max-content;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
                }

                .buddy-center-btn.active {
                    /* Keep same style when active, maybe add glow */
                    box-shadow: 0 0 20px rgba(var(--primary-rgb), 0.6);
                    color: white;
                }

                @media (max-width: 767px) {
                    .mobile-navbar {
                        display: flex;
                    }
                }
            `}</style>
        </div>
    );
};

export default MobileNavbar;
