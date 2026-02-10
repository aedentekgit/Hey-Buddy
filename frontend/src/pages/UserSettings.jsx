import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { User, Phone, MapPin, Trash2, AlertTriangle, Save, Loader2, Mail, Calendar, CheckCircle, XCircle, Link2, Unlink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import voiceService from '../services/voiceService';
import { useNavigate } from 'react-router-dom';

const UserSettings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || ''
            });
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.put('/users/profile', formData);
            if (res.data.success) {
                toast.success('Profile updated successfully');
                // You might want to update the local user context here if it doesn't auto-refresh
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteLoading(true);
        try {
            await api.delete('/users/profile');
            toast.success('Account deleted successfully');
            logout();
            navigate('/login');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete account');
            setShowDeleteConfirm(false);
        } finally {
            setDeleteLoading(false);
        }
    };

    const [calendarLinking, setCalendarLinking] = useState(false);
    const [calendarUnlinking, setCalendarUnlinking] = useState(false);

    const isCalendarLinked = user?.googleRefreshToken ? true : false;

    const handleLinkCalendar = async () => {
        setCalendarLinking(true);
        try {
            const { url } = await voiceService.getGoogleAuthUrl();
            const width = 600, height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;
            window.open(url, 'Link Google Calendar', `width=${width},height=${height},left=${left},top=${top}`);
        } catch (error) {
            toast.error('Failed to start Google linking process.');
        } finally {
            setCalendarLinking(false);
        }
    };

    const handleUnlinkCalendar = async () => {
        setCalendarUnlinking(true);
        try {
            await api.post('/users/unlink-calendar');
            toast.success('Google Calendar unlinked successfully');
            // Refresh user data
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unlink calendar');
        } finally {
            setCalendarUnlinking(false);
        }
    };

    // Listen for Google Auth callback success
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data === 'GOOGLE_AUTH_SUCCESS') {
                toast.success('Google Calendar linked successfully!');
                // Refresh user data
                window.location.reload();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'white' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                    Account Settings
                </h1>
                <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>Manage your personal profile and account preferences</p>
            </div>

            <div style={{ display: 'grid', gap: '2rem' }}>
                {/* General Profile Section */}
                <section style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '2rem',
                    borderRadius: '24px',
                    border: '1px solid var(--border-color)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(0, 117, 255, 0.1)', borderRadius: '12px', color: '#0075ff' }}>
                            <User size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>General Information</h2>
                    </div>

                    <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.9rem' }}>Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px 12px 48px',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '0.95rem'
                                    }}
                                    placeholder="Your Name"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.9rem' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    disabled
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px 12px 48px',
                                        background: 'rgba(15, 23, 42, 0.4)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        fontSize: '0.95rem',
                                        cursor: 'not-allowed'
                                    }}
                                    placeholder="Your Email"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.9rem' }}>Phone Number</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px 12px 48px',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '0.95rem'
                                    }}
                                    placeholder="Your Phone Number"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-sub)', fontSize: '0.9rem' }}>Address</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-sub)' }} />
                                <textarea
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    rows="4"
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px 12px 48px',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontSize: '0.95rem',
                                        resize: 'vertical',
                                        minHeight: '100px',
                                        fontFamily: 'inherit'
                                    }}
                                    placeholder="Your Address"
                                />
                            </div>
                        </div>

                        <div style={{ paddingTop: '1rem' }}>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    padding: '12px 32px',
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: loading ? 0.7 : 1
                                }}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </section>

                {/* Google Calendar Integration Section */}
                <section style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    padding: '2rem',
                    borderRadius: '24px',
                    border: '1px solid var(--border-color)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(66, 133, 244, 0.1)', borderRadius: '12px', color: '#4285F4' }}>
                            <Calendar size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Google Calendar Integration</h2>
                    </div>

                    <div style={{ maxWidth: '600px' }}>
                        <p style={{ color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                            Connect your Google Calendar to automatically sync reminders and events created through Buddy AI.
                        </p>

                        {/* Connection Status */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            background: isCalendarLinked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                            borderRadius: '12px',
                            border: `1px solid ${isCalendarLinked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                            marginBottom: '1.5rem'
                        }}>
                            {isCalendarLinked ? (
                                <>
                                    <CheckCircle size={20} color="#10b981" />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: '600', color: '#10b981' }}>Connected</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                                            Your Google Calendar is linked and syncing
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <XCircle size={20} color="#94a3b8" />
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: '600', color: '#94a3b8' }}>Not Connected</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                                            Link your Google Calendar to enable sync
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            {!isCalendarLinked ? (
                                <button
                                    onClick={handleLinkCalendar}
                                    disabled={calendarLinking}
                                    style={{
                                        padding: '12px 24px',
                                        background: '#4285F4',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: calendarLinking ? 0.7 : 1
                                    }}
                                >
                                    {calendarLinking ? <Loader2 className="animate-spin" size={18} /> : <Link2 size={18} />}
                                    Link Google Calendar
                                </button>
                            ) : (
                                <button
                                    onClick={handleUnlinkCalendar}
                                    disabled={calendarUnlinking}
                                    style={{
                                        padding: '12px 24px',
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '12px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        opacity: calendarUnlinking ? 0.7 : 1
                                    }}
                                >
                                    {calendarUnlinking ? <Loader2 className="animate-spin" size={18} /> : <Unlink size={18} />}
                                    Unlink Calendar
                                </button>
                            )}
                        </div>

                        {/* Info Note */}
                        {isCalendarLinked && (
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '12px 16px',
                                background: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: '8px',
                                border: '1px solid rgba(59, 130, 246, 0.2)'
                            }}>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.5' }}>
                                    💡 <strong>Tip:</strong> When creating reminders with Buddy, you can choose to save them to "Buddy + Google" to automatically sync with your Google Calendar.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Danger Zone */}
                <section style={{
                    background: 'rgba(239, 68, 68, 0.05)',
                    padding: '2rem',
                    borderRadius: '24px',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: '#ef4444' }}>
                            <AlertTriangle size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: '#ef4444' }}>Danger Zone</h2>
                    </div>

                    <p style={{ color: 'var(--text-sub)', marginBottom: '1.5rem', maxWidth: '600px', lineHeight: '1.6' }}>
                        Once you delete your account, there is no going back. Please be certain. All your data including profile, settings, and activity will be permanently removed.
                    </p>

                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                            padding: '12px 24px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Trash2 size={18} />
                        Delete My Account
                    </button>
                </section>
            </div>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(5px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                background: '#1e293b',
                                padding: '2rem',
                                borderRadius: '24px',
                                maxWidth: '400px',
                                width: '90%',
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                                <div style={{
                                    width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                                }}>
                                    <AlertTriangle size={32} />
                                </div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Are you sure?</h3>
                                <p style={{ color: 'var(--text-sub)' }}>
                                    This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={deleteLoading}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={deleteLoading}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        background: '#ef4444',
                                        border: 'none',
                                        borderRadius: '12px',
                                        color: 'white',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    {deleteLoading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserSettings;
