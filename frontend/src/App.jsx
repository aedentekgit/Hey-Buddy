import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceAssistantProvider } from './context/VoiceAssistantContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminSettings from './pages/AdminSettings';
import Users from './pages/Users';
import Roles from './pages/Roles';
import BuddyAssistant from './pages/BuddyAssistant';
import Reminders from './pages/Reminders';
import Memories from './pages/Memories';
import AdminManagement from './pages/AdminManagement';
import Dashboard from './pages/Dashboard';
import UserSettings from './pages/UserSettings';
import DashboardLayout from './components/DashboardLayout';

const ProtectedRoute = ({ children, pageId }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-color, #060b28)',
            color: 'var(--text-main, #ffffff)',
            fontSize: '0.8rem',
            fontWeight: '700',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
        }}>
            Loading...
        </div>
    );

    if (!user) return <Navigate to="/login" />;

    // Page Guard check
    if (pageId && user.allowedPages && !user.allowedPages.includes(pageId)) {
        console.warn(`Access Denied to ${pageId} for role ${user.role}`);
        return <Navigate to="/admin/dashboard" />;
    }

    return <DashboardLayout>{children}</DashboardLayout>;
};

const useZoomPrevention = () => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '-' || e.key === '+' || e.key === '0')) {
                e.preventDefault();
            }
        };

        const handleWheel = (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('wheel', handleWheel);
        };
    }, []);
};

function App() {
    useZoomPrevention();
    return (
        <Router>
            <ThemeProvider>
                <SettingsProvider>
                    <AuthProvider>
                        <VoiceAssistantProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/signup" element={<Signup />} />
                                <Route
                                    path="/admin/buddy"
                                    element={
                                        <ProtectedRoute pageId="buddy">
                                            <BuddyAssistant />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/reminders"
                                    element={
                                        <ProtectedRoute pageId="reminders">
                                            <Reminders />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/memories"
                                    element={
                                        <ProtectedRoute pageId="memories">
                                            <Memories />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/settings"
                                    element={
                                        <ProtectedRoute pageId="settings">
                                            <AdminSettings />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/management"
                                    element={
                                        <ProtectedRoute pageId="users">
                                            <AdminManagement />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/users"
                                    element={
                                        <ProtectedRoute pageId="users">
                                            <Users />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/roles"
                                    element={
                                        <ProtectedRoute pageId="roles">
                                            <Roles />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route
                                    path="/admin/dashboard"
                                    element={
                                        <ProtectedRoute pageId="dashboard">
                                            <Dashboard />
                                        </ProtectedRoute>
                                    }
                                />
                                {/* User Settings Route - Available to all authenticated users */}
                                <Route
                                    path="/user/settings"
                                    element={
                                        <ProtectedRoute>
                                            <UserSettings />
                                        </ProtectedRoute>
                                    }
                                />
                                <Route path="/" element={<Navigate to="/admin/dashboard" />} />
                            </Routes>
                        </VoiceAssistantProvider>
                    </AuthProvider>
                </SettingsProvider>
            </ThemeProvider>
        </Router>
    );
}

export default App;
