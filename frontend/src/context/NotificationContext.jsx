import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { onMessageListener } from '../services/notificationService';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // Setup FCM Foreground Listener
    useEffect(() => {
        const unsubscribe = onMessageListener((payload) => {
            console.log("FCM Foreground Message:", payload);
            const { title, body } = payload.notification;

            // 1. Show Toast
            toast(body, {
                icon: '🔔',
                duration: 6000,
                style: {
                    background: 'var(--card-bg)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--primary-color)'
                }
            });

            // 2. Show native browser notification if allowed
            if (Notification.permission === "granted") {
                new Notification(title, {
                    body: body,
                    icon: '/vite.svg'
                });
            }

            // 3. Refresh count
            fetchNotifications();
        });

        return () => {
            if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
        };
    }, [user]);

    useEffect(() => {
        if (user && !user.isGuest) {
            fetchNotifications();
            // In a real app, we would setup a Socket.io connection here
            const interval = setInterval(fetchNotifications, 30000); // Poll every 30s as fallback
            return () => clearInterval(interval);
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user]);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications');
            if (response.data.success) {
                setNotifications(response.data.data);
                setUnreadCount(response.data.data.filter(n => !n.read).length);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const deleteNotification = async (id) => {
        try {
            await api.delete(`/notifications/${id}`);
            const deleted = notifications.find(n => n._id === id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            if (deleted && !deleted.read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    const clearAllNotifications = async () => {
        try {
            await api.put('/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error clearing all notifications:', error);
        }
    };

    const dismissIndividualNotification = async (id) => {
        try {
            await api.put(`/notifications/${id}/dismiss`);
            setNotifications(prev => prev.filter(n => n._id !== id));
            // Recalculate unread if needed, but easier to just check if it was unread
            const wasUnread = notifications.find(n => n._id === id && !n.read);
            if (wasUnread) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error dismissing notification:', error);
        }
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAllNotifications,
            dismissIndividualNotification,
            refreshNotifications: fetchNotifications
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
