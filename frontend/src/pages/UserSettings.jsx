import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    User, Phone, MapPin, Trash2, AlertTriangle, Save, Loader2, Mail, Calendar,
    CheckCircle, XCircle, Link2, Unlink, Settings, Shield, Eye, EyeOff, LayoutGrid, Camera, ImagePlus,
    Bell, MessageSquare, Clock, ChevronDown, Mic, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import voiceService from '../services/voiceService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getImageUrl } from '../utils/imageUrl';
import { decode, decodeAudioData } from '../utils/audio';

const NotifSetting = ({ icon: Icon, title, description, enabled, onToggle }) => (
    <div style={{
        padding: '24px',
        background: 'var(--bg-lite)',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: 'var(--card-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                    <Icon size={22} color="var(--primary-color)" />
                </div>
                <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>{title}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>{description}</p>
                </div>
            </div>

            <div
                onClick={onToggle}
                style={{
                    width: '56px',
                    height: '28px',
                    borderRadius: '14px',
                    background: enabled ? 'var(--primary-color)' : 'var(--bg-lite)',
                    border: enabled ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                    padding: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    boxShadow: enabled ? '0 4px 12px color-mix(in srgb, var(--primary-color) 25%, transparent)' : 'none'
                }}
            >
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: enabled ? 'white' : 'var(--text-sub)',
                    transform: `translateX(${enabled ? '28px' : '0'})`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }} />
            </div>
        </div>
    </div>
);

const UserSettings = () => {
    const { user, logout, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const fileInputRef = useRef(null);
    const activeTab = searchParams.get('tab') || 'general';
    const setActiveTab = (tab) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', tab);
            return newParams;
        });
    };
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showDeleteAvatarConfirm, setShowDeleteAvatarConfirm] = useState(false);
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
        push: { enabled: true },
        sms: { enabled: false },
        email: { enabled: true },
        inApp: { enabled: true }
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
    const isCalendarLinked = (user?.googleRefreshToken && user.googleRefreshToken !== null) || user?.googleCalendarConnected || false;
    const connectedGoogleEmail = user?.googleEmail || null;

    // Handlers
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePreviewVoice = async () => {
        if (previewLoading) return;
        setPreviewLoading(true);
        try {
            console.log("[Preview] Requesting premium voice preview...");
            window.speechSynthesis.cancel();

            const response = await api.get('/voice/preview-voice', {
                params: {
                    gender: voicePreferences.gender,
                    tone: voicePreferences.tone
                }
            });

            if (response.data.success) {
                if (response.data.audio) {
                    console.log("[Preview] Premium Audio received, playing by decoding wav stream...");

                    if (!audioContextRef.current) {
                        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
                    }
                    const ctx = audioContextRef.current;
                    if (ctx.state === 'suspended') await ctx.resume();

                    // Decode base64 to Float32Array
                    const binaryString = atob(response.data.audio);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    try {
                        const buffer = await ctx.decodeAudioData(bytes.buffer);
                        const source = ctx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(ctx.destination);

                        source.onended = () => {
                            setPreviewLoading(false);
                            console.log("[Preview] Premium Playback complete");
                        };

                        source.start(0);
                        toast.success(`Playing premium voice: ${response.data.voiceName}`);
                        return; // Exit here if premium audio succeeded
                    } catch (decodeErr) {
                        console.error("[Preview] Decode error, falling back to basic...", decodeErr);
                    }
                }

                // Fallback to Native TTS if Premium fails or returns Null
                const config = response.data.resolvedVoiceConfig || { pitch: 1.0, speechRate: 1.0 };
                const text = "Hi! I am Buddy. I am ready to help you.";

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.pitch = config.pitch;
                utterance.rate = config.speechRate;

                const voices = window.speechSynthesis.getVoices();

                // Sort to prefer localService voices
                const sortedVoices = [...voices].sort((a, b) => (b.localService ? 1 : 0) - (a.localService ? 1 : 0));

                const targetVoice = sortedVoices.find(v => {
                    const name = v.name.toLowerCase();
                    const tone = voicePreferences.tone || 'normal';
                    if (voicePreferences.gender === 'female') {
                        if (tone === 'soft') return name.includes('samantha') || name.includes('tessa');
                        if (tone === 'energetic') return name.includes('moira') || name.includes('karen') || name.includes('fiona');
                        return name.includes('victoria') || name.includes('monica') || (name.includes('female') && v.localService);
                    } else {
                        if (tone === 'soft') return name.includes('daniel') || name.includes('thomas');
                        if (tone === 'energetic') return name.includes('alex') || name.includes('lee');
                        return name.includes('fred') || name.includes('oliver') || (name.includes('male') && v.localService);
                    }
                }) || sortedVoices.find(v => {
                    const name = v.name.toLowerCase();
                    if (voicePreferences.gender === 'female') return name.includes('female') || name.includes('woman');
                    return name.includes('male') || name.includes('man');
                }) || sortedVoices[0];

                if (targetVoice) utterance.voice = targetVoice;

                utterance.onend = () => setPreviewLoading(false);
                utterance.onerror = () => setPreviewLoading(false);

                toast.success("Playing basic sample...");
                window.speechSynthesis.speak(utterance);
            } else {
                toast.error("Failed to generate preview config.");
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
                // Refresh global user state so dateFormat/timeFormat
                // propagates to all pages immediately without a reload
                await refreshUser();
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
            await refreshUser();
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
        setShowDeleteAvatarConfirm(false);
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
                                    <div className="profile-upload-section" style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
                                        <div style={{ position: 'relative' }}>
                                            <div style={{
                                                width: '120px',
                                                height: '120px',
                                                borderRadius: '35px',
                                                background: getProfileImageUrl() ? 'transparent' : 'var(--bg-lite)',
                                                border: '1px solid var(--border-color)',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                position: 'relative',
                                                boxShadow: '0 12px 24px -8px rgba(0,0,0,0.1)'
                                            }}>
                                                {getProfileImageUrl() ? (
                                                    <img
                                                        src={getProfileImageUrl()}
                                                        alt="Profile"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <User size={56} color="var(--text-sub)" />
                                                )}

                                                {imageUploading && (
                                                    <div style={{
                                                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                                                        backdropFilter: 'blur(4px)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Loader2 className="animate-spin" color="white" size={32} />
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={imageUploading}
                                                style={{
                                                    position: 'absolute', bottom: '-8px', right: '-8px',
                                                    width: '40px', height: '40px', borderRadius: '12px',
                                                    background: 'var(--primary-color)', border: '4px solid var(--card-bg)',
                                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', boxShadow: '0 8px 16px rgba(var(--primary-rgb), 0.3)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                <Camera size={18} />
                                            </button>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: 'var(--text-main)' }}>Profile Picture</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                                                PNG, JPG or GIF up to 5MB
                                            </p>
                                            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    style={{
                                                        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                                                        padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem',
                                                        fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <ImagePlus size={16} color="var(--primary-color)" /> Upload New
                                                </button>
                                                {user?.profilePicture && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowDeleteAvatarConfirm(true)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)',
                                                            padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem',
                                                            fontWeight: '700', color: '#ef4444', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', gap: '8px',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    >
                                                        <Trash2 size={16} /> Remove
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

                                    <form onSubmit={handleUpdateProfile} style={{ display: 'grid', gap: '1rem', maxWidth: '100%' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                            <InputGroup
                                                label="Full Name"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="Your Name"
                                                icon={User}
                                            />
                                            <InputGroup
                                                label="Email Address"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="Your Email"
                                                disabled
                                                icon={Mail}
                                            />
                                            <InputGroup
                                                label="Phone Number"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="Your Phone Number"
                                                type="tel"
                                                icon={Phone}
                                            />
                                            <InputGroup
                                                label="Address"
                                                name="address"
                                                value={formData.address}
                                                onChange={handleChange}
                                                placeholder="Your Address"
                                                type="textarea"
                                                icon={MapPin}
                                            />
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                                            <SelectGroup
                                                label="Date Format"
                                                name="dateFormat"
                                                value={formData.dateFormat}
                                                onChange={handleChange}
                                                icon={Calendar}
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
                                                icon={Clock}
                                                options={[
                                                    { value: '12', label: '12 Hour (01:30 PM)' },
                                                    { value: '24', label: '24 Hour (13:30)' }
                                                ]}
                                            />
                                        </div>

                                        <div style={{ paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                style={{
                                                    padding: '16px 40px',
                                                    background: 'var(--primary-color)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '16px',
                                                    fontWeight: '800',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    opacity: loading ? 0.7 : 1,
                                                    boxShadow: '0 12px 30px -8px color-mix(in srgb, var(--primary-color) 40%, transparent)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                                Save Profile Changes
                                            </button>
                                        </div>
                                    </form>
                                </section>
                            )}

                            {activeTab === 'notifications' && (
                                <section className="settings-card">
                                    <SectionTitle label="Notification Preferences" icon={Bell} color="var(--primary-color)" />

                                    <p style={{ color: 'var(--text-sub)', marginBottom: '2rem', maxWidth: '600px', lineHeight: '1.6', fontSize: '0.95rem' }}>
                                        Configure how and when you want to receive reminders and alerts across all available channels.
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
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                push: { ...notifPreferences.push, enabled: !notifPreferences.push.enabled }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={MessageSquare}
                                            title="SMS Notifications"
                                            description="Get critical alerts delivered directly to your phone via SMS."
                                            enabled={notifPreferences.sms.enabled}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                sms: { ...notifPreferences.sms, enabled: !notifPreferences.sms.enabled }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={Mail}
                                            title="Email Notifications"
                                            description="Receive detailed summaries and reminders in your inbox."
                                            enabled={notifPreferences.email.enabled}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                email: { ...notifPreferences.email, enabled: !notifPreferences.email.enabled }
                                            })}
                                        />

                                        <NotifSetting
                                            icon={LayoutGrid}
                                            title="In-App Notifications"
                                            description="See alerts and updates within the Buddy Assistant interface."
                                            enabled={notifPreferences.inApp.enabled}
                                            onToggle={() => setNotifPreferences({
                                                ...notifPreferences,
                                                inApp: { ...notifPreferences.inApp, enabled: !notifPreferences.inApp.enabled }
                                            })}
                                        />

                                        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem' }}>
                                            <SectionTitle label="Voice Assistant Personality" icon={Mic} color="var(--primary-color)" />
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '24px' }}>
                                                <p style={{ color: 'var(--text-sub)', margin: 0, fontSize: '0.9rem', flex: 1, fontWeight: '500', lineHeight: '1.5' }}>
                                                    Customize Buddy's voice output style. Select the gender and tone that feels most natural to you.
                                                </p>
                                                <button
                                                    onClick={handlePreviewVoice}
                                                    disabled={previewLoading}
                                                    style={{
                                                        background: 'var(--card-bg)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '16px',
                                                        padding: '12px 24px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        cursor: 'pointer',
                                                        color: 'var(--primary-color)',
                                                        fontWeight: '800',
                                                        fontSize: '0.9rem',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        whiteSpace: 'nowrap',
                                                        boxShadow: '0 8px 16px rgba(0,0,0,0.05)'
                                                    }}
                                                >
                                                    {previewLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                                    {previewLoading ? 'Generating...' : 'Test Voice Output'}
                                                </button>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '2rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Voice Gender</label>
                                                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-lite)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        {['female', 'male'].map(g => (
                                                            <button
                                                                key={g}
                                                                onClick={() => setVoicePreferences({ ...voicePreferences, gender: g })}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '10px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid transparent',
                                                                    background: voicePreferences.gender === g ? 'var(--primary-color)' : 'transparent',
                                                                    color: voicePreferences.gender === g ? 'white' : 'var(--text-sub)',
                                                                    fontSize: '0.9rem',
                                                                    fontWeight: '800',
                                                                    textTransform: 'capitalize',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                    boxShadow: voicePreferences.gender === g ? '0 4px 12px color-mix(in srgb, var(--primary-color) 30%, transparent)' : 'none'
                                                                }}
                                                            >
                                                                {g}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Voice Tone Style</label>
                                                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-lite)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        {['soft', 'normal', 'energetic'].map(t => (
                                                            <button
                                                                key={t}
                                                                onClick={() => setVoicePreferences({ ...voicePreferences, tone: t })}
                                                                style={{
                                                                    flex: 1,
                                                                    padding: '10px 4px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid transparent',
                                                                    background: voicePreferences.tone === t ? 'var(--primary-color)' : 'transparent',
                                                                    color: voicePreferences.tone === t ? 'white' : 'var(--text-sub)',
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: '800',
                                                                    textTransform: 'capitalize',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                    boxShadow: voicePreferences.tone === t ? '0 4px 12px color-mix(in srgb, var(--primary-color) 30%, transparent)' : 'none'
                                                                }}
                                                            >
                                                                {t}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={handleUpdateNotifications}
                                                disabled={loading}
                                                style={{
                                                    padding: '16px 32px',
                                                    background: 'var(--primary-color)',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '16px',
                                                    fontWeight: '800',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    opacity: loading ? 0.7 : 1,
                                                    boxShadow: '0 12px 30px -8px color-mix(in srgb, var(--primary-color) 40%, transparent)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                                Save Preferences
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
                                            gap: '24px',
                                            padding: '28px',
                                            background: isCalendarLinked ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-lite)',
                                            borderRadius: '24px',
                                            border: `1px solid ${isCalendarLinked ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)'}`,
                                            marginBottom: '2.5rem',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}>
                                            <div style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '18px',
                                                background: isCalendarLinked ? '#10b981' : 'var(--card-bg)',
                                                color: isCalendarLinked ? 'white' : 'var(--text-sub)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                boxShadow: isCalendarLinked ? '0 8px 16px rgba(16, 185, 129, 0.2)' : '0 4px 8px rgba(0,0,0,0.05)',
                                                border: isCalendarLinked ? 'none' : '1px solid var(--border-color)'
                                            }}>
                                                {isCalendarLinked ? <CheckCircle size={28} /> : <XCircle size={28} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: '900', color: isCalendarLinked ? '#10b981' : 'var(--text-main)' }}>
                                                    {isCalendarLinked ? 'Google Calendar Connected' : 'Integration Pending'}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-sub)', fontWeight: '500', lineHeight: '1.5' }}>
                                                    {isCalendarLinked ? 'Your Buddy AI events are automatically syncing with Google.' : 'Connect your workspace to enable automatic event synchronization.'}
                                                </p>
                                                {isCalendarLinked && connectedGoogleEmail && (
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        marginTop: '10px',
                                                        padding: '5px 12px',
                                                        background: 'rgba(16, 185, 129, 0.1)',
                                                        borderRadius: '100px',
                                                        border: '1px solid rgba(16, 185, 129, 0.2)',
                                                    }}>
                                                        <svg width="14" height="14" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                                                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                                                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                                                            <path d="M3.964 10.711a5.41 5.41 0 0 1 0-3.422V4.957H.957a8.998 8.998 0 0 0 0 8.086l3.007-2.332z" fill="#FBBC05" />
                                                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.582C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.957L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
                                                        </svg>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>
                                                            Connected with: {connectedGoogleEmail}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                            {isCalendarLinked ? (
                                                <button
                                                    onClick={() => setShowUnlinkConfirm(true)}
                                                    style={{
                                                        padding: '14px 28px',
                                                        background: 'rgba(239, 68, 68, 0.05)',
                                                        color: '#ef4444',
                                                        border: '1px solid rgba(239, 68, 68, 0.1)',
                                                        borderRadius: '16px',
                                                        fontWeight: '800',
                                                        fontSize: '0.95rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    {calendarUnlinking ? <Loader2 className="animate-spin" size={20} /> : <Unlink size={20} />}
                                                    Disconnect Account
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleLinkCalendar}
                                                    disabled={calendarLinking}
                                                    style={{
                                                        padding: '16px 36px',
                                                        background: '#4285F4',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '16px',
                                                        fontWeight: '800',
                                                        fontSize: '1rem',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        opacity: calendarLinking ? 0.7 : 1,
                                                        boxShadow: '0 12px 25px rgba(66, 133, 244, 0.3)',
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                >
                                                    {calendarLinking ? <Loader2 className="animate-spin" size={20} /> : <Link2 size={20} />}
                                                    Link Google Calendar
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

                                    <p style={{ color: 'var(--text-sub)', marginBottom: '2.5rem', maxWidth: '100%', lineHeight: '1.6', fontWeight: '500', fontSize: '0.95rem' }}>
                                        Once you delete your account, there is no going back. All your data including profile info, voice preferences, and calendar activity will be permanently removed.
                                    </p>

                                    <div style={{ background: 'var(--card-bg)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>Permanent Account Deletion</h4>
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>This action is irreversible and will remove all your data.</p>
                                        </div>
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            style={{
                                                padding: '14px 28px',
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '16px',
                                                fontWeight: '800',
                                                fontSize: '0.95rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                boxShadow: '0 10px 25px rgba(239, 68, 68, 0.25)',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                        >
                                            <Trash2 size={20} />
                                            Delete My Account
                                        </button>
                                    </div>
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
                {showDeleteAvatarConfirm && (
                    <Modal
                        icon={Trash2}
                        iconColor="#ef4444"
                        title="Remove Profile Picture?"
                        description="Are you sure you want to remove your profile picture?"
                        confirmText="Remove"
                        confirmColor="#ef4444"
                        onConfirm={handleDeleteProfilePicture}
                        onCancel={() => setShowDeleteAvatarConfirm(false)}
                        loading={imageUploading}
                    />
                )}
            </AnimatePresence>


            <style>{`
                .settings-container {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    gap: 2.5rem;
                    align-items: start;
                }

                .settings-tabs {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    background: var(--card-bg);
                    padding: 16px;
                    border-radius: 30px;
                    border: 1px solid var(--border-color);
                    height: fit-content;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.05);
                    position: sticky;
                    top: 24px;
                    overflow: hidden;
                }

                .settings-tabs button {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 14px 20px;
                    border-radius: 18px;
                    border: 1px solid transparent;
                    background: transparent;
                    color: var(--text-sub);
                    font-weight: 700;
                    font-size: 0.95rem;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    text-align: left;
                    width: 100%;
                }

                .settings-tabs button:hover {
                    background: var(--bg-lite);
                    color: var(--text-main);
                    padding-left: 24px;
                }

                .settings-tabs button.active {
                    background: var(--primary-color);
                    color: white;
                    box-shadow: 0 8px 20px color-mix(in srgb, var(--primary-color) 30%, transparent);
                    border-color: rgba(255, 255, 255, 0.1);
                }

                .settings-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 32px;
                    padding: 32px;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.03);
                }

                .profile-upload-section {
                    background: var(--bg-lite);
                    padding: 32px;
                    border-radius: 35px;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 15px 35px -10px rgba(0,0,0,0.05);
                }

                @media (max-width: 992px) {
                    .settings-container {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .settings-tabs {
                        flex-direction: row !important;
                        overflow-x: auto;
                        padding: 10px !important;
                        scrollbar-width: none;
                        -ms-overflow-style: none;
                        position: relative;
                        top: 0;
                        border-radius: 20px;
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
                        padding: 12px !important;
                        gap: 0 !important;
                        justify-content: center !important;
                        min-width: 52px;
                        border-radius: 15px;
                    }
                }
            `}</style>
        </div>
    );
};

// --- Sub-components & Styles ---
const SectionTitle = ({ label, icon: Icon, color }) => (
    <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }} className="section-title-container">
        <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: color || 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 24px -10px rgba(0,0,0,0.1)',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden'
        }}>
            <div style={{
                position: 'absolute', inset: 0,
                background: color ? `color-mix(in srgb, ${color} 8%, transparent)` : 'color-mix(in srgb, var(--primary-color) 8%, transparent)',
                opacity: 0.5
            }} />
            <Icon size={26} style={{ position: 'relative', zIndex: 1 }} />
        </div>
        <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.03em' }}>{label}</h3>
        </div>
    </div>
);

const InputGroup = ({ label, name, value, onChange, type = 'text', placeholder = '', required = false, disabled = false, icon: Icon }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div style={{ marginBottom: '1.2rem' }}>
            <label style={LabelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
            {type === 'textarea' ? (
                <div style={{ position: 'relative' }}>
                    {Icon && <div style={{ position: 'absolute', left: '18px', top: '20px', color: 'var(--primary-color)', opacity: 0.8 }}><Icon size={20} /></div>}
                    <textarea
                        name={name}
                        style={{ ...InputStyle, minHeight: '120px', fontFamily: 'inherit', paddingLeft: Icon ? '52px' : '18px', paddingTop: '18px' }}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                    />
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {Icon && <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-color)', opacity: 0.8, display: 'flex' }}><Icon size={20} /></div>}
                    <input
                        type={inputType}
                        name={name}
                        style={{ ...InputStyle, paddingRight: isPassword ? '48px' : '18px', paddingLeft: Icon ? '52px' : '18px', height: '56px' }}
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
                                position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px'
                            }}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const SelectGroup = ({ label, name, value, onChange, options, icon: Icon }) => (
    <div style={{ marginBottom: '1.2rem' }}>
        <label style={LabelStyle}>{label}</label>
        <div style={{ position: 'relative' }}>
            {Icon && <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-color)', opacity: 0.8, pointerEvents: 'none', display: 'flex' }}><Icon size={20} /></div>}
            <select
                name={name}
                value={value}
                onChange={onChange}
                style={{ ...InputStyle, paddingLeft: Icon ? '52px' : '18px', appearance: 'none', cursor: 'pointer', height: '56px' }}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-sub)' }}>
                <ChevronDown size={18} />
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
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}
    >
        <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
                background: 'var(--card-bg)', padding: '40px', borderRadius: '32px', maxWidth: '480px', width: '100%',
                border: '1px solid var(--border-color)', boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)',
                textAlign: 'center'
            }}
        >
            <div style={{
                width: '80px', height: '80px', borderRadius: '28px', background: `color-mix(in srgb, ${confirmColor} 10%, transparent)`,
                color: confirmColor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                boxShadow: `0 12px 24px color-mix(in srgb, ${confirmColor} 15%, transparent)`
            }}>
                <Icon size={40} />
            </div>
            <h3 style={{ fontSize: '1.75rem', fontWeight: '900', marginBottom: '12px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{title}</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '1rem', lineHeight: '1.6', marginBottom: '32px', fontWeight: '500' }}>{description}</p>

            <div style={{ display: 'flex', gap: '16px' }}>
                <button
                    onClick={onCancel}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '16px', background: 'var(--bg-lite)', border: '1px solid var(--border-color)',
                        borderRadius: '16px', color: 'var(--text-main)', fontWeight: '800', cursor: 'pointer',
                        fontSize: '0.95rem', transition: 'all 0.2s ease'
                    }}
                >
                    Keep Everything
                </button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    style={{
                        flex: 1, padding: '16px', background: confirmColor, border: 'none', borderRadius: '16px',
                        color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        fontSize: '0.95rem', boxShadow: `0 12px 24px color-mix(in srgb, ${confirmColor} 25%, transparent)`,
                        transition: 'all 0.2s ease'
                    }}
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : confirmText}
                </button>
            </div>
        </motion.div>
    </motion.div>
);

const LabelStyle = {
    display: 'block', color: 'var(--text-sub)', fontSize: '0.8rem', fontWeight: '900',
    marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.9
};

const InputStyle = {
    width: '100%', padding: '14px 20px', borderRadius: '18px', border: '1px solid var(--border-color)',
    background: 'var(--card-bg)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: '600',
    outline: 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', backdropFilter: 'blur(10px)',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
};

export default UserSettings;
