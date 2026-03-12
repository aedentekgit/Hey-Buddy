import React from 'react';
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

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminSettings from './pages/AdminSettings';
import Users from './pages/Users';
import Roles from './pages/Roles';
import BuddyAssistant from './pages/BuddyAssistant';
import Reminders from './pages/Reminders';
import Memories from './pages/Memories';
import AdminManagement from './pages/AdminManagement';
import Dashboard from './pages/Dashboard';
import UserSettings from './pages/UserSettings';
import Calendar from './pages/Calendar';
import BuddyVision from './pages/BuddyVision';
import KnowledgeBase from './pages/KnowledgeBase';
import Automations from './pages/Automations';
import MobileMoreMenu from './pages/MobileMoreMenu';
import RealtimeChat from './pages/RealtimeChat';
import LocationReminders from './pages/LocationReminders';
import FamilyHub from './pages/FamilyHub';

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
                                                <ProtectedRoute pageId="calendar">
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

