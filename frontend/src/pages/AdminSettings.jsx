import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import CustomSelect from '../components/CustomSelect';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    Settings, Mail, MessageSquare, CreditCard, Share2, Palette, Save, Plus, Trash2, Send, Upload, ChevronRight, Globe, Play, Square,
    Facebook, Instagram, Twitter, Linkedin, Youtube, ExternalLink, RefreshCw, CheckCircle2, ShieldCheck, Zap, Eye, EyeOff, Lock, ChevronDown, Bell, Database, Calendar, Link2,
    Sun, Moon, Copy, FileJson, Smartphone, Image, MapPin, HardDrive, Cloud, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { requestNotificationPermission } from '../services/notificationService';
import ConfirmationModal from '../components/ConfirmationModal';
import { getImageUrl } from '../utils/imageUrl';
import { config as envConfig } from '../config/env';
import './AdminSettings/styles/settings.module.css';

// Extracted components
import SMSSettingsComp from './AdminSettings/components/SMSSettings';
import GoogleMapsSettingsComp from './AdminSettings/components/GoogleMapsSettings';

const FONTS = [
    { value: "'Inter', sans-serif", label: "Inter (Modern)" },
    { value: "'Poppins', sans-serif", label: "Poppins (Rounded)" },
    { value: "'Outfit', sans-serif", label: "Outfit (Professional)" },
    { value: "'Lexend', sans-serif", label: "Lexend (Clean)" },
    { value: "'Public Sans', sans-serif", label: "Public Sans (SaaS)" },
    { value: "'Sora', sans-serif", label: "Sora (Unique)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Classic)" }
];

const AdminSettings = () => {
    const { user, refreshUser } = useAuth();
    const {
        themeMode, setThemeMode,
        accentColor, setAccentColor,
        secondaryAccent, setSecondaryAccent
    } = useTheme();
    const { refreshSettings, fetchPublicSettings } = useSettings();
    const logoInputRef = useRef(null);
    const mobileLogoInputRef = useRef(null);
    const splashIconInputRef = useRef(null);

    // Apply font globally
    const applyFont = (font) => {
        if (font) {
            document.documentElement.style.setProperty('--font-family', font);
        }
    };

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'general';

    // Helper to update specific param while keeping others if needed (though we only have 'tab' now)
    const setActiveTab = (tab) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', tab);
            return newParams;
        });
    };
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        general: { companyName: '', address: '', phone: '', countryCode: 'IN', emails: [''], logo: '', dateFormat: 'DD-MM-YYYY', timeZone: 'UTC', timeFormat: '24h', fontFamily: "'Inter', sans-serif", language: 'en-US' },
        smtp: { host: '', port: '', username: '', password: '', fromEmail: '', fromName: '', encryption: 'ssl', enabled: false },
        sms: { apiKey: '', senderId: '', templateId: '', provider: 'msg91', enabled: false },
        otp: { method: 'both', digits: 4, expiry: 10 },
        notification: {
            firebasePublicVapidKey: '', firebaseApiKey: '', firebaseAuthDomain: '', firebaseProjectId: '',
            firebaseStorageBucket: '', firebaseMessageSenderId: '', firebaseAppId: '', firebaseMeasurementId: '', serviceAccountJson: '',
            androidPackageName: '', iosBundleId: ''
        },
        storage: { activeProvider: 'local', local: { uploadPath: 'uploads/' }, cloudinary: { cloudName: '', apiKey: '', apiSecret: '' }, gcs: { bucketName: '', projectId: '', serviceAccountKeyJson: '' } },
        paymentGateways: [
            { name: 'Stripe', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false },
            { name: 'PayPal', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false },
            { name: 'Razorpay', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false }
        ],
        socialMedia: { facebook: '', instagram: '', whatsapp: '', twitter: '', linkedin: '', youtube: '' },
        ai: { activeModel: 'anthropic/claude-3.5-sonnet', consensusMode: false, listeningDuration: 5, models: { gpt4o: 'openai/gpt-4o-mini', claude: 'anthropic/claude-3.5-sonnet', deepseek: 'deepseek/deepseek-chat', groq: 'groq/llama-3.3-70b-versatile' }, geminiApiKey: '', groqApiKey: '', elevenLabsApiKey: '', elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', availableVoices: [] },
        googleCalendar: {
            clientId: '',
            clientSecret: '',
            redirectUri: `${envConfig.API_URL}/voice/google/callback`,
            enabled: false
        },
        googleAuth: {
            webClientId: '',
            webClientSecret: '',
            androidClientId: '',
            iosClientId: '',
            enabled: false
        },
        googleMaps: {
            apiKey: '',
            enabled: false
        },
        mobileApp: { appName: '', appLogo: '', splashIcon: '', androidPackageName: '', iosBundleId: '', appVersion: '1.0.0', primaryColor: '#0075ff', secondaryColor: '#ffffff', supportEmail: '', supportPhone: '' }
    });



    const [voicePrefs, setVoicePrefs] = useState({ gender: 'female', tone: 'soft' });
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    
    // Voice Preview System
    const [playingVoiceId, setPlayingVoiceId] = useState(null);
    const audioRef = useRef(null);

    const handlePlayPreview = async (voiceId, gender) => {
        if (playingVoiceId === voiceId) {
            // Stop if already playing
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setPlayingVoiceId(null);
            return;
        }

        try {
            setPlayingVoiceId(voiceId);
            
            // Request Edge TTS Proxy
            const response = await api.post('/ai/tts', {
                text: "Hello, I am your buddy AI assistant.",
                voice_id: voiceId,
                gender: gender || 'male'
            }, {
                responseType: 'blob'
            });

            const audioUrl = URL.createObjectURL(response.data);
            
            if (audioRef.current) {
                audioRef.current.pause();
                URL.revokeObjectURL(audioRef.current.src);
            }
            
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            audio.onended = () => {
                setPlayingVoiceId(null);
                URL.revokeObjectURL(audioUrl);
            };
            
            await audio.play();
        } catch (err) {
            console.error("Audio preview failed:", err);
            setPlayingVoiceId(null);
            toast.error("Failed to load audio preview");
        }
    };

    useEffect(() => {
        if (user?.voicePreferences) {
            setVoicePrefs(user.voicePreferences);
        }
    }, [user]);

    const [testEmail, setTestEmail] = useState('');
    const [testPhone, setTestPhone] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, payload: null, title: '', message: '' });

    // Local state for pending appearance changes - Moved up for correct initialization
    const [appearance, setAppearance] = useState({
        themeMode,
        accentColor,
        secondaryColor: localStorage.getItem('secondaryColor') || '#6366F1'
    });

    // Sync local state if context changes elsewhere
    useEffect(() => {
        setAppearance(prev => ({
            ...prev,
            themeMode,
            accentColor
        }));
    }, [themeMode, accentColor]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await api.get('/settings');
                if (res.data.data) {
                    const data = res.data.data;
                    console.log("Loaded Settings Data:", data);

                    const mergedSettings = {
                        general: { ...settings.general, ...(data.general || {}) },
                        smtp: { ...settings.smtp, ...(data.smtp || {}) },
                        sms: { ...settings.sms, ...(data.sms || {}) },
                        otp: { ...settings.otp, ...(data.otp || {}) },
                        notification: { ...settings.notification, ...(data.notification || {}) },
                        storage: { ...settings.storage, ...(data.storage || {}) },
                        socialMedia: { ...settings.socialMedia, ...(data.socialMedia || {}) },
                        ai: {
                            ...settings.ai,
                            ...(data.ai || {}),
                            geminiApiKey: data.ai?.geminiApiKey || '',
                            openaiApiKey: data.ai?.openaiApiKey || '',
                            claudeApiKey: data.ai?.claudeApiKey || '',
                            deepseekApiKey: data.ai?.deepseekApiKey || '',
                            groqApiKey: data.ai?.groqApiKey || '',
                            elevenLabsApiKey: data.ai?.elevenLabsApiKey || '',
                            elevenLabsVoiceId: data.ai?.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM',
                            availableVoices: data.ai?.availableVoices || []
                        },
                        googleCalendar: { ...settings.googleCalendar, ...(data.googleCalendar || {}) },
                        googleAuth: { ...settings.googleAuth, ...(data.googleAuth || {}) },
                        googleMaps: { ...settings.googleMaps, ...(data.googleMaps || {}) },
                        paymentGateways: settings.paymentGateways.map(dg => {
                            const eg = (data.paymentGateways || []).find(g => g.name === dg.name);
                            return eg ? { ...dg, ...eg } : dg;
                        }),
                        mobileApp: { ...settings.mobileApp, ...(data.mobileApp || {}) }
                    };

                    setSettings(mergedSettings);
                    if (mergedSettings.general.fontFamily) {
                        applyFont(mergedSettings.general.fontFamily);
                    }

                    // Apply Appearance from DB
                    if (data.appearance) {
                        setThemeMode(data.appearance.themeMode || 'night');
                        setAccentColor(data.appearance.accentColor || '#0075ff');
                        setAppearance(prev => ({
                            ...prev,
                            themeMode: data.appearance.themeMode || 'night',
                            accentColor: data.appearance.accentColor || '#0075ff',
                            secondaryColor: data.appearance.secondaryColor || '#6366F1'
                        }));
                    }
                }
            } catch (error) {
                console.error('Load Error:', error);
                toast.error('Failed to load settings');
            }
        };
        loadSettings();
    }, []);

    const handleUpdate = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            // Include current appearance state in the update payload
            const payload = {
                ...settings,
                appearance: {
                    themeMode: appearance.themeMode,
                    accentColor: appearance.accentColor,
                    secondaryColor: appearance.secondaryColor
                }
            };

            const res = await api.put('/settings', payload);
            if (res.data.success) {
                toast.success('Settings updated successfully');
                refreshSettings();
                fetchPublicSettings(); // Ensure public consumers also get the update

                // Update Global Theme Context immediately
                setThemeMode(appearance.themeMode);
                setAccentColor(appearance.accentColor);
                setSecondaryAccent(appearance.secondaryColor);

                // Apply font if changed
                if (settings.general.fontFamily) {
                    applyFont(settings.general.fontFamily);
                }

                // Refresh local state with saved data
                if (res.data.data) {
                    const data = res.data.data;
                    setSettings(prev => ({
                        ...prev,
                        ...data,
                        smtp: { ...prev.smtp, ...(data.smtp || {}), password: prev.smtp?.password || data.smtp?.password || '' }, // Keep current pw in field
                        ai: {
                            ...prev.ai,
                            ...(data.ai || {}),
                            geminiApiKey: prev.ai?.geminiApiKey || data.ai?.geminiApiKey || '',
                            openaiApiKey: prev.ai?.openaiApiKey || data.ai?.openaiApiKey || '',
                            claudeApiKey: prev.ai?.claudeApiKey || data.ai?.claudeApiKey || '',
                            deepseekApiKey: prev.ai?.deepseekApiKey || data.ai?.deepseekApiKey || '',
                            groqApiKey: prev.ai?.groqApiKey || data.ai?.groqApiKey || '',
                            elevenLabsApiKey: prev.ai?.elevenLabsApiKey || data.ai?.elevenLabsApiKey || '',
                            elevenLabsVoiceId: prev.ai?.elevenLabsVoiceId || data.ai?.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM'
                        },
                        googleAuth: { ...prev.googleAuth, ...(data.googleAuth || {}), webClientSecret: prev.googleAuth?.webClientSecret || data.googleAuth?.webClientSecret || '' }, // Keep secret
                        googleCalendar: { ...prev.googleCalendar, ...(data.googleCalendar || {}), clientSecret: prev.googleCalendar?.clientSecret || data.googleCalendar?.clientSecret || '' } // Keep secret
                    }));
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('logo', file);
        formData.append('general', JSON.stringify(settings.general));

        const loadToast = toast.loading('Uploading logo...');
        try {
            const res = await api.put('/settings', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setSettings(prev => ({ ...prev, general: res.data.data.general }));
                refreshSettings();
                toast.success('Logo uploaded successfully', { id: loadToast });
            }
        } catch (error) {
            console.error('Logo upload error:', error);
            toast.error(error.response?.data?.message || error.message || 'Logo upload failed', { id: loadToast });
        }
    };

    const handleRemoveLogo = () => {
        setDeleteModal({
            isOpen: true,
            type: 'logo',
            title: 'Remove Logo',
            message: 'Are you sure you want to remove the logo?'
        });
    };

    const confirmRemoveLogo = async () => {
        const loadToast = toast.loading('Removing logo...');
        try {
            const updatedGeneral = { ...settings.general, logo: '' };
            const res = await api.put('/settings', { general: updatedGeneral });
            if (res.data.success) {
                setSettings(prev => ({ ...prev, general: res.data.data.general }));
                refreshSettings();
                toast.success('Logo removed successfully', { id: loadToast });
            }
        } catch (error) {
            console.error('Logo removal error:', error);
            toast.error('Logo removal failed', { id: loadToast });
        }
    };

    const handleMobileAssetUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append(field, file);
        formData.append('mobileApp', JSON.stringify(settings.mobileApp));

        const label = field === 'mobileLogo' ? 'App Logo' : 'Splash Icon';
        const loadToast = toast.loading(`Uploading ${label}...`);
        try {
            const res = await api.put('/settings', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setSettings(prev => ({ ...prev, mobileApp: res.data.data.mobileApp }));
                refreshSettings();
                toast.success(`${label} uploaded successfully`, { id: loadToast });
            }
        } catch (error) {
            console.error(`${label} upload error:`, error);
            toast.error(error.response?.data?.message || error.message || `${label} upload failed`, { id: loadToast });
        }
    };

    const handleRemoveMobileAsset = (field) => {
        const label = field === 'appLogo' ? 'App Logo' : 'Splash Icon';
        setDeleteModal({
            isOpen: true,
            type: 'mobileAsset',
            payload: field,
            title: `Remove ${label}`,
            message: `Are you sure you want to remove the ${label.toLowerCase()}?`
        });
    };

    const confirmRemoveMobileAsset = async () => {
        const field = deleteModal.payload;
        const label = field === 'appLogo' ? 'App Logo' : 'Splash Icon';
        const loadToast = toast.loading(`Removing ${label}...`);
        try {
            const updatedMobile = { ...settings.mobileApp, [field]: '' };
            const res = await api.put('/settings', { mobileApp: updatedMobile });
            if (res.data.success) {
                setSettings(prev => ({ ...prev, mobileApp: res.data.data.mobileApp }));
                refreshSettings();
                toast.success(`${label} removed successfully`, { id: loadToast });
            }
        } catch (error) {
            console.error(`${label} removal error:`, error);
            toast.error(`${label} removal failed`, { id: loadToast });
        }
    };

    const addEmailField = () => {
        setSettings(prev => ({
            ...prev,
            general: { ...prev.general, emails: [...prev.general.emails, ''] }
        }));
    };

    const removeEmailField = (index) => {
        const newEmails = settings.general.emails.filter((_, i) => i !== index);
        setSettings(prev => ({
            ...prev,
            general: { ...prev.general, emails: newEmails }
        }));
    };

    const updateEmailField = (index, value) => {
        const newEmails = [...settings.general.emails];
        newEmails[index] = value;
        setSettings(prev => ({
            ...prev,
            general: { ...prev.general, emails: newEmails }
        }));
    };

    const handleSaveVoicePrefs = async () => {
        if (!user?._id) return;
        setLoading(true);
        try {
            const res = await api.put(`/users/${user._id}`, { voicePreferences: voicePrefs });
            if (res.data.success) {
                toast.success('Voice preferences saved');
                refreshUser();
            }
        } catch (error) {
            toast.error('Failed to save voice preferences');
        } finally {
            setLoading(false);
        }
    };


    const tabs = [
        { id: 'general', label: 'General', icon: Settings, color: 'var(--primary-color)' },
        { id: 'smtp', label: 'SMTP', icon: Mail, color: 'var(--primary-color)' },
        { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'var(--primary-color)' },
        { id: 'otp', label: 'OTP', icon: Lock, color: 'var(--primary-color)' },
        { id: 'notification', label: 'Notification', icon: Bell, color: 'var(--primary-color)' },
        { id: 'storage', label: 'Storage', icon: Database, color: 'var(--primary-color)' },
        { id: 'payments', label: 'Payments', icon: CreditCard, color: 'var(--primary-color)' },
        { id: 'social', label: 'Social', icon: Share2, color: 'var(--primary-color)' },
        { id: 'appearance', label: 'Appearance', icon: Palette, color: 'var(--primary-color)' },
        { id: 'ai', label: 'AI Engine', icon: Zap, color: 'var(--primary-color)' },
        { id: 'googleMaps', label: 'Google Maps', icon: MapPin, color: 'var(--primary-color)' },
        { id: 'integrations', label: 'Integrations', icon: Link2, color: 'var(--primary-color)' },
        { id: 'auth', label: 'Authentication', icon: ShieldCheck, color: 'var(--primary-color)' },
        { id: 'mobile', label: 'Mobile App', icon: Smartphone, color: 'var(--primary-color)' }
    ];


    const COUNTRIES = [
        { code: 'IN', name: 'India', dial: '+91', digits: 10 },
        { code: 'US', name: 'USA', dial: '+1', digits: 10 },
        { code: 'UK', name: 'UK', dial: '+44', digits: 10 },
        { code: 'AU', name: 'Australia', dial: '+61', digits: 9 },
        { code: 'JP', name: 'Japan', dial: '+81', digits: 10 },
        { code: 'CA', name: 'Canada', dial: '+1', digits: 10 },
        { code: 'DE', name: 'Germany', dial: '+49', digits: 11 },
        { code: 'FR', name: 'France', dial: '+33', digits: 9 },
        { code: 'AE', name: 'UAE', dial: '+971', digits: 9 },
        { code: 'SG', name: 'Singapore', dial: '+65', digits: 8 }
    ];

    const accentColors = [
        '#0075ff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#6d28d9', '#6b0e9b', '#6366f1', '#0ea5e9', '#06b6d4', '#22c55e', '#facc15'
    ];

    const smtpPresets = [
        { name: 'Custom', host: '', port: '' },
        { name: 'Gmail', host: 'smtp.gmail.com', port: '465' },
        { name: 'Outlook', host: 'smtp.office365.com', port: '587' },
        { name: 'SendGrid', host: 'smtp.sendgrid.net', port: '465' },
        { name: 'Mailtrap', host: 'sandbox.smtp.mailtrap.io', port: '2525' }
    ];

    const handleSmtpPreset = (preset) => {
        // Allow 'Custom' (empty host) to clear fields
        setSettings({
            ...settings,
            smtp: { ...settings.smtp, host: preset.host, port: preset.port }
        });
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
        exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
    };

    return (
        <div className="admin-settings-page" style={{ color: 'var(--text-main)' }}>
            <div className="settings-container">
                <div className="settings-tabs">
                    <div className="tabs-header" style={{ padding: '8px 12px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', opacity: 0.8 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Configuration</span>
                    </div>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={activeTab === tab.id ? 'active' : ''}
                        >
                            <div className="tab-icon-wrapper" style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '10px',
                                background: activeTab === tab.id ? '#FFFFFF' : 'var(--bg-lite)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.3s',
                                border: `1px solid ${activeTab === tab.id ? 'transparent' : 'var(--border-color)'}`
                            }}>
                                <tab.icon
                                    size={16}
                                    color={activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-main)'}
                                    style={{ opacity: activeTab === tab.id ? 1 : 0.6 }}
                                />
                            </div>
                            <span className="tab-label-text">{tab.label}</span>
                            {activeTab === tab.id && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} className="tab-chevron" />}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <form onSubmit={handleUpdate}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="settings-card"
                            style={{ minHeight: '500px' }}
                        >
                            {activeTab === 'general' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="System Configuration" icon={Globe} color="var(--primary-color)" />
                                        <p>Manage your platform's core identity, regional preferences, and administrative communication channels.</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))', gap: '32px' }}>
                                            {/* Branding & Identity Card */}
                                            <div style={{ padding: '28px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Zap size={18} color="var(--primary-color)" />
                                                    </div>
                                                    Branding & Identity
                                                </h4>

                                                <div className="branding-info-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                                    <div
                                                        onClick={() => logoInputRef.current?.click()}
                                                        style={{
                                                            width: '80px',
                                                            height: '80px',
                                                            borderRadius: '16px',
                                                            background: 'var(--bg-lite)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            overflow: 'hidden',
                                                            border: '2px dashed var(--border-color)',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}>
                                                        {settings.general.logo ? (
                                                            <img src={getImageUrl(settings.general.logo)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                        ) : (
                                                            <Upload color="var(--text-sub)" size={24} />
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        <label style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>Platform Logo</label>
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            <button onClick={() => logoInputRef.current?.click()} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Update</button>
                                                            {settings.general.logo && (
                                                                <button onClick={handleRemoveLogo} style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Remove</button>
                                                            )}
                                                        </div>
                                                        <input ref={logoInputRef} type="file" hidden onChange={handleLogoUpload} accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" />
                                                    </div>
                                                </div>

                                                <InputGroup label="System Name" value={settings.general.companyName} onChange={v => setSettings({ ...settings, general: { ...settings.general, companyName: v } })} placeholder="e.g. My Awesome App" />
                                                <InputGroup label="Physical Address" value={settings.general.address} onChange={v => setSettings({ ...settings, general: { ...settings.general, address: v } })} type="textarea" placeholder="Enter headquarters address..." />

                                                <div>
                                                    <label style={{ ...LabelStyle, marginBottom: '8px' }}>Primary Contact Number</label>
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        <div style={{ width: '130px' }}>
                                                            <CustomSelect
                                                                value={settings.general.countryCode || 'IN'}
                                                                onChange={e => setSettings({ ...settings, general: { ...settings.general, countryCode: e.target.value, phone: '' } })}
                                                                options={COUNTRIES.map(c => ({ value: c.code, label: `${c.code} (${c.dial})` }))}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <input
                                                                type="text"
                                                                style={{ ...InputStyle, height: '44px' }}
                                                                value={settings.general.phone}
                                                                onChange={e => {
                                                                    const target = COUNTRIES.find(c => c.code === (settings.general.countryCode || 'IN'));
                                                                    const val = e.target.value.replace(/\D/g, '');
                                                                    if (val.length <= target.digits) setSettings({ ...settings, general: { ...settings.general, phone: val } });
                                                                }}
                                                                placeholder="Phone digits..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Localization & Preferences Card */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                                <div style={{ padding: '28px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(52, 168, 83, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Globe size={18} color="#34A853" />
                                                        </div>
                                                        Localization & Regional
                                                    </h4>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                        <CustomSelect
                                                            label="Date Display Format"
                                                            value={settings.general.dateFormat || 'DD-MM-YYYY'}
                                                            onChange={e => setSettings({ ...settings, general: { ...settings.general, dateFormat: e.target.value } })}
                                                            options={[
                                                                { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
                                                                { value: "MM-DD-YYYY", label: "MM-DD-YYYY" },
                                                                { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                                                                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" }
                                                            ]}
                                                        />
                                                        <CustomSelect
                                                            label="Time Presentation"
                                                            value={settings.general.timeFormat || '24h'}
                                                            onChange={e => setSettings({ ...settings, general: { ...settings.general, timeFormat: e.target.value } })}
                                                            options={[
                                                                { value: "12h", label: "12H (AM/PM)" },
                                                                { value: "24h", label: "24H Global" }
                                                            ]}
                                                        />
                                                    </div>

                                                    <CustomSelect
                                                        label="Global Time Zone"
                                                        value={settings.general.timeZone || 'UTC'}
                                                        onChange={e => setSettings({ ...settings, general: { ...settings.general, timeZone: e.target.value } })}
                                                        options={[
                                                            { value: "UTC", label: "UTC (Coordinated Universal Time)" },
                                                            { value: "America/New_York", label: "Eastern Time (US & Canada)" },
                                                            { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
                                                            { value: "Asia/Kolkata", label: "India Standard Time (IST)" }
                                                        ]}
                                                    />

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                        <CustomSelect
                                                            label="System Typography"
                                                            value={settings.general.fontFamily || "'Inter', sans-serif"}
                                                            onChange={e => { setSettings({ ...settings, general: { ...settings.general, fontFamily: e.target.value } }); applyFont(e.target.value); }}
                                                            options={FONTS}
                                                        />
                                                        <CustomSelect
                                                            label="Voice Interaction"
                                                            value={settings.general.language || 'en-US'}
                                                            onChange={e => setSettings({ ...settings, general: { ...settings.general, language: e.target.value } })}
                                                            options={[
                                                                { value: 'en-US', label: 'English (US)' },
                                                                { value: 'hi-IN', label: 'Hindi (IN)' },
                                                                { value: 'ta-IN', label: 'Tamil (IN)' }
                                                            ]}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Administrative Card */}
                                                <div style={{ padding: '28px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(251, 188, 5, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Mail size={18} color="#FBBC05" />
                                                        </div>
                                                        Administrative Access
                                                    </h4>
                                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '20px' }}>Add email addresses that should receive critical system alerts and reports.</p>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {settings.general.emails.map((email, index) => (
                                                            <div key={index} style={{ display: 'flex', gap: '10px' }}>
                                                                <input
                                                                    type="email"
                                                                    style={{ ...InputStyle, flex: 1 }}
                                                                    value={email}
                                                                    onChange={(e) => updateEmailField(index, e.target.value)}
                                                                    placeholder="admin@example.com"
                                                                />
                                                                {settings.general.emails.length > 1 && (
                                                                    <button type="button" onClick={() => removeEmailField(index)} style={{ padding: '0 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'none', cursor: 'pointer' }}>
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button type="button" onClick={addEmailField} style={{ marginTop: '8px', padding: '12px', borderRadius: '12px', background: 'var(--card-bg)', color: 'var(--primary-color)', border: '1px dashed var(--primary-color)', fontSize: '0.85rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <Plus size={16} /> Add Recipient
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}


                            {activeTab === 'smtp' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="SMTP Configuration" icon={Mail} color="var(--primary-color)" />
                                        <p>Configure your email server settings to enable system notifications and user communications.</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Presets Card */}
                                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>Quick Presets</h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                {smtpPresets.map(preset => {
                                                    const isSelected = ((settings.smtp?.host || "") === preset.host) || (preset.name === 'Custom' && !smtpPresets.slice(1).some(p => p.host === settings.smtp.host));
                                                    return (
                                                        <button
                                                            key={preset.name}
                                                            type="button"
                                                            onClick={() => handleSmtpPreset(preset)}
                                                            style={{
                                                                padding: '10px 20px',
                                                                borderRadius: '12px',
                                                                border: isSelected ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                                                background: isSelected ? 'var(--primary-color)' : 'var(--card-bg)',
                                                                color: isSelected ? 'white' : 'var(--text-sub)',
                                                                cursor: 'pointer',
                                                                fontWeight: '700',
                                                                fontSize: '0.85rem',
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            {preset.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                                            {/* Connection Details */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <RefreshCw size={18} color="var(--primary-color)" /> Server Connection
                                                </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                                    <InputGroup label="Host Address" value={settings.smtp.host} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, host: v } })} placeholder="smtp.provider.com" />
                                                    <InputGroup label="Port" value={settings.smtp?.port} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, port: v } })} placeholder="465" />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <InputGroup label="Username" value={settings.smtp?.username} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, username: v } })} placeholder="Enter username" />
                                                    <InputGroup label="Password" type="password" value={settings.smtp?.password} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, password: v } })} placeholder="••••••••" />
                                                </div>
                                            </div>

                                            {/* Security & Identity */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <ShieldCheck size={18} color="var(--primary-color)" /> Sender Details
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                        <InputGroup label="From Name" value={settings.smtp?.fromName} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, fromName: v } })} placeholder="Sender Name" />
                                                        <InputGroup label="From Email" value={settings.smtp?.fromEmail} onChange={v => setSettings({ ...settings, smtp: { ...settings.smtp, fromEmail: v } })} placeholder="sender@domain.com" />
                                                    </div>

                                                    <div>
                                                        <label style={{ ...LabelStyle, marginBottom: '12px' }}>Encryption Protocol</label>
                                                        <div style={{ display: 'flex', gap: '12px', background: 'var(--card-bg)', padding: '12px', borderRadius: '15px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                                                            {['ssl', 'tls'].map(type => {
                                                                const currentEncryption = settings.smtp?.encryption || 'tls';
                                                                const isChecked = currentEncryption === type;
                                                                return (
                                                                    <label key={type} style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '8px',
                                                                        cursor: 'pointer',
                                                                        padding: '6px 16px',
                                                                        borderRadius: '10px',
                                                                        background: isChecked ? 'var(--primary-color)' : 'transparent',
                                                                        color: isChecked ? 'white' : 'var(--text-sub)',
                                                                        fontSize: '0.85rem',
                                                                        fontWeight: '700',
                                                                        transition: 'all 0.2s'
                                                                    }}>
                                                                        <input
                                                                            type="radio"
                                                                            hidden
                                                                            name="smtpEncryption"
                                                                            checked={isChecked}
                                                                            onChange={() => setSettings({ ...settings, smtp: { ...(settings.smtp || {}), encryption: type } })}
                                                                        />
                                                                        {type.toUpperCase()}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div style={{ marginTop: 'auto' }}>
                                                        <TestSection
                                                            title="Verification"
                                                            description="Confirm settings by sending a test email."
                                                            value={testEmail}
                                                            onChange={setTestEmail}
                                                            placeholder="test@example.com"
                                                            icon={Send}
                                                            onTest={async () => {
                                                                const loadToast = toast.loading('Sending test email...');
                                                                try {
                                                                    const res = await api.post('/settings/test-smtp', { smtpConfig: settings.smtp, testEmail });
                                                                    toast.success(res.data.message, { id: loadToast });
                                                                } catch (error) {
                                                                    toast.error(error.response?.data?.message || 'Failed', { id: loadToast });
                                                                }
                                                            }}
                                                            btnColor="var(--primary-color)"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}


                            {activeTab === 'sms' && (
                                <SMSSettingsComp
                                    settings={settings}
                                    setSettings={setSettings}
                                    testPhone={testPhone}
                                    setTestPhone={setTestPhone}
                                />
                            )}

                            {activeTab === 'otp' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="OTP Configuration" icon={Lock} color="#FFD700" />
                                        <p>Define the security parameters for One-Time Password verification across all supported communication channels.</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                                            {/* Logic Card */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>Verification Method</h4>
                                                <CustomSelect
                                                    label="Delivery Strategy"
                                                    value={settings.otp.method}
                                                    onChange={e => setSettings({ ...settings, otp: { ...settings.otp, method: e.target.value } })}
                                                    options={[
                                                        { value: 'sms', label: 'SMS Only' },
                                                        { value: 'email', label: 'Email Only' },
                                                        { value: 'both', label: 'Multi-Channel (Recommended)' }
                                                    ]}
                                                />
                                            </div>

                                            {/* Security Card */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '16px' }}>Security Policy</h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                    <CustomSelect
                                                        label="Code Length"
                                                        value={settings.otp.digits}
                                                        onChange={e => setSettings({ ...settings, otp: { ...settings.otp, digits: Number(e.target.value) } })}
                                                        options={[
                                                            { value: 4, label: '4 Digits' },
                                                            { value: 6, label: '6 Digits' }
                                                        ]}
                                                    />
                                                    <CustomSelect
                                                        label="TTL Duration"
                                                        value={settings.otp.expiry}
                                                        onChange={e => setSettings({ ...settings, otp: { ...settings.otp, expiry: Number(e.target.value) } })}
                                                        options={[
                                                            { value: 5, label: '5 Mins' },
                                                            { value: 10, label: '10 Mins' },
                                                            { value: 15, label: '15 Mins' }
                                                        ]}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                            <div style={{ flex: 1, minWidth: '300px' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Integration Verification</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>Trigger a diagnostics dispatch to ensure current SMTP and SMS configurations are functioning correctly.</p>
                                            </div>
                                            <TestSection
                                                value={testEmail}
                                                onChange={setTestEmail}
                                                placeholder="test@example.com"
                                                icon={Send}
                                                onTest={async () => { toast.error('Diagnostic trigger coming soon!'); }}
                                                btnColor="var(--primary-color)"
                                            />
                                        </div>
                                    </div>
                                </section>
                            )}


                            {activeTab === 'notification' && (
                                <NotificationSettings settings={settings} setSettings={setSettings} />
                            )}

                            {activeTab === 'storage' && (
                                <StorageSettings settings={settings} setSettings={setSettings} />
                            )}

                            {activeTab === 'payments' && (
                                <PaymentSettings settings={settings} setSettings={setSettings} />
                            )}

                            {activeTab === 'social' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="Social Connections" icon={Share2} color="var(--primary-color)" />
                                        <p>Link your official social media profiles to display across the site footer and contact pages.</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                        {[
                                            { id: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877F2' },
                                            { id: 'instagram', label: 'Instagram', icon: Instagram, color: '#E4405F' },
                                            { id: 'twitter', label: 'Twitter / X', icon: Twitter, color: '#1DA1F2' },
                                            { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: '#0A66C2' },
                                            { id: 'youtube', label: 'YouTube', icon: Youtube, color: '#FF0000' }
                                        ].map(social => (
                                            <div key={social.id} style={{
                                                padding: '20px',
                                                borderRadius: '20px',
                                                background: 'var(--bg-lite)',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '16px'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '10px',
                                                        background: `${social.color}15`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <social.icon size={20} color={social.color} />
                                                    </div>
                                                    <span style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-main)' }}>{social.label}</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    style={{ ...InputStyle, background: 'var(--card-bg)' }}
                                                    value={settings.socialMedia[social.id] || ''}
                                                    onChange={v => setSettings({ ...settings, socialMedia: { ...settings.socialMedia, [social.id]: v.target.value } })}
                                                    placeholder={`https://${social.id}.com/username`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {activeTab === 'appearance' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="Interface Settings" icon={Palette} color="var(--primary-color)" />
                                        <p>Personalize your administrative workspace with custom themes and branding colors.</p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                                        {/* Theme Mode Card */}
                                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Sun size={18} color="var(--primary-color)" /> Visual Mode
                                            </h4>
                                            <div style={{ display: 'flex', gap: '12px', background: 'var(--card-bg)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                                {[
                                                    { id: 'day', label: 'Classic Lite', icon: Sun },
                                                    { id: 'night', label: 'Premium Dark', icon: Moon }
                                                ].map(mode => (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setAppearance(prev => ({ ...prev, themeMode: mode.id }))}
                                                        style={{
                                                            flex: 1,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            gap: '8px',
                                                            padding: '12px',
                                                            borderRadius: '12px',
                                                            border: 'none',
                                                            background: appearance.themeMode === mode.id ? 'var(--primary-color)' : 'transparent',
                                                            color: appearance.themeMode === mode.id ? 'white' : 'var(--text-sub)',
                                                            cursor: 'pointer',
                                                            fontWeight: '700',
                                                            fontSize: '0.85rem',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <mode.icon size={16} />
                                                        {mode.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Accent Color Card */}
                                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <Zap size={18} color="var(--primary-color)" /> Branding Colors
                                            </h4>

                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                                                {/* Primary Color */}
                                                <div>
                                                    <label style={{ ...LabelStyle, fontSize: '0.75rem', marginBottom: '8px', display: 'block' }}>Primary Accent</label>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '10px',
                                                        background: 'var(--card-bg)',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <div
                                                            onClick={() => document.getElementById('primaryColorPicker').click()}
                                                            style={{ width: '32px', height: '32px', borderRadius: '8px', background: appearance.accentColor, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={appearance.accentColor?.toUpperCase()}
                                                            onChange={(e) => setAppearance(prev => ({ ...prev, accentColor: e.target.value }))}
                                                            style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', width: '80px', border: 'none', background: 'transparent', outline: 'none' }}
                                                        />
                                                        <input id="primaryColorPicker" type="color" value={appearance.accentColor} onChange={e => setAppearance(prev => ({ ...prev, accentColor: e.target.value }))} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                                                    </div>
                                                </div>

                                                {/* Secondary Color */}
                                                <div>
                                                    <label style={{ ...LabelStyle, fontSize: '0.75rem', marginBottom: '8px', display: 'block' }}>Secondary Accent</label>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '10px',
                                                        padding: '10px',
                                                        background: 'var(--card-bg)',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border-color)'
                                                    }}>
                                                        <div
                                                            onClick={() => document.getElementById('secondaryColorPicker').click()}
                                                            style={{ width: '32px', height: '32px', borderRadius: '8px', background: appearance.secondaryColor, cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={appearance.secondaryColor?.toUpperCase()}
                                                            onChange={(e) => setAppearance(prev => ({ ...prev, secondaryColor: e.target.value }))}
                                                            style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', width: '80px', border: 'none', background: 'transparent', outline: 'none' }}
                                                        />
                                                        <input id="secondaryColorPicker" type="color" value={appearance.secondaryColor} onChange={e => setAppearance(prev => ({ ...prev, secondaryColor: e.target.value }))} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Presets Row */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                                                {[
                                                    { id: 'purple', color: '#8b5cf6' },
                                                    { id: 'blue', color: '#3b82f6' },
                                                    { id: 'green', color: '#10b981' },
                                                    { id: 'orange', color: '#f59e0b' },
                                                    { id: 'rose', color: '#f43f5e' },
                                                    { id: 'cyan', color: '#06b6d4' }
                                                ].map(c => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onClick={() => setAppearance(prev => ({ ...prev, accentColor: c.color }))}
                                                        style={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: c.color,
                                                            border: appearance.accentColor === c.color ? '2px solid white' : 'none',
                                                            boxShadow: appearance.accentColor === c.color ? `0 0 0 1px ${c.color}` : 'none',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}


                            {activeTab === 'ai' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div className="admin-section-header">
                                        <SectionTitle label="AI Engine Configuration" icon={Zap} color="#FFD700" />
                                        <p>The AI Engine power all automated interactions in Buddy. Configure your preferred LLM provider and enhance response reliability through consensus.</p>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                                            {/* Primary Model Selection */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>Core Intelligence</h4>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '20px' }}>Select the primary model used for generating AI responses.</p>
                                                <CustomSelect
                                                    value={settings.ai.activeModel}
                                                    onChange={e => setSettings({ ...settings, ai: { ...settings.ai, activeModel: e.target.value } })}
                                                    options={[
                                                        { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (Recommended)' },
                                                        { value: 'openai/gpt-4o-mini', label: 'GPT-4o-mini (Fast & Efficient)' },
                                                        { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (Economic)' },
                                                        { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash (Free Tier)' },
                                                        { value: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq - Ultra Fast)' },
                                                        { value: 'openrouter/free', label: 'Smart Router (Auto-Free)' },
                                                        { value: 'google/gemini-1.5-flash-8b', label: 'Gemini Flash 1.5 (Lite)' }
                                                    ]}
                                                />
                                            </div>

                                            {/* Voice Model Selection */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>Voice Intelligence</h4>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '20px' }}>Select the model for real-time voice sessions (Gemini Live).</p>
                                                <CustomSelect
                                                    value={settings.ai.activeVoiceModel}
                                                    onChange={e => setSettings({ ...settings, ai: { ...settings.ai, activeVoiceModel: e.target.value } })}
                                                    options={[
                                                        { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Voice Optimized)' },
                                                        { value: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash (Production)' },
                                                        { value: 'gemini-pro-latest', label: 'Gemini Pro (Advanced Intelligence)' },
                                                        { value: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite (Fastest)' },
                                                        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Standard)' }
                                                    ]}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                                            {/* Gemini Key */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Gemini Pro Access</h4>
                                                    {settings.ai.geminiApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <InputGroup
                                                    label="Google Gemini Key"
                                                    type="password"
                                                    value={settings.ai.geminiApiKey || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, geminiApiKey: v } })}
                                                />
                                            </div>

                                            {/* OpenAI Key */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>OpenAI Access</h4>
                                                    {settings.ai.openaiApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <InputGroup
                                                    label="OpenAI API Key"
                                                    type="password"
                                                    value={settings.ai.openaiApiKey || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, openaiApiKey: v } })}
                                                />
                                            </div>

                                            {/* Claude Key */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Claude Access</h4>
                                                    {settings.ai.claudeApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <InputGroup
                                                    label="Anthropic Claude Key"
                                                    type="password"
                                                    value={settings.ai.claudeApiKey || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, claudeApiKey: v } })}
                                                />
                                            </div>

                                            {/* DeepSeek Key */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>DeepSeek Access</h4>
                                                    {settings.ai.deepseekApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <InputGroup
                                                    label="DeepSeek V3 Key"
                                                    type="password"
                                                    value={settings.ai.deepseekApiKey || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, deepseekApiKey: v } })}
                                                />
                                            </div>

                                            {/* Groq Key */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Groq Access (Ultra Fast)</h4>
                                                    {settings.ai.groqApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <InputGroup
                                                    label="Groq API Key"
                                                    type="password"
                                                    value={settings.ai.groqApiKey || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, groqApiKey: v } })}
                                                />
                                            </div>

                                            {/* ElevenLabs Key & Voice ID */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>ElevenLabs Voice Synthesis</h4>
                                                    {settings.ai.elevenLabsApiKey && <div style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '10px', background: '#10b981', color: 'white', fontWeight: '800' }}>ACTIVE</div>}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                                                    <InputGroup
                                                        label="ElevenLabs API Key"
                                                        type="password"
                                                        value={settings.ai.elevenLabsApiKey || ''}
                                                        onChange={v => setSettings({ ...settings, ai: { ...settings.ai, elevenLabsApiKey: v } })}
                                                    />
                                                    <InputGroup
                                                        label="Default Voice ID"
                                                        type="text"
                                                        value={settings.ai.elevenLabsVoiceId || ''}
                                                        onChange={v => setSettings({ ...settings, ai: { ...settings.ai, elevenLabsVoiceId: v } })}
                                                        placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                                                    />
                                                </div>
                                            </div>

                                            {/* Edge TTS Voices Management */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <div>
                                                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Available Voices (Edge TTS)</h4>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '4px' }}>Manage the voices users can choose from in the app.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newVoice = { name: 'New Voice', voiceId: '', gender: 'male', isDefault: false };
                                                            setSettings({ ...settings, ai: { ...settings.ai, availableVoices: [...(settings.ai.availableVoices || []), newVoice] } });
                                                        }}
                                                        style={{ padding: '8px 16px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        <Plus size={16} /> Add Voice
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                    {(!settings.ai.availableVoices || settings.ai.availableVoices.length === 0) && (
                                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.9rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>No voices configured. Defaults will be used.</div>
                                                    )}
                                                    
                                                    {settings.ai.availableVoices && settings.ai.availableVoices.length > 0 && (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.5fr) minmax(180px, 1.5fr) minmax(120px, 1fr) 140px', gap: '16px', padding: '0 16px', marginBottom: '-4px', marginTop: '8px' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Display Name</div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Voice ID</div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender</div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</div>
                                                        </div>
                                                    )}

                                                    <AnimatePresence>
                                                        {settings.ai.availableVoices?.map((voice, idx) => (
                                                            <motion.div 
                                                                key={idx}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.95 }}
                                                                transition={{ duration: 0.2 }}
                                                                style={{ 
                                                                    display: 'grid', 
                                                                    gridTemplateColumns: 'minmax(180px, 1.5fr) minmax(180px, 1.5fr) minmax(120px, 1fr) 140px', 
                                                                    gap: '16px', 
                                                                    alignItems: 'center', 
                                                                    background: 'var(--card-bg)', 
                                                                    padding: '12px 16px', 
                                                                    borderRadius: '16px', 
                                                                    border: '1px solid var(--border-color)',
                                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                                                                    position: 'relative',
                                                                    overflow: 'hidden'
                                                                }}
                                                            >
                                                                {voice.isDefault && (
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--primary-color)' }} />
                                                                )}

                                                                <input 
                                                                    type="text"
                                                                    value={voice.name}
                                                                    onChange={(e) => {
                                                                        const newVoices = [...settings.ai.availableVoices];
                                                                        newVoices[idx].name = e.target.value;
                                                                        setSettings({ ...settings, ai: { ...settings.ai, availableVoices: newVoices } });
                                                                    }}
                                                                    placeholder="e.g. Ryan (British Male)"
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        borderRadius: '10px', 
                                                                        border: '1px solid transparent', // clean look
                                                                        background: 'var(--bg-lite)', 
                                                                        color: 'var(--text-main)',
                                                                        fontSize: '0.9rem',
                                                                        fontWeight: '600',
                                                                        transition: 'all 0.2s',
                                                                        outline: 'none'
                                                                    }}
                                                                    onFocus={(e) => {
                                                                        e.target.style.borderColor = 'var(--primary-color)';
                                                                        e.target.style.background = 'var(--card-bg)';
                                                                        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent)';
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        e.target.style.borderColor = 'transparent';
                                                                        e.target.style.background = 'var(--bg-lite)';
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                />

                                                                <input 
                                                                    type="text"
                                                                    value={voice.voiceId}
                                                                    onChange={(e) => {
                                                                        const newVoices = [...settings.ai.availableVoices];
                                                                        newVoices[idx].voiceId = e.target.value;
                                                                        setSettings({ ...settings, ai: { ...settings.ai, availableVoices: newVoices } });
                                                                    }}
                                                                    placeholder="e.g. en-GB-RyanNeural"
                                                                    style={{ 
                                                                        width: '100%', 
                                                                        padding: '10px 14px', 
                                                                        borderRadius: '10px', 
                                                                        border: '1px solid transparent', 
                                                                        background: 'var(--bg-lite)', 
                                                                        color: 'var(--text-main)',
                                                                        fontSize: '0.85rem',
                                                                        fontFamily: 'monospace',
                                                                        transition: 'all 0.2s',
                                                                        outline: 'none'
                                                                    }}
                                                                    onFocus={(e) => {
                                                                        e.target.style.borderColor = 'var(--primary-color)';
                                                                        e.target.style.background = 'var(--card-bg)';
                                                                        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--primary-color) 15%, transparent)';
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        e.target.style.borderColor = 'transparent';
                                                                        e.target.style.background = 'var(--bg-lite)';
                                                                        e.target.style.boxShadow = 'none';
                                                                    }}
                                                                />

                                                                <div style={{ position: 'relative' }}>
                                                                    <select
                                                                        value={voice.gender || 'male'}
                                                                        onChange={(e) => {
                                                                            const newVoices = [...settings.ai.availableVoices];
                                                                            newVoices[idx].gender = e.target.value;
                                                                            setSettings({ ...settings, ai: { ...settings.ai, availableVoices: newVoices } });
                                                                        }}
                                                                        style={{ 
                                                                            width: '100%', 
                                                                            padding: '10px 30px 10px 14px', 
                                                                            borderRadius: '10px', 
                                                                            border: '1px solid transparent', 
                                                                            background: 'var(--bg-lite)', 
                                                                            color: 'var(--text-main)', 
                                                                            fontSize: '0.9rem', 
                                                                            fontWeight: '600',
                                                                            appearance: 'none',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s',
                                                                            outline: 'none'
                                                                        }}
                                                                        onFocus={(e) => {
                                                                            e.target.style.borderColor = 'var(--primary-color)';
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            e.target.style.borderColor = 'transparent';
                                                                        }}
                                                                    >
                                                                        <option value="male">Male</option>
                                                                        <option value="female">Female</option>
                                                                    </select>
                                                                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-sub)' }} />
                                                                </div>

                                                                {/* Actions Group */}
                                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePlayPreview(voice.voiceId, voice.gender)}
                                                                        disabled={!voice.voiceId}
                                                                        style={{ 
                                                                            width: '36px',
                                                                            height: '36px',
                                                                            borderRadius: '10px', 
                                                                            background: playingVoiceId === voice.voiceId ? 'color-mix(in srgb, var(--primary-color) 20%, transparent)' : 'var(--bg-lite)', 
                                                                            color: 'var(--primary-color)', 
                                                                            border: `1px solid ${playingVoiceId === voice.voiceId ? 'var(--primary-color)' : 'transparent'}`, 
                                                                            cursor: voice.voiceId ? 'pointer' : 'not-allowed', 
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'center', 
                                                                            opacity: voice.voiceId ? 1 : 0.5,
                                                                            transition: 'all 0.2s ease',
                                                                        }}
                                                                        onMouseOver={(e) => {
                                                                            if (voice.voiceId && playingVoiceId !== voice.voiceId) {
                                                                                e.currentTarget.style.background = 'color-mix(in srgb, var(--primary-color) 10%, transparent)';
                                                                            }
                                                                        }}
                                                                        onMouseOut={(e) => {
                                                                            if (voice.voiceId && playingVoiceId !== voice.voiceId) {
                                                                                e.currentTarget.style.background = 'var(--bg-lite)';
                                                                            }
                                                                        }}
                                                                        title={playingVoiceId === voice.voiceId ? "Stop Preview" : "Play Preview Audio"}
                                                                    >
                                                                        {playingVoiceId === voice.voiceId ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newVoices = [...settings.ai.availableVoices].map((v, i) => ({ ...v, isDefault: i === idx ? !v.isDefault : false }));
                                                                            setSettings({ ...settings, ai: { ...settings.ai, availableVoices: newVoices } });
                                                                        }}
                                                                        style={{ 
                                                                            width: '36px',
                                                                            height: '36px',
                                                                            borderRadius: '10px', 
                                                                            background: voice.isDefault ? 'var(--primary-color)' : 'var(--bg-lite)', 
                                                                            color: voice.isDefault ? 'white' : 'var(--text-sub)', 
                                                                            border: '1px solid transparent', 
                                                                            cursor: 'pointer', 
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'center', 
                                                                            transition: 'all 0.2s ease',
                                                                        }}
                                                                        onMouseOver={(e) => {
                                                                            if (!voice.isDefault) {
                                                                                e.currentTarget.style.background = 'color-mix(in srgb, var(--primary-color) 10%, transparent)';
                                                                                e.currentTarget.style.color = 'var(--primary-color)';
                                                                            }
                                                                        }}
                                                                        onMouseOut={(e) => {
                                                                            if (!voice.isDefault) {
                                                                                e.currentTarget.style.background = 'var(--bg-lite)';
                                                                                e.currentTarget.style.color = 'var(--text-sub)';
                                                                            }
                                                                        }}
                                                                        title={voice.isDefault ? "Default Voice" : "Set as Default"}
                                                                    >
                                                                        <CheckCircle2 size={16} />
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newVoices = settings.ai.availableVoices.filter((_, i) => i !== idx);
                                                                            setSettings({ ...settings, ai: { ...settings.ai, availableVoices: newVoices } });
                                                                        }}
                                                                        style={{ 
                                                                            width: '36px',
                                                                            height: '36px',
                                                                            borderRadius: '10px', 
                                                                            background: 'var(--bg-lite)', 
                                                                            color: 'var(--danger-color)', 
                                                                            border: '1px solid transparent', 
                                                                            cursor: 'pointer', 
                                                                            display: 'flex', 
                                                                            alignItems: 'center', 
                                                                            justifyContent: 'center',
                                                                            transition: 'all 0.2s ease',
                                                                        }}
                                                                        onMouseOver={(e) => {
                                                                            e.currentTarget.style.background = 'color-mix(in srgb, var(--danger-color) 10%, transparent)';
                                                                        }}
                                                                        onMouseOut={(e) => {
                                                                            e.currentTarget.style.background = 'var(--bg-lite)';
                                                                        }}
                                                                        title="Remove Voice"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                            </div>

                                        </div>

                                        {/* Consensus & Accuracy */}
                                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                                            <div style={{ flex: 1, minWidth: '300px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                    <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Multi-Model Consensus</h4>
                                                    <div style={{ padding: '4px 12px', borderRadius: '20px', background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', color: 'var(--primary-color)', fontSize: '0.65rem', fontWeight: '800' }}>ADVANCED FEATURE</div>
                                                </div>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>
                                                    Cross-verify AI output across Claude and GPT-4o models simultaneously to minimize hallucinations and ensure maximum accuracy for critical tasks.
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setSettings({ ...settings, ai: { ...settings.ai, consensusMode: !settings.ai.consensusMode } })}
                                                style={{
                                                    padding: '12px 24px',
                                                    borderRadius: '16px',
                                                    background: settings.ai.consensusMode ? 'var(--primary-color)' : 'var(--card-bg)',
                                                    color: settings.ai.consensusMode ? 'white' : 'var(--text-main)',
                                                    border: `1px solid ${settings.ai.consensusMode ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                    fontWeight: '800',
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                {settings.ai.consensusMode ? <ShieldCheck size={20} /> : <Zap size={20} />}
                                                {settings.ai.consensusMode ? 'Consensus Enabled' : 'Enable Consensus Mode'}
                                            </button>
                                        </div>
                                    </div>
                                </section>
                            )}


                            {activeTab === 'integrations' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    <GoogleCalendarSettings settings={settings} setSettings={setSettings} user={user} />
                                </div>
                            )}

                            {activeTab === 'googleMaps' && (
                                <GoogleMapsSettingsComp settings={settings} setSettings={setSettings} />
                            )}

                            {activeTab === 'auth' && (
                                <GoogleAuthSettings settings={settings} setSettings={setSettings} />
                            )}

                            {activeTab === 'mobile' && (
                                <MobileAppSettings
                                    settings={settings}
                                    setSettings={setSettings}
                                    handleAssetUpload={handleMobileAssetUpload}
                                    handleRemoveAsset={handleRemoveMobileAsset}
                                />
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                            }}
                            className="save-btn"
                        >
                            <Save size={18} />
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </form >
            </div >


            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                onConfirm={() => {
                    setDeleteModal({ ...deleteModal, isOpen: false });
                    if (deleteModal.type === 'logo') confirmRemoveLogo();
                    if (deleteModal.type === 'mobileAsset') confirmRemoveMobileAsset();
                }}
                title={deleteModal.title}
                message={deleteModal.message}
                confirmText="Remove"
            />
        </div >
    );
};

export default AdminSettings;
