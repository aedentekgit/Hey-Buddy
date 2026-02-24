import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import {
    User, Phone, MapPin, Trash2, AlertTriangle, Save, Loader2, Mail, Calendar,
    CheckCircle, XCircle, Link2, Unlink, Settings, Shield, Eye, EyeOff, LayoutGrid, Camera, ImagePlus,
    Bell, MessageSquare, Clock, ChevronDown, Mic, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import voiceService from '../services/voiceService';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUrl';
import { decode, decodeAudioData } from '../utils/audio';

const NotifSetting = ({ icon: Icon, title, description, enabled, delay, onToggle, onDelayChange }) => (
    <div style={{
        padding: '20px',
        background: 'var(--bg-lite)',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        marginBottom: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'var(--card-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)'
                }}>
                    <Icon size={20} color="var(--primary-color)" />
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>{title}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-sub)' }}>{description}</p>
                </div>
            </div>

            <div
                onClick={onToggle}
                style={{
                    width: '48px',
                    height: '24px',
                    borderRadius: '12px',
                    background: enabled ? 'var(--primary-color)' : 'var(--border-color)',
                    padding: '2px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    position: 'relative'
                }}
            >
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'white',
                    transform: `translateX(${enabled ? '24px' : '0'})`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
            </div>
        </div>

        {enabled && onDelayChange && (
            <div style={{
                paddingTop: '16px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <Clock size={16} color="var(--text-sub)" />
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Escalation Delay:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="number"
                        min="0"
                        value={delay}
                        onChange={(e) => onDelayChange(parseInt(e.target.value) || 0)}
                        style={{
                            width: '60px',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            outline: 'none'
                        }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>minutes</span>
                </div>
            </div>
        )}
    </div>
);

const UserSettings = () => {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    // Form Data
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12'
    });

    // State for notification preferences
    const [notifPreferences, setNotifPreferences] = useState({
        voice: { enabled: true },
        push: { enabled: true, delay: 0 },
        sms: { enabled: false, delay: 5 },
        email: { enabled: true, delay: 0 },
        inApp: { enabled: true, delay: 0 }
    });

    // State for voice assistant personality
    const [voicePreferences, setVoicePreferences] = useState({
        gender: 'female',
        tone: 'soft'
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || '',
                dateFormat: user.dateFormat || 'DD/MM/YYYY',
                timeFormat: user.timeFormat || '12'
            });
            if (user.notificationPreferences) {
                setNotifPreferences(prev => ({
                    ...prev,
                    ...user.notificationPreferences
                }));
            }
            if (user.voicePreferences) {
                setVoicePreferences(prev => ({
                    ...prev,
                    ...user.voicePreferences
                }));
            }
        }
    }, [user]);

    const handleUpdateNotifications = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const res = await api.put('/users/profile', {
                notificationPreferences: notifPreferences,
                voicePreferences: voicePreferences
            });
            if (res.data.success) {
                toast.success('Preferences updated');
                refreshUser();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update preferences');
        } finally {
            setLoading(false);
        }
    };

    // Calendar State
    const [calendarLinking, setCalendarLinking] = useState(false);
    const [calendarUnlinking, setCalendarUnlinking] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const audioContextRef = useRef(null);
    const isCalendarLinked = user?.googleRefreshToken ? true : false;

    // Handlers
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePreviewVoice = async () => {
        if (previewLoading) return;
        setPreviewLoading(true);
        try {
            console.log("[Preview] Requesting voice preview...");
            const response = await api.get('/voice/preview-voice', {
                params: {
                    gender: voicePreferences.gender,
                    tone: voicePreferences.tone
                }
            });

            if (response.data.success && response.data.audio) {
                console.log("[Preview] Audio data received, size:", response.data.audio.length);

                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                }
                const ctx = audioContextRef.current;
                if (ctx.state === 'suspended') await ctx.resume();

                const audioData = decode(response.data.audio);
                const buffer = await decodeAudioData(audioData, ctx, 24000, 1);

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);

                source.onended = () => {
                    console.log("[Preview] Playback complete");
                    setPreviewLoading(false);
                };

                source.start();
                toast.success("Playing sample...");
            } else {
                toast.error("Failed to generate preview.");
                setPreviewLoading(false);
            }
        } catch (error) {
            console.error("Preview failed:", error);
            toast.error(error.response?.data?.message || "Voice preview failed.");
            setPreviewLoading(false);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.put('/users/profile', formData);
            if (res.data.success) {
                toast.success('Profile updated successfully');
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
            setShowUnlinkConfirm(false);
            window.location.reload();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to unlink calendar');
        } finally {
            setCalendarUnlinking(false);
        }
    };

    // Profile Picture Handlers
    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB');
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreviewImage(reader.result);
        };
        reader.readAsDataURL(file);

        // Upload immediately
        const formData = new FormData();
        formData.append('profilePicture', file);

        setImageUploading(true);
        try {
            const res = await api.post('/users/profile/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                toast.success('Profile picture updated');
                await refreshUser(); // Refresh user data to get new image URL
                setPreviewImage(null); // Clear preview as we now have real URL
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to update profile picture');
            setPreviewImage(null); // Clear preview on error
        } finally {
            setImageUploading(false);
        }
    };

    const handleDeleteProfilePicture = async () => {
        if (!confirm('Are you sure you want to remove your profile picture?')) return;

        setImageUploading(true);
        try {
            await api.delete('/users/profile/avatar');
            toast.success('Profile picture removed');
            await refreshUser();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove picture');
        } finally {
            setImageUploading(false);
        }
    };

    const getProfileImageUrl = () => {
        if (previewImage) return previewImage;
        return getImageUrl(user?.profilePicture);
    };

    // Listen for Google Auth callback
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data === 'GOOGLE_AUTH_SUCCESS') {
                toast.success('Google Calendar linked successfully!');
                refreshUser();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const tabs = [
        { id: 'general', label: 'General', icon: Settings },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'integrations', label: 'Integrations', icon: LayoutGrid },
        { id: 'danger', label: 'Account Zone', icon: Shield }
    ];

    return (
        <div style={{ color: 'var(--text-main)' }}>
            <Toaster position="top-right" />

            {/* Layout Grid */}
            <div className="settings-container">
                {/* Sidebar Tabs */}
                <div className="settings-tabs">
                    <div className="tabs-header" style={{ padding: '8px 12px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', opacity: 0.8 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Menu</span>
                    </div>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={activeTab === tab.id ? 'active' : ''}
                            >
                                <Icon size={18} />
                                <span className="tab-label-text">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="settings-content">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <section className="settings-card">
                                    <SectionTitle label="General Information" icon={User} color="var(--primary-color)" />

                                    {/* Profile Picture Section */}
                                    <div className="profile-upload-section" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{
                                                width: '100px',
                                                height: '100px',
                                                borderRadius: '50%',
                                                background: 'var(--bg-lite)',
                                                border: '2px solid var(--border-color)',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative'
                                            }}>
                                                {getProfileImageUrl() ? (
                                                    <img
                                                        src={getProfileImageUrl()}
                                                        alt="Profile"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <User size={48} color="var(--text-sub)" />
                                                )}

                                                {imageUploading && (
                                                    <div style={{
                                                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Loader2 className="animate-spin" color="white" size={24} />
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={imageUploading}
                                                style={{
                                                    position: 'absolute', bottom: '0', right: '0',
                                                    width: '32px', height: '32px', borderRadius: '50%',
                                                    background: 'var(--primary-color)', border: '2px solid var(--card-bg)',
                                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                                                }}
                                            >
                                                <Camera size={16} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Profile Picture</h4>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                                PNG, JPG or GIF up to 5MB
                                            </p>
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    style={{
                                                        background: 'var(--bg-lite)', border: '1px solid var(--border-color)',
                                                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem',
                                                        fontWeight: '600', color: 'var(--text-main)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '6px'
                                                    }}
                                                >
                                                    <ImagePlus size={14} /> Upload New
                                                </button>
                                                {user?.profilePicture && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteProfilePicture}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                                                            padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem',
                                                            fontWeight: '600', color: '#ef4444', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '6px'
                                                        }}
                                                    >
                                                        <Trash2 size={14} /> Remove
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileSelect}
                                                style={{ display: 'none' }}
                                                accept="image/*"
                                            />
                                        </div>
                                    </div>

                                    <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
                                        <InputGroup
                                            label="Full Name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            placeholder="Your Name"
                                            icon={<User size={18} />}
                                        />
                                        <InputGroup
                                            label="Email Address"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Your Email"
                                            disabled
                                            icon={<Mail size={18} />}
                                        />
                                        <InputGroup
                                            label="Phone Number"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="Your Phone Number"
                                            type="tel"
                                            icon={<Phone size={18} />}
                                        />
                                        <InputGroup
                                            label="Address"
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            placeholder="Your Address"
                                            type="textarea"
                                            icon={<MapPin size={18} />}
                                        />

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            <SelectGroup
                                                label="Date Format"
                                                name="dateFormat"
                                                value={formData.dateFormat}
                                                onChange={handleChange}
                                                icon={<Calendar size={18} />}
                                                options={[
                                                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
                                                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
                                                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' }
                                                ]}
                                            />
                                            <SelectGroup
                                                label="Time Format"
                                                name="timeFormat"
                                                value={formData.timeFormat}
                                                onChange={handleChange}
                                                icon={<Clock size={18} />}
                                                options={[
                                                    { value: '12', label: '12 Hour (01:30 PM)' },
                                                    { value: '24', label: '24 Hour (13:30)' }
                                                ]}
                                            />
                                        </div>

                                        <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
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
                                                    opacity: loading ? 0.7 : 1,
                                                    boxShadow: '0 10px 20px -5px rgba(var(--primary-rgb), 0.4)'
                                                }}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                                Save Changes
                                            </button>
                                        </div>
                                    </form>
                                </section>
                            )}

                            {activeTab === 'notifications' && (
                                <section className="settings-card">
                                    <SectionTitle label="Notification Preferences" icon={Bell} color="var(--primary-color)" />

                                    <p style={{ color: 'var(--text-sub)', marginBottom: '2rem', maxWidth: '600px', lineHeight: '1.6', fontSize: '0.95rem' }}>
                                        Configure how and when you want to receive reminders and alerts. Set delays for escalation to other channels.
                                    </p>

                                    <div style={{ maxWidth: '600px' }}>
                                        <NotifSetting
                                            icon={Mic}
                                            title="AI Voice Reminders"
                                            description="Receive audible reminders from Buddy AI when you are in an active voice session."
                                            enabled={notifPreferences.voice?.enabled}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                voice: { ...notifPreferences.voice, enabled: !notifPreferences.voice?.enabled }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={Bell}
                                            title="Push Notifications"
                                            description="Receive instant alerts on your mobile or desktop device."
                                            enabled={notifPreferences.push.enabled}
                                            delay={notifPreferences.push.delay}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                push: { ...notifPreferences.push, enabled: !notifPreferences.push.enabled }
                                            })}
                                            onDelayChange={(val) => setNotifPreferences({
                                                ...notifPreferences,
                                                push: { ...notifPreferences.push, delay: val }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={MessageSquare}
                                            title="SMS Notifications"
                                            description="Get critical alerts delivered directly to your phone via SMS."
                                            enabled={notifPreferences.sms.enabled}
                                            delay={notifPreferences.sms.delay}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                sms: { ...notifPreferences.sms, enabled: !notifPreferences.sms.enabled }
                                            })}
                                            onDelayChange={(val) => setNotifPreferences({
                                                ...notifPreferences,
                                                sms: { ...notifPreferences.sms, delay: val }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={Mail}
                                            title="Email Notifications"
                                            description="Receive detailed summaries and reminders in your inbox."
                                            enabled={notifPreferences.email.enabled}
                                            delay={notifPreferences.email.delay}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                email: { ...notifPreferences.email, enabled: !notifPreferences.email.enabled }
                                            })}
                                            onDelayChange={(val) => setNotifPreferences({
                                                ...notifPreferences,
                                                email: { ...notifPreferences.email, delay: val }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={LayoutGrid}
                                            title="In-App Notifications"
                                            description="See alerts and updates within the Buddy Assistant interface."
                                            enabled={notifPreferences.inApp.enabled}
                                            delay={notifPreferences.inApp.delay}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                inApp: { ...notifPreferences.inApp, enabled: !notifPreferences.inApp.enabled }
                                            })}
                                            onDelayChange={(val) => setNotifPreferences({
                                                ...notifPreferences,
                                                inApp: { ...notifPreferences.inApp, delay: val }
                                            })}
                                        />

                                        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                                            <SectionTitle label="Voice Assistant Personality" icon={Mic} color="var(--primary-color)" />
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '20px' }}>
                                                <p style={{ color: 'var(--text-sub)', margin: 0, fontSize: '0.9rem', flex: 1 }}>
                                                    Customize Buddy's voice output style. Select the gender and tone that feels most natural to you.
                                                </p>
                                                <button
                                                    onClick={handlePreviewVoice}
                                                    disabled={previewLoading}
                                                    style={{
                                                        background: 'var(--bg-lite)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '12px',
                                                        padding: '10px 20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        cursor: 'pointer',
                                                        color: 'var(--primary-color)',
                                                        fontWeight: '700',
                                                        fontSize: '0.85rem',
                                                        transition: 'all 0.2s ease',
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                                                    }}
                                                >
                                                    {previewLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                                    {previewLoading ? 'Generating...' : 'Test Voice'}
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '2rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Voice Gender</label>
                                                    <div style={{ display: 'flex', gap: '10px', background: 'var(--bg-lite)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        {['female', 'male'].map(g => (
                                                            <button
                                                                key={g}
                                                                onClick={() => setVoicePreferences({ ...voicePreferences, gender: g })}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: voicePreferences.gender === g ? 'var(--primary-color)' : 'transparent',
                                                                    color: voicePreferences.gender === g ? 'white' : 'var(--text-main)',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: '600',
                                                                    textTransform: 'capitalize',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Voice Tone</label>
                                                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-lite)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                        {['soft', 'normal', 'energetic'].map(t => (
                                                            <button
                                                                key={t}
                                                                onClick={() => setVoicePreferences({ ...voicePreferences, tone: t })}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '8px 4px',
                                                                    borderRadius: '8px',
                                                                    border: 'none',
                                                                    background: voicePreferences.tone === t ? 'var(--primary-color)' : 'transparent',
                                                                    color: voicePreferences.tone === t ? 'white' : 'var(--text-main)',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: '600',
                                                                    textTransform: 'capitalize',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s ease'
                                                                }}
                                                            >
                                                                {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                                            <button
                                                onClick={handleUpdateNotifications}
                                                disabled={loading}
                                                style={{
                                                    padding: '12px 24px',
                                                    background: 'var(--primary-color)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    opacity: loading ? 0.7 : 1,
                                                    boxShadow: '0 4px 15px color-mix(in srgb, var(--primary-color) 30%, transparent)'
                                                }}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                                Save Notification Settings
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Integrations Tab */}
                            {activeTab === 'integrations' && (
                                <section className="settings-card">
                                    <SectionTitle label="Google Calendar Integration" icon={Calendar} color="#4285F4" />

                                    <div style={{ maxWidth: '600px' }}>
                                        <p style={{ color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
                                            Connect your Google Calendar to automatically sync reminders and events created through Buddy AI.
                                        </p>

                                        {/* Status Card */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            padding: '20px',
                                            background: isCalendarLinked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                                            borderRadius: '16px',
                                            border: `1px solid ${isCalendarLinked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
                                            marginBottom: '2rem'
                                        }}>
                                            <div style={{
                                                padding: '10px',
                                                borderRadius: '50%',
                                                background: isCalendarLinked ? '#10b981' : '#94a3b8',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {isCalendarLinked ? <CheckCircle size={24} /> : <XCircle size={24} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '700', color: isCalendarLinked ? '#10b981' : 'var(--text-sub)' }}>
                                                    {isCalendarLinked ? 'Connected' : 'Not Connected'}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                                                    {isCalendarLinked ? 'Your Google Calendar is syncing.' : 'Link your calendar to enable sync.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', gap: '12px' }}>
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
                                                        opacity: calendarLinking ? 0.7 : 1,
                                                        boxShadow: '0 4px 15px rgba(66, 133, 244, 0.3)'
                                                    }}
                                                >
                                                    {calendarLinking ? <Loader2 className="animate-spin" size={18} /> : <Link2 size={18} />}
                                                    Link Google Calendar
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setShowUnlinkConfirm(true)}
                                                    disabled={calendarUnlinking}
                                                    style={{
                                                        padding: '12px 24px',
                                                        background: 'transparent',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.5)',
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
                                    </div>
                                </section>
                            )}

                            {/* Danger Zone Tab */}
                            {activeTab === 'danger' && (
                                <section className="settings-card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                                    <SectionTitle label="Danger Zone" icon={AlertTriangle} color="#ef4444" />

                                    <p style={{ color: 'var(--text-sub)', marginBottom: '2rem', maxWidth: '600px', lineHeight: '1.6' }}>
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
                                            gap: '8px',
                                            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)'
                                        }}
                                    >
                                        <Trash2 size={18} />
                                        Delete My Account
                                    </button>
                                </section>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <Modal
                        icon={AlertTriangle}
                        iconColor="#ef4444"
                        title="Are you sure?"
                        description="This action cannot be undone. This will permanently delete your account."
                        confirmText="Confirm Delete"
                        confirmColor="#ef4444"
                        onConfirm={handleDeleteAccount}
                        onCancel={() => setShowDeleteConfirm(false)}
                        loading={deleteLoading}
                    />
                )}
                {showUnlinkConfirm && (
                    <Modal
                        icon={Unlink}
                        iconColor="#ef4444"
                        title="Unlink Google Calendar?"
                        description="This will disconnect your Google Calendar. You can reconnect it later."
                        confirmText="Confirm Unlink"
                        confirmColor="#ef4444"
                        onConfirm={handleUnlinkCalendar}
                        onCancel={() => setShowUnlinkConfirm(false)}
                        loading={calendarUnlinking}
                    />
                )}
            </AnimatePresence>


            <style>{`
                .settings-container {
                    display: grid;
                    grid-template-columns: 240px 1fr;
                    gap: 2rem;
                    align-items: start;
                }

                .settings-tabs {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    background: var(--card-bg);
                    padding: 12px;
                    border-radius: 24px;
                    border: 1px solid var(--border-color);
                    height: fit-content;
                    backdrop-filter: blur(15px);
                    box-shadow: var(--card-shadow);
                    position: sticky;
                    top: 20px;
                }

                .settings-tabs button {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    border: none;
                    background: transparent;
                    color: var(--text-sub);
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: left;
                }

                .settings-tabs button:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: var(--text-main);
                }

                .settings-tabs button.active {
                    background: var(--primary-color);
                    color: white;
                    box-shadow: 0 4px 15px color-mix(in srgb, var(--primary-color) 40%, transparent);
                }

                .settings-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    padding: 2rem;
                    backdrop-filter: blur(10px);
                }

                @media (max-width: 768px) {
                    .settings-container {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .settings-tabs {
                        flex-direction: row !important;
                        overflow-x: auto;
                        padding: 8px !important;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                        position: relative;
                        top: 0;
                    }
                    .settings-tabs::-webkit-scrollbar {
                        display: none;
                    }
                    .tabs-header {
                        display: none !important;
                    }
                    .tab-label-text {
                        display: none !important;
                    }
                    .settings-tabs button {
                        padding: 10px !important;
                        gap: 0 !important;
                        justify-content: center !important;
                        min-width: 48px;
                    }
                    .settings-card {
                        padding: 1.25rem !important;
                        border-radius: 20px !important;
                    }
                    .section-title-container h3 {
                        font-size: 1.1rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

// --- Sub-components & Styles ---
const SectionTitle = ({ label, icon: Icon, color }) => (
    <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }} className="section-title-container">
        <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--bg-lite)',
            border: '1px solid var(--border-color)',
            color: color || 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
            flexShrink: 0
        }}>
            <Icon size={20} />
        </div>
        <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', lineBreak: 'anywhere' }}>{label}</h3>
        </div>
    </div>
);

const InputGroup = ({ label, name, value, onChange, type = 'text', placeholder = '', required = false, disabled = false, icon }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div style={{ marginBottom: '0.5rem' }}>
            <label style={LabelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
            {type === 'textarea' ? (
                <div style={{ position: 'relative' }}>
                    {icon && <div style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-sub)' }}>{icon}</div>}
                    <textarea
                        name={name}
                        style={{ ...InputStyle, minHeight: '100px', fontFamily: 'inherit', paddingLeft: icon ? '48px' : '16px' }}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                    />
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {icon && <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }}>{icon}</div>}
                    <input
                        type={inputType}
                        name={name}
                        style={{ ...InputStyle, paddingRight: isPassword ? '40px' : '16px', paddingLeft: icon ? '48px' : '16px' }}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)'
                            }}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const SelectGroup = ({ label, name, value, onChange, options, icon }) => (
    <div style={{ marginBottom: '0.5rem' }}>
        <label style={LabelStyle}>{label}</label>
        <div style={{ position: 'relative' }}>
            {icon && <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', pointerEvents: 'none' }}>{icon}</div>}
            <select
                name={name}
                value={value}
                onChange={onChange}
                style={{ ...InputStyle, paddingLeft: icon ? '48px' : '16px', appearance: 'none', cursor: 'pointer' }}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-sub)' }}>
                <ChevronDown size={16} />
            </div>
        </div>
    </div>
);

const Modal = ({ icon: Icon, iconColor, title, description, confirmText, confirmColor, onConfirm, onCancel, loading }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
    >
        <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{
                background: 'var(--card-bg)', padding: '2rem', borderRadius: '24px', maxWidth: '400px', width: '90%',
                border: '1px solid var(--border-color)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
        >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{
                    width: '60px', height: '60px', borderRadius: '50%', background: `color-mix(in srgb, ${confirmColor} 10%, transparent)`,
                    color: confirmColor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                }}>
                    <Icon size={32} />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{title}</h3>
                <p style={{ color: 'var(--text-sub)' }}>{description}</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    onClick={onCancel}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '12px', background: 'var(--bg-lite)', border: '1px solid var(--border-color)',
                        borderRadius: '12px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer'
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '12px', background: confirmColor, border: 'none', borderRadius: '12px',
                        color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                    }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : confirmText}
                </button>
            </div>
        </motion.div>
    </motion.div>
);

const LabelStyle = {
    display: 'block', color: 'var(--text-sub)', fontSize: '0.75rem', fontWeight: '800',
    marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8
};

const InputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)',
    background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: '500',
    outline: 'none', transition: 'all 0.2s ease', backdropFilter: 'blur(10px)'
};

export default UserSettings;
