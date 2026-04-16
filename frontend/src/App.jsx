import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import { VoiceAssistantProvider } from './context/VoiceAssistantContext';
import { NotificationProvider } from './context/NotificationContext';
import { RealtimeVoiceProvider } from './context/RealtimeVoiceContext';

import ProtectedRoute from './components/ProtectedRoute';
import { useZoomPrevention } from './hooks/useZoomPrevention';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));
const Users = lazy(() => import('./pages/Users'));
const RoleManagement = lazy(() => import('./pages/Admin/RoleManagement/RoleManagement'));
const BuddyAssistant = lazy(() => import('./pages/BuddyAssistant'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Memories = lazy(() => import('./pages/Memories'));
const AdminManagement = lazy(() => import('./pages/AdminManagement'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const UserSettings = lazy(() => import('./pages/UserSettings'));
const Calendar = lazy(() => import('./pages/Calendar'));
const BuddyVision = lazy(() => import('./pages/BuddyVision'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Automations = lazy(() => import('./pages/Automations'));
const MobileMoreMenu = lazy(() => import('./pages/MobileMoreMenu'));
const RealtimeChat = lazy(() => import('./pages/RealtimeChat'));
const LocationReminders = lazy(() => import('./pages/LocationReminders'));
const FamilyHub = lazy(() => import('./pages/FamilyHub'));

const App = () => {
    useZoomPrevention();

    return (
        <Router>
            <ThemeProvider>
                <SettingsProvider>
                    <AuthProvider>
                        <NotificationProvider>
                            <VoiceAssistantProvider>
                                <RealtimeVoiceProvider>
                                    <Toaster position="top-right" />
                                    <Suspense fallback={null}>
                                        <Routes>
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/signup" element={<Signup />} />
                                            <Route path="/forgot-password" element={<ForgotPassword />} />
                                            <Route path="/reset-password" element={<ResetPassword />} />

                                            <Route
                                                path="/admin/realtime"
                                                element={
                                                    <ProtectedRoute pageId="buddy">
                                                        <RealtimeChat />
                                                    </ProtectedRoute>
                                                }
                                            />
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
                                                path="/admin/calendar"
                                                element={
                                                    <ProtectedRoute pageId="reminders">
                                                        <Calendar />
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
                                                    <ProtectedRoute pageId="management">
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
                                                        <RoleManagement />
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
                                            <Route
                                                path="/admin/vision"
                                                element={
                                                    <ProtectedRoute pageId="vision">
                                                        <BuddyVision />
                                                    </ProtectedRoute>
                                                }
                                            />
                                            <Route
                                                path="/admin/knowledge"
                                                element={
                                                    <ProtectedRoute pageId="knowledge">
                                                        <KnowledgeBase />
                                                    </ProtectedRoute>
                                                }
                                            />
                                            <Route
                                                path="/admin/automations"
                                                element={
                                                    <ProtectedRoute pageId="automations">
                                                        <Automations />
                                                    </ProtectedRoute>
                                                }
                                            />
                                            <Route
                                                path="/admin/more"
                                                element={
                                                    <ProtectedRoute>
                                                        <MobileMoreMenu />
                                                    </ProtectedRoute>
                                                }
                                            />
                                            <Route
                                                path="/admin/location-reminders"
                                                element={
                                                    <ProtectedRoute pageId="reminders">
                                                        <LocationReminders />
                                                    </ProtectedRoute>
                                                }
                                            />
                                            <Route
                                                path="/admin/family-hub"
                                                element={
                                                    <ProtectedRoute>
                                                        <FamilyHub />
                                                    </ProtectedRoute>
                                                }
                                            />
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
                                    </Suspense>
                                </RealtimeVoiceProvider>
                            </VoiceAssistantProvider>
                        </NotificationProvider>
                    </AuthProvider>
                </SettingsProvider>
            </ThemeProvider>
        </Router>
    );
};

export default App;

