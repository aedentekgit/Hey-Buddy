import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startLocationTracking, stopLocationTracking } from '../services/locationService';
import DashboardLayout from './DashboardLayout';

const ProtectedRoute = ({ children, pageId }) => {
    const { user, loading } = useAuth();

    // Start location tracking when user is authenticated
    useEffect(() => {
        if (user) {
            startLocationTracking();
        } else {
            stopLocationTracking();
        }

        return () => {
            stopLocationTracking();
        };
    }, [user?._id]);

    if (loading) return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-color)',
            color: 'var(--text-main)',
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

export default ProtectedRoute;
