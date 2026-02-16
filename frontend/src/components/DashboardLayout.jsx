import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import '../Layout.css';
import { initNotifications, onMessageListener } from '../services/notificationService';
import toast, { Toaster } from 'react-hot-toast';
import { useVoiceAssistant } from '../context/VoiceAssistantContext';

import MobileNavbar from './MobileNavbar';
import MobileHeader from './MobileHeader';

const DashboardLayout = ({ children }) => {
    const { speak } = useVoiceAssistant();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const location = useLocation();

    const isBuddyPage = location.pathname === '/admin/buddy';
    const isMorePage = location.pathname === '/admin/more';

    const getPageTitle = (path) => {
        if (path.includes('/admin/dashboard')) return 'Overview';
        if (path.includes('/admin/buddy')) return 'Buddy AI';
        if (path.includes('/admin/reminders')) return 'My Reminders';
        if (path.includes('/admin/memories')) return 'Buddy Memory';
        if (path.includes('/admin/management')) return 'Admin Management';
        if (path.includes('/admin/users')) return 'Users';
        if (path.includes('/admin/roles')) return 'Roles';
        if (path.includes('/admin/settings')) return 'System Configuration';
        if (path.includes('/admin/more')) return 'More';
        if (path.includes('/user/settings')) return 'Account Settings';
        return 'Dashboard';
    };

    const title = getPageTitle(location.pathname);

    const toggleSidebar = () => {
        if (window.innerWidth >= 1024) {
            const newState = !isCollapsed;
            setIsCollapsed(newState);
            localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
        } else {
            setSidebarOpen(!sidebarOpen);
        }
    };

    // Initialize Notifications & Voice Announcements
    useEffect(() => {
        const setupVoiceAnnouncements = async () => {
            await initNotifications();

            onMessageListener((payload) => {
                console.log("Foreground Notification Received:", payload);
                const { title, body } = payload.notification;

                // Visual Alert
                toast.success(`${title}: ${body}`, { duration: 5000 });

                // Voice Announcement
                speak(`Reminder: ${body}`);
            });
        };

        setupVoiceAnnouncements();
    }, []);

    return (
        <div className="layout-wrapper">
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: 'var(--toast-bg)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--toast-text)',
                        borderRadius: '15px'
                    }
                }}
            />
            <Sidebar
                isOpen={sidebarOpen}
                setIsOpen={setSidebarOpen}
                isCollapsed={isCollapsed}
            />

            <div
                className="main-content"
                style={{
                    marginLeft: window.innerWidth >= 1024 ? (isCollapsed ? '100px' : '280px') : '0',
                    paddingRight: window.innerWidth >= 1024 ? '20px' : '0'
                }}
            >
                {/* Mobile Header - Global */}
                {!isBuddyPage && <MobileHeader />}

                {!isBuddyPage && !isMorePage && (
                    <Header
                        onMenuClick={toggleSidebar}
                        title={title}
                        hideSearch={isBuddyPage}
                    />
                )}
                <main
                    className={`content-container ${isBuddyPage ? 'buddy-content-override' : ''}`}
                >
                    {children}
                </main>
            </div>

            {!isBuddyPage && <MobileNavbar />}

            <style>{`
                    @media (min-width: 1024px) {
                        .main-content {
                            margin-left: ${isCollapsed ? '100px' : '280px'} !important;
                            padding-right: 20px !important;
                        }
                    }

                    @media (max-width: 767px) {
                        .main-content {
                            padding-bottom: 90px !important; /* Space for MobileNavbar */
                        }
                        /* Hide Default Desktop Header on Mobile */
                        .app-header {
                            display: none !important;
                        }
                    }

                    ${isBuddyPage ? `
                    /* Buddy Page Specific Styles injected dynamically */
                    .buddy-content-override {
                        padding: 0 !important;
                        max-width: 100% !important;
                        overflow: hidden !important;
                        height: calc(100vh - 20px) !important;
                    }

                    @media (max-width: 768px) {
                        .buddy-content-override {
                            height: 100vh !important;
                            padding: 0 !important;
                        }
                        .main-content {
                            padding-bottom: 0 !important;
                            margin-left: 0 !important;
                        }
                    }
                    ` : ''}

                    ${isMorePage ? `
                    .content-container {
                        padding: 0 !important;
                        max-width: 100% !important;
                    }
                    .main-content {
                        padding-right: 0 !important;
                    }
                    ` : ''}
                `}</style>
        </div>
    );
};

export default DashboardLayout;
