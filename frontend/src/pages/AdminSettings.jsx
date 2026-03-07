import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import CustomSelect from '../components/CustomSelect'; // Import CustomSelectDropdown
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
    Settings, Mail, MessageSquare, CreditCard, Share2, Palette, Save, Plus, Trash2, Send, Upload, ChevronRight, Globe,
    Facebook, Instagram, Twitter, Linkedin, Youtube, ExternalLink, RefreshCw, CheckCircle2, ShieldCheck, Zap, Eye, EyeOff, Lock, ChevronDown, Bell, Database, Calendar, Link2,
    Sun, Moon, Volume2, Copy, FileJson, Clock, Smartphone, Image, MapPin, HardDrive, Cloud, Inbox, Cpu, Fingerprint, Layout, Key, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import voiceService from '../services/voiceService';
import { requestNotificationPermission } from '../services/notificationService';
import ConfirmationModal from '../components/ConfirmationModal';
import { getImageUrl } from '../utils/imageUrl';
import { config as envConfig } from '../config/env';

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
        ai: { activeModel: 'anthropic/claude-3.5-sonnet', consensusMode: false, listeningDuration: 5, models: { gpt4o: 'openai/gpt-4o-mini', claude: 'anthropic/claude-3.5-sonnet', deepseek: 'deepseek/deepseek-chat', groq: 'groq/llama-3.3-70b-versatile' }, geminiApiKey: '', groqApiKey: '' },
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
                            groqApiKey: data.ai?.groqApiKey || ''
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
                            groqApiKey: prev.ai?.groqApiKey || data.ai?.groqApiKey || ''
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
            toast.error('Logo upload failed', { id: loadToast });
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
            toast.error(`${label} upload failed`, { id: loadToast });
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
        <div style={{ color: 'var(--text-main)' }}>
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
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <SectionTitle label="System Configuration" icon={Globe} color="var(--primary-color)" />
                                        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                            Manage your platform's core identity, regional preferences, and administrative communication channels.
                                        </p>
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

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
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
                                                        <input ref={logoInputRef} type="file" hidden onChange={handleLogoUpload} accept="image/*" />
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                                        <div>
                                            <SectionTitle label="SMTP Configuration" icon={Mail} color="var(--primary-color)" />
                                            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                                Configure your email server settings to enable system notifications and user communications.
                                            </p>
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: settings.smtp?.enabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            border: `1px solid ${settings.smtp?.enabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                                            cursor: 'pointer'
                                        }} onClick={() => setSettings({ ...settings, smtp: { ...settings.smtp, enabled: !settings.smtp.enabled } })}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: settings.smtp?.enabled ? 'var(--success-color)' : 'var(--text-sub)' }} />
                                            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: settings.smtp?.enabled ? 'var(--success-color)' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                {settings.smtp?.enabled ? 'Service Active' : 'Service Paused'}
                                            </span>
                                        </div>
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
                                <SMSSettings
                                    settings={settings}
                                    setSettings={setSettings}
                                    testPhone={testPhone}
                                    setTestPhone={setTestPhone}
                                />
                            )}

                            {activeTab === 'otp' && (
                                <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
                                    <div style={{ marginBottom: '2rem' }}>
                                        <SectionTitle label="OTP Configuration" icon={Lock} color="#FFD700" />
                                        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                            Define the security parameters for One-Time Password verification across all supported communication channels.
                                        </p>
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
                                    <div style={{ marginBottom: '2rem' }}>
                                        <SectionTitle label="Social Connections" icon={Share2} color="var(--primary-color)" />
                                        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Link your official social media profiles to display across the site footer and contact pages.</p>
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
                                    <div style={{ marginBottom: '2.5rem' }}>
                                        <SectionTitle label="Interface Settings" icon={Palette} color="var(--primary-color)" />
                                        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Personalize your administrative workspace with custom themes and branding colors.</p>
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
                                    <div style={{ marginBottom: '2rem' }}>
                                        <SectionTitle label="AI Engine Configuration" icon={Zap} color="#FFD700" />
                                        <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '800px' }}>
                                            The AI Engine power all automated interactions in Buddy. Configure your preferred LLM provider and enhance response reliability through consensus.
                                        </p>
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
                                                        { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free Tier)' },
                                                        { value: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq - Ultra Fast)' },
                                                        { value: 'openrouter/free', label: 'Smart Router (Auto-Free)' },
                                                        { value: 'google/gemini-flash-1.5-8b', label: 'Gemini Flash 1.5 (Lite)' }
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



                                            {/* AI Assistant API URL (Python project) */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>Assistant Interface Source</h4>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '20px' }}>Enter the URL of the Python-based AI Assistant frontend (e.g., http://localhost:8000/app/). Leave empty to use default.</p>
                                                <InputGroup
                                                    label="Interface URL"
                                                    placeholder="e.g. http://localhost:8000/app/"
                                                    value={settings.ai.aiAssistantApiUrl || ''}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, aiAssistantApiUrl: v } })}
                                                />
                                            </div>

                                            {/* Token Usage Tracker */}
                                            <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Usage Statistics</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSettings({ ...settings, ai: { ...settings.ai, totalTokensUsed: 0 } })}
                                                        style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                                                    >
                                                        RESET COUNTER
                                                    </button>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div style={{ textAlign: 'left' }}>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: '700', textTransform: 'uppercase' }}>Spent</span>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{(settings.ai.totalTokensUsed || 0).toLocaleString()}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: '700', textTransform: 'uppercase' }}>Balance</span>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: (settings.ai.tokenLimit - settings.ai.totalTokensUsed) < 10000 ? '#f43f5e' : '#10b981' }}>
                                                            {Math.max(0, (settings.ai.tokenLimit || 0) - (settings.ai.totalTokensUsed || 0)).toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--border-color)', overflow: 'hidden', marginBottom: '15px' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, ((settings.ai.totalTokensUsed || 0) / (settings.ai.tokenLimit || 1000000)) * 100)}%`,
                                                        height: '100%',
                                                        background: 'var(--primary-color)',
                                                        transition: 'width 0.5s ease'
                                                    }} />
                                                </div>

                                                <InputGroup
                                                    label="Monthly Token Quota (Limit)"
                                                    type="number"
                                                    value={settings.ai.tokenLimit || 1000000}
                                                    onChange={v => setSettings({ ...settings, ai: { ...settings.ai, tokenLimit: parseInt(v) } })}
                                                />
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
                                <GoogleMapsSettings settings={settings} setSettings={setSettings} />
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
                    border-radius: 14px;
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
                    border-radius: 30px;
                    padding: 32px;
                    box-shadow: var(--card-shadow);
                    backdrop-filter: blur(20px);
                }

                @media (min-width: 768px) {
                    .save-btn {
                        width: auto !important;
                    }
                }
                .save-btn {
                    width: 100%;
                    padding: 0.8rem 2rem !important;
                    background: transparent !important;
                    border: 1px solid var(--primary-color) !important;
                    color: var(--primary-color) !important;
                    border-radius: 12px !important;
                    font-size: 0.9rem !important;
                    font-weight: 700 !important;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                    justify-content: center;
                }
                .save-btn:hover {
                    background: var(--primary-color) !important;
                    color: white !important;
                    box-shadow: 0 4px 15px color-mix(in srgb, var(--primary-color) 40%, transparent);
                }
                .btn-outline {
                    transition: all 0.2s ease;
                }
                .btn-outline:hover {
                    background: color-mix(in srgb, var(--primary-color) 10%, transparent) !important;
                    border-color: var(--primary-color) !important;
                    transform: translateY(-1px);
                }
                @media (max-width: 991px) {
                    .settings-container {
                        grid-template-columns: 1fr !important;
                        gap: 1.5rem !important;
                    }
                    .settings-tabs {
                        flex-direction: row !important;
                        overflow-x: auto;
                        padding: 8px !important;
                        border-radius: 18px !important;
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
                    .tab-label-text, .tab-chevron {
                        display: none !important;
                    }
                    .settings-tabs button {
                        padding: 10px !important;
                        gap: 0 !important;
                        justify-content: center !important;
                        min-width: 50px;
                    }
                    .tab-icon-wrapper {
                        margin: 0 !important;
                    }
                    .settings-card {
                        padding: 16px !important;
                        border-radius: 24px !important;
                    }
                    .mode-toggle-container {
                        display: flex !important;
                        width: 100%;
                        border-radius: 12px !important;
                    }
                    .mode-button {
                        flex: 1 !important;
                        justify-content: center !important;
                        padding: 10px !important;
                    }
                    .settings-grid {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                    }
                    .themes-header {
                        flex-direction: column;
                        align-items: flex-start !important;
                    }
                    .responsive-section-card {
                        padding: 1.25rem !important;
                    }
                    .responsive-grid-container {
                        padding: 1.25rem !important;
                        gap: 1.25rem !important;
                    }
                    .responsive-tab-button {
                        padding: 10px 16px !important;
                        font-size: 0.8rem !important;
                    }
                }
                @media (max-width: 480px) {
                    .settings-card {
                        padding: 10px !important;
                    }

                    .settings-tabs button {
                        padding: 8px !important;
                        min-width: 42px;
                    }
                    .responsive-section-card {
                        padding: 0.85rem !important;
                    }
                    .responsive-grid-container {
                        padding: 0.85rem !important;
                        gap: 0.85rem !important;
                    }
                    .responsive-tab-button {
                        padding: 8px 12px !important;
                        font-size: 0.75rem !important;
                        border-radius: 10px !important;
                    }
                }

                .responsive-section-card {
                    padding: 2.5rem;
                }
                .responsive-grid-container {
                    padding: 2rem;
                    gap: 2rem;
                }
            `}</style>

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

// --- Sub-components & Styles ---
const SectionTitle = ({ label, icon: Icon, color }) => (
    <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }} className="section-title-container">
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em', lineBreak: 'anywhere' }}>{label}</h3>
        </div>
    </div>
);

const InputGroup = ({ label, value, onChange, type = 'text', placeholder = '', required = false }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            <label style={LabelStyle}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
            {type === 'textarea' ? (
                <textarea
                    style={{ ...InputStyle, minHeight: '80px', fontFamily: 'inherit' }}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete="off"
                />
            ) : (
                <div style={{ position: 'relative' }}>
                    <input
                        type={inputType}
                        style={{ ...InputStyle, paddingRight: isPassword ? '40px' : '0.875rem' }}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder={placeholder}
                        required={required}
                        autoComplete="new-password"
                    />
                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-sub)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px'
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

const TestSection = ({ title, description, value, onChange, placeholder, onTest, icon: Icon, btnColor }) => (
    <section style={{ height: 'fit-content', background: 'var(--bg-color)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.4rem', color: 'var(--text-main)', fontSize: '0.85rem' }}>{title}</h4>
        <p style={{ margin: '0 0 1rem', fontSize: '0.75rem', color: 'var(--text-sub)' }}>{description}</p>
        <div style={{ marginBottom: '0.75rem' }}>
            <input style={{ ...InputStyle, background: 'var(--card-bg)' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        </div>
        <button type="button" onClick={onTest} style={{ ...AddButtonStyle, width: '100%', background: btnColor, color: 'white', border: 'none', padding: '0.5rem' }}>
            <Icon size={14} /> Test Now
        </button>
    </section>
);

const LabelStyle = {
    display: 'block',
    color: 'var(--text-sub)',
    fontSize: '0.8rem',
    fontWeight: '700',
    marginBottom: '0.6rem',
    letterSpacing: '0.02em',
};
const InputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-lite)',
    color: 'var(--text-main)',
    fontSize: '0.85rem',
    fontWeight: '500',
    outline: 'none',
    transition: 'border-color 0.1s ease',
    fontFamily: 'inherit'
};
const UploadButtonStyle = { padding: '4px 10px', background: 'var(--card-bg)', color: 'var(--primary-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', border: '1px solid var(--border-color)' };
const AddButtonStyle = { padding: '8px', background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.1s', fontSize: '0.8rem' };
const RemoveButtonStyle = { padding: '8px 12px', color: 'var(--danger-color)', background: 'color-mix(in srgb, var(--danger-color) 8%, transparent)', borderRadius: 'var(--radius-sm)', border: '1px solid color-mix(in srgb, var(--danger-color) 15%, transparent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.1s' };
const PaymentCardStyle = (enabled) => ({ padding: '1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1rem', background: enabled ? 'color-mix(in srgb, var(--primary-color) 4%, transparent)' : 'var(--card-bg)', border: '1px solid', borderColor: enabled ? 'var(--primary-color)' : 'var(--border-color)', transition: 'all 0.1s' });

// Appearance Styles
const AppearanceLabelStyle = { fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block', letterSpacing: '-0.02em' };
const ModeToggleContainer = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '1rem'
};
const ModeButtonStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 28px',
    borderRadius: '14px',
    background: active ? 'var(--primary-color)' : 'var(--bg-lite)',
    color: active ? 'white' : 'var(--text-sub)',
    fontWeight: '750',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: active ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
    boxShadow: active ? '0 4px 12px color-mix(in srgb, var(--primary-color) 25%, transparent)' : 'none'
});
const RadioOptionStyle = { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-main)' };
const RadioOuter = (active) => ({ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${active ? 'var(--primary-color)' : 'var(--border-color)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' });
const RadioInner = (active) => ({ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary-color)', transform: `scale(${active ? 1 : 0})`, transition: 'transform 0.2s' });
const SwatchStyle = (color, active) => ({
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: color,
    border: active ? '3px solid var(--bg-color)' : 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: active ? `0 0 0 2px ${color}, 0 8px 16px rgba(0,0,0,0.2)` : 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: active ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
    position: 'relative',
    outline: 'none'
});
const CheckmarkStyle = { color: 'white', fontSize: '14px', fontWeight: 'bold' };

const SMSSettings = ({ settings, setSettings, testPhone, setTestPhone }) => {
    const [activeTab, setActiveTab] = useState(settings.sms?.activeGateway || 'twilio');
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const mainTabs = [
        { id: 'twilio', label: 'Twilio' },
        { id: 'nexmo', label: 'Vonage / Nexmo' },
        { id: 'clickatell', label: 'Clickatell' }
    ];

    const moreGateways = [
        { id: 'msg91', label: 'Msg91' },
        { id: 'twofactor', label: '2Factor' },
        { id: 'bulksms', label: 'BulkSMS' },
        { id: 'bulksmsbd', label: 'BulkSMS BD' },
        { id: 'telesign', label: 'Telesign' }
    ];

    const gateways = settings.sms?.gateways || {};
    const currentConfig = gateways[activeTab] || {};

    const handleUpdate = (field, value) => {
        const updatedGateways = { ...gateways, [activeTab]: { ...currentConfig, [field]: value } };
        const updatedActive = field === 'enabled' && value === true ? activeTab : settings.sms.activeGateway;
        setSettings({ ...settings, sms: { ...settings.sms, gateways: updatedGateways, activeGateway: updatedActive } });
    };

    const isActiveGateway = settings.sms.activeGateway === activeTab;

    const renderFields = () => {
        const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' };
        switch (activeTab) {
            case 'msg91':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Msg91 Auth Key" value={currentConfig?.authKey || ''} onChange={v => handleUpdate('authKey', v)} />
                        <InputGroup label="Sender ID" value={currentConfig?.senderId || ''} onChange={v => handleUpdate('senderId', v)} />
                        <InputGroup label="Template ID" value={currentConfig?.templateId || ''} onChange={v => handleUpdate('templateId', v)} />
                        <InputGroup label="Variable Name" value={currentConfig?.templateVariable || ''} onChange={v => handleUpdate('templateVariable', v)} placeholder="OTP" />
                    </div>
                );
            case 'twilio':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Account SID" value={currentConfig?.accountSid || ''} onChange={v => handleUpdate('accountSid', v)} />
                        <InputGroup label="Auth Token" type="password" value={currentConfig?.authToken || ''} onChange={v => handleUpdate('authToken', v)} />
                        <InputGroup label="Service Number" value={currentConfig?.fromPhone || ''} onChange={v => handleUpdate('fromPhone', v)} />
                    </div>
                );
            case 'nexmo':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="API Key" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                        <InputGroup label="API Secret" type="password" value={currentConfig?.apiSecret || ''} onChange={v => handleUpdate('apiSecret', v)} />
                        <InputGroup label="Sender Label" value={currentConfig?.from || ''} onChange={v => handleUpdate('from', v)} />
                    </div>
                );
            case 'bulksms':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Portal Username" value={currentConfig?.username || ''} onChange={v => handleUpdate('username', v)} />
                        <InputGroup label="Portal Password" type="password" value={currentConfig?.password || ''} onChange={v => handleUpdate('password', v)} />
                    </div>
                );
            case 'bulksmsbd':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="API Access Token" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                        <InputGroup label="Approved Sender ID" value={currentConfig?.senderId || ''} onChange={v => handleUpdate('senderId', v)} />
                    </div>
                );
            case 'telesign':
                return (
                    <div style={gridStyle}>
                        <InputGroup label="Customer ID" value={currentConfig?.customerId || ''} onChange={v => handleUpdate('customerId', v)} />
                        <InputGroup label="API Access Key" type="password" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />
                    </div>
                );
            default:
                return <InputGroup label="Gateway API Key" value={currentConfig?.apiKey || ''} onChange={v => handleUpdate('apiKey', v)} />;
        }
    };

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                    <SectionTitle label="SMS Gateway Setup" icon={MessageSquare} color="#34D399" />
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Configure your preferred SMS provider to handle automated notifications and verification codes.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isActiveGateway ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${isActiveGateway ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                    cursor: 'pointer'
                }} onClick={() => handleUpdate('enabled', !isActiveGateway)}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isActiveGateway ? 'var(--success-color)' : 'var(--text-sub)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: isActiveGateway ? 'var(--success-color)' : 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {isActiveGateway ? 'Active Gateway' : 'Set as Primary'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Gateway Selection Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Gateway Provider</h4>
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '10px',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                More Providers <ChevronDown size={14} />
                            </button>
                            {dropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '8px',
                                    background: 'var(--card-bg)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                                    zIndex: 100,
                                    minWidth: '180px',
                                    overflow: 'hidden'
                                }}>
                                    {moreGateways.map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => { setActiveTab(tab.id); setDropdownOpen(false); }}
                                            style={{
                                                width: '100%',
                                                padding: '12px 16px',
                                                border: 'none',
                                                background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                                                color: activeTab === tab.id ? 'white' : 'var(--text-main)',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '0.85rem',
                                                fontWeight: '600',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {mainTabs.map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '12px',
                                    border: activeTab === tab.id ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    background: activeTab === tab.id ? 'var(--primary-color)' : 'var(--card-bg)',
                                    color: activeTab === tab.id ? 'white' : 'var(--text-sub)',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Configuration Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Zap size={18} color="var(--primary-color)" /> API Credentials
                    </h4>
                    {renderFields()}
                </div>

                {/* Diagnostics Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Connection Diagnostics</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>Send a test SMS to verify that your credentials and gateway connectivity are properly established.</p>
                    </div>
                    <TestSection
                        value={testPhone}
                        onChange={setTestPhone}
                        placeholder="+1234567890"
                        icon={Send}
                        onTest={async () => {
                            const loadToast = toast.loading('Sending test SMS...');
                            try {
                                await api.post('/settings/test-sms', { gateway: activeTab, config: currentConfig, testPhone });
                                toast.success('Test message sent!', { id: loadToast });
                            } catch (error) { toast.error('SMS test failed', { id: loadToast }); }
                        }}
                        btnColor="var(--primary-color)"
                    />
                </div>
            </div>
        </section>
    );
};



const GoogleMapsSettings = ({ settings, setSettings }) => {
    const [showKey, setShowKey] = useState(false);
    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <SectionTitle label="Google Maps Setup" icon={MapPin} color="#34A853" />
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Configure your Google Maps API key to enable location-based reminders and live distance calculations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>API Key</label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: settings?.googleMaps?.enabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            border: `1px solid ${settings?.googleMaps?.enabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                            cursor: 'pointer'
                        }} onClick={() => setSettings(prev => ({ ...prev, googleMaps: { ...prev.googleMaps, enabled: !prev.googleMaps?.enabled } }))}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: settings?.googleMaps?.enabled ? 'var(--success-color)' : 'var(--text-sub)'
                            }} />
                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                color: settings?.googleMaps?.enabled ? 'var(--success-color)' : 'var(--text-sub)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {settings?.googleMaps?.enabled ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '16px' }}>Provide the API key to activate Google Maps services.</p>
                    <div style={{ position: 'relative' }}>
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={settings?.googleMaps?.apiKey || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, googleMaps: { ...prev.googleMaps, apiKey: e.target.value } }))}
                            placeholder="AIzaSy..."
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                paddingRight: '40px',
                                background: 'var(--bg-lite)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '12px',
                                color: 'var(--text-main)',
                                fontSize: '0.9rem',
                                outline: 'none',
                                fontFamily: 'monospace'
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-sub)',
                                opacity: 0.7,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px'
                            }}>
                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>
            </div>

        </section>
    );
};

const GoogleCalendarSettings = ({ settings, setSettings, user }) => {
    const [subTab, setSubTab] = useState('accounts');

    const mainTabs = [
        { id: 'accounts', label: 'Manage Accounts' },
        { id: 'config', label: 'App Setup Guide' }
    ];

    const currentConfig = settings.googleCalendar || {};

    const handleUpdate = (field, value) => {
        setSettings(prev => ({
            ...prev,
            googleCalendar: { ...prev.googleCalendar, [field]: value }
        }));
    };

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                    <SectionTitle label="Google Calendar Setup" icon={Calendar} color="#4285F4" />
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Configure your Google Calendar API credentials to enable synchronization and voice-based calendar management.
                    </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {mainTabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSubTab(tab.id)}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: subTab === tab.id ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: subTab === tab.id ? 'var(--primary-color)' : 'var(--bg-lite)',
                                color: subTab === tab.id ? 'white' : 'var(--text-sub)',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {subTab === 'accounts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        {/* Credentials Card */}
                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>API Credentials</h3>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: currentConfig.enabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    border: `1px solid ${currentConfig.enabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                                    cursor: 'pointer'
                                }} onClick={() => handleUpdate('enabled', !currentConfig.enabled)}>
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: currentConfig.enabled ? 'var(--success-color)' : 'var(--text-sub)'
                                    }} />
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        color: currentConfig.enabled ? 'var(--success-color)' : 'var(--text-sub)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {currentConfig.enabled ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <InputGroup
                                    label="Client ID"
                                    value={currentConfig.clientId || ''}
                                    onChange={v => handleUpdate('clientId', v)}
                                    placeholder="Enter Google Client ID"
                                />
                                <InputGroup
                                    label="Client Secret"
                                    type="password"
                                    value={currentConfig.clientSecret || ''}
                                    onChange={v => handleUpdate('clientSecret', v)}
                                    placeholder="Enter Google Client Secret"
                                />
                            </div>
                        </div>

                        {/* Integration Card */}
                        <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Endpoint Configuration</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '20px' }}>This URI must be added to your Google Cloud Console authorized redirect URIs.</p>

                            <InputGroup
                                label="Redirect URI"
                                value={currentConfig.redirectUri || `${envConfig.API_URL}/voice/google/callback`}
                                onChange={v => handleUpdate('redirectUri', v)}
                            />
                            <div style={{
                                marginTop: '12px',
                                padding: '12px',
                                background: 'var(--card-bg)',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}>
                                <code style={{ fontSize: '0.75rem', color: 'var(--primary-color)', flex: 1, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                    {envConfig.API_URL}/voice/google/callback
                                </code>
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${envConfig.API_URL}/voice/google/callback`);
                                        toast.success('URI Copied!');
                                    }}
                                    style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', display: 'flex' }}
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Testing Tools Card */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px' }}>Testing & Verification</h3>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${currentConfig.clientId}&redirect_uri=${encodeURIComponent(currentConfig.redirectUri)}&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent`;
                                    window.open(url, '_blank');
                                    toast('Redirecting to Verification...', { icon: '🔍' });
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ExternalLink size={16} />
                                Verify Connection
                            </button>
                            <button
                                type="button"
                                onClick={() => window.open('https://console.cloud.google.com/apis/dashboard', '_blank')}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <ShieldCheck size={16} color="#4285F4" />
                                Google Cloud Console
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'config' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: '800', marginBottom: '1.5rem' }}>Step-by-Step Setup Guide</h3>
                        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '20px' }}>
                            <ol style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginLeft: '1.25rem', lineHeight: '1.8' }}>
                                <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#4285F4', fontWeight: '600' }}>Google Cloud Console</a>.</li>
                                <li>Create a new project or select an existing one.</li>
                                <li>Enable **Google Calendar API** in Library.</li>
                                <li>Go to **Credentials** and create **OAuth client ID**.</li>
                                <li>Select **Web application** type.</li>
                                <li>Add the Redirect URI from the Accounts tab.</li>
                                <li>Download the **JSON credentials** or copy the **ID** and **Secret**.</li>
                            </ol>
                        </div>
                    </div>

                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileJson size={18} color="#4285F4" />
                                Quick Import
                            </h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                Upload <code>client_secret_xxxx.json</code> to automatically fill credentials.
                            </p>
                        </div>
                        <label style={{
                            padding: '12px 24px',
                            background: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s ease'
                        }}>
                            <Upload size={18} />
                            Upload JSON File
                            <input
                                type="file"
                                hidden
                                accept=".json"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const json = JSON.parse(event.target.result);
                                            const client = json.web || json.installed;
                                            if (client) {
                                                handleUpdate('clientId', client.client_id);
                                                handleUpdate('clientSecret', client.client_secret);
                                                toast.success('Credentials imported successfully!');
                                            } else {
                                                toast.error('JSON format not recognized');
                                            }
                                        } catch (err) {
                                            toast.error('Invalid JSON file');
                                        }
                                    };
                                    reader.readAsText(file);
                                }}
                            />
                        </label>
                    </div>
                </div>
            )}
        </section>
    );
};



const NotificationSettings = ({ settings, setSettings }) => {
    const [subTab, setSubTab] = useState('web');

    const tabs = [
        { id: 'web', label: 'Project Credentials', icon: Globe },
        { id: 'backend', label: 'Cloud Messaging (FCM)', icon: ShieldCheck },
        { id: 'mobile', label: 'Mobile Reference', icon: Smartphone }
    ];

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                    <SectionTitle label="Notification Setup" icon={Bell} color="#FF6F00" />
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Configure Firebase Cloud Messaging (FCM) to deliver real-time push notifications across web and mobile platforms.
                    </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSubTab(tab.id)}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '12px',
                                border: subTab === tab.id ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: subTab === tab.id ? 'var(--primary-color)' : 'var(--bg-lite)',
                                color: subTab === tab.id ? 'white' : 'var(--text-sub)',
                                cursor: 'pointer',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            {tab.icon && <tab.icon size={16} />}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {subTab === 'web' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px' }}>Firebase Client SDK Configuration</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <InputGroup
                                    label="Public Vapid Key (Web Push)"
                                    value={settings.notification.firebasePublicVapidKey}
                                    onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebasePublicVapidKey: v } })}
                                    placeholder="Enter Vapid Key Pair"
                                />
                            </div>
                            <InputGroup label="API Key" type="password" value={settings.notification.firebaseApiKey} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseApiKey: v } })} />
                            <InputGroup label="Auth Domain" value={settings.notification.firebaseAuthDomain} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseAuthDomain: v } })} />
                            <InputGroup label="Project ID" value={settings.notification.firebaseProjectId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseProjectId: v } })} />
                            <InputGroup label="Storage Bucket" value={settings.notification.firebaseStorageBucket} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseStorageBucket: v } })} />
                            <InputGroup label="Message Sender ID" value={settings.notification.firebaseMessageSenderId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseMessageSenderId: v } })} />
                            <InputGroup label="App ID" value={settings.notification.firebaseAppId} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, firebaseAppId: v } })} />
                        </div>
                    </div>
                )}

                {subTab === 'backend' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Service Account Authorization</h4>
                            {settings.notification.serviceAccountJson && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'color-mix(in srgb, var(--success-color) 15%, transparent)', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--success-color) 30%, transparent)' }}>
                                    <CheckCircle2 size={14} color="var(--success-color)" />
                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--success-color)', textTransform: 'uppercase' }}>Key Uploaded</span>
                                </div>
                            )}
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '24px', lineHeight: '1.6' }}>
                            Upload your <code>service-account.json</code> to allow the backend server to securely dispatch push notifications.
                        </p>

                        <div style={{
                            padding: '30px',
                            background: 'var(--card-bg)',
                            borderRadius: '20px',
                            border: '2px dashed var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '16px'
                        }}>
                            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-lite)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileJson size={28} color="var(--primary-color)" />
                            </div>
                            <div>
                                <h5 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-main)', margin: '0 0 4px 0' }}>{settings.notification.serviceAccountJson ? 'JSON Key is Active' : 'Upload Service Account Key'}</h5>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)', margin: 0 }}>{settings.notification.serviceAccountJson ? 'Your server is authorized to send FBM notifications.' : 'Required for server-side push messaging.'}</p>
                            </div>
                            <label style={{
                                padding: '10px 24px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <Upload size={16} />
                                {settings.notification.serviceAccountJson ? 'Replace JSON File' : 'Select JSON File'}
                                <input
                                    type="file"
                                    hidden
                                    accept=".json"
                                    onChange={async (e) => {
                                        const file = e.target.files[0];
                                        if (!file) return;
                                        const formData = new FormData();
                                        formData.append('serviceAccountJson', file);
                                        const loadToast = toast.loading('Uploading JSON...');
                                        try {
                                            const res = await api.put('/settings', formData, {
                                                headers: { 'Content-Type': 'multipart/form-data' }
                                            });
                                            if (res.data.success) {
                                                setSettings(prev => ({ ...prev, notification: { ...prev.notification, ...res.data.data.notification } }));
                                                toast.success('Service Account JSON uploaded', { id: loadToast });
                                            }
                                        } catch (error) { toast.error('Upload failed', { id: loadToast }); }
                                    }}
                                />
                            </label>
                        </div>
                    </div>
                )}

                {subTab === 'mobile' && (
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Smartphone size={18} color="var(--primary-color)" /> Platform Identifiers
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <InputGroup label="Android Package Name" value={settings.notification.androidPackageName || ''} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, androidPackageName: v } })} placeholder="com.company.app" />
                            <InputGroup label="iOS Bundle ID" value={settings.notification.iosBundleId || ''} onChange={v => setSettings({ ...settings, notification: { ...settings.notification, iosBundleId: v } })} placeholder="com.company.app" />
                        </div>
                    </div>
                )}

                {/* Testing Section */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ flex: 1, minWidth: '300px' }}>
                            <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>Connectivity Diagnostics</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>Perform a loopback test to ensure your FCM credentials and network connection are valid.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={async () => {
                                    const loadToast = toast.loading('Generating token...');
                                    const token = await requestNotificationPermission();
                                    if (token) {
                                        navigator.clipboard.writeText(token);
                                        toast.success('Token copied! Use it in the test below.', { id: loadToast });
                                    } else {
                                        toast.error('Permission denied.', { id: loadToast });
                                    }
                                }}
                                style={{
                                    padding: '10px 18px',
                                    borderRadius: '12px',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-main)',
                                    border: '1px solid var(--border-color)',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Copy size={16} /> Get My Token
                            </button>
                            {subTab !== 'backend' && !settings.notification.serviceAccountJson && (
                                <div style={{ marginRight: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255, 171, 0, 0.1)', borderRadius: '10px', border: '1px solid rgba(255, 171, 0, 0.2)' }}>
                                    <AlertTriangle size={14} color="#ffab00" />
                                    <span style={{ fontSize: '0.75rem', color: '#ffab00', fontWeight: '700' }}>Missing Service Key</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!settings.notification.serviceAccountJson) {
                                        toast.error('Please upload Service Account JSON in the Cloud Messaging tab first.');
                                        setSubTab('backend');
                                        return;
                                    }
                                    const token = prompt("Enter Firebase Token (or paste your copied token):");
                                    if (!token) return;
                                    const loadToast = toast.loading('Sending test...');
                                    try {
                                        await api.post('/settings/test-notification', { token, title: 'Buddy Test', body: 'Push notifications working! 🚀' });
                                        toast.success('Notification sent!', { id: loadToast });
                                    } catch (error) {
                                        const errMsg = error.response?.data?.message || 'Test failed';
                                        toast.error(errMsg, { id: loadToast });
                                    }
                                }}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '12px',
                                    background: 'var(--primary-color)',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Send size={16} /> Test Connection
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};


const StorageSettings = ({ settings, setSettings }) => {
    const [subTab, setSubTab] = useState('local');

    const tabs = [
        { id: 'local', label: 'Local (VPS)', icon: HardDrive },
        { id: 'cloudinary', label: 'Cloudinary', icon: Cloud },
        { id: 'gcs', label: 'Google Cloud', icon: Globe }
    ];

    const isActive = (provider) => settings.storage.activeProvider === provider;

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <SectionTitle label="Storage Configuration" icon={Database} color="var(--primary-color)" />
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Select your preferred file storage provider. Active provider handles all user uploads and system assets.
                </p>
            </div>

            {/* Provider Selection */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{ ...LabelStyle, marginBottom: '16px', display: 'block' }}>Active Storage Provider</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSubTab(tab.id)}
                            style={{
                                padding: '14px 24px',
                                borderRadius: '16px',
                                border: subTab === tab.id ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: subTab === tab.id ? 'var(--primary-color)' : 'var(--bg-lite)',
                                color: subTab === tab.id ? 'white' : 'var(--text-sub)',
                                cursor: 'pointer',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: subTab === tab.id ? '0 8px 20px color-mix(in srgb, var(--primary-color) 25%, transparent)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                            {isActive(tab.id) && (
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: subTab === tab.id ? 'white' : '#10b981',
                                    marginLeft: '4px'
                                }} />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Config Content */}
            <div style={{ padding: '32px', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'var(--bg-lite)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                        <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: '800' }}>
                            {tabs.find(t => t.id === subTab)?.label} Settings
                        </h3>
                        {isActive(subTab) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>Active Provider</span>
                            </div>
                        ) : (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: '6px 0 0' }}>Method Configured (Inactive)</p>
                        )}
                    </div>

                    {!isActive(subTab) && (
                        <button
                            type="button"
                            onClick={() => setSettings({ ...settings, storage: { ...settings.storage, activeProvider: subTab } })}
                            style={{
                                padding: '10px 24px',
                                borderRadius: '50px',
                                background: 'transparent',
                                border: '1.5px solid var(--primary-color)',
                                color: 'var(--primary-color)',
                                fontSize: '0.85rem',
                                fontWeight: '800',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--primary-color)';
                                e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--primary-color)';
                            }}
                        >
                            Activate Provider
                        </button>
                    )}
                    {isActive(subTab) && (
                        <div style={{
                            padding: '8px 20px',
                            borderRadius: '50px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#10b981',
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <ShieldCheck size={16} /> Primary
                        </div>
                    )}
                </div>

                {subTab === 'local' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Stored on the local file system of your VPS. Ideal for high performance and low latency.
                        </p>
                        <InputGroup
                            label="Local Storage Directory"
                            value={settings.storage.local.uploadPath}
                            onChange={v => setSettings({ ...settings, storage: { ...settings.storage, local: { ...settings.storage.local, uploadPath: v } } })}
                            placeholder="e.g., uploads/"
                            icon={HardDrive}
                        />
                    </div>
                )}

                {subTab === 'cloudinary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Professional media management and CDN delivery.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <InputGroup
                                label="Cloud Name"
                                value={settings.storage.cloudinary.cloudName}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, cloudName: v } } })}
                            />
                            <InputGroup
                                label="API Key"
                                value={settings.storage.cloudinary.apiKey}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, apiKey: v } } })}
                            />
                            <InputGroup
                                label="API Secret"
                                type="password"
                                value={settings.storage.cloudinary.apiSecret}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, cloudinary: { ...settings.storage.cloudinary, apiSecret: v } } })}
                            />
                        </div>
                    </div>
                )}

                {subTab === 'gcs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: 0 }}>
                            Enterprise-grade object storage with global scalability.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                            <InputGroup
                                label="Bucket Name"
                                value={settings.storage.gcs.bucketName}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, bucketName: v } } })}
                            />
                            <InputGroup
                                label="Project ID"
                                value={settings.storage.gcs.projectId}
                                onChange={v => setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, projectId: v } } })}
                            />
                        </div>

                        <div style={{ marginTop: '1rem', padding: '24px', background: 'var(--card-bg)', borderRadius: '20px', border: '1px dotted var(--border-color)' }}>
                            <label style={{ ...LabelStyle, marginBottom: '12px', display: 'block' }}>Service Account Key (.json)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    {settings.storage.gcs.serviceAccountKey ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#10b981', fontWeight: '750' }}>
                                            <ShieldCheck size={20} /> Key Uploaded Successfully
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0 }}>No key file uploaded. Required for GCS access.</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('gcs-key-upload').click()}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'var(--primary-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontSize: '0.85rem',
                                        fontWeight: '800',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {settings.storage.gcs.serviceAccountKey ? 'Update Key' : 'Upload Key'}
                                </button>
                                <input
                                    id="gcs-key-upload"
                                    type="file"
                                    accept=".json"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const file = e.target.files[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const json = JSON.parse(event.target.result);
                                                    setSettings({ ...settings, storage: { ...settings.storage, gcs: { ...settings.storage.gcs, serviceAccountKey: json } } });
                                                } catch (err) {
                                                    alert('Invalid JSON file');
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

            </div >
        </section >
    );
};

const PaymentSettings = ({ settings, setSettings }) => {
    const [activeGatewayName, setActiveGatewayName] = useState('Stripe');

    // Helper to get index of active gateway
    const activeIndex = settings.paymentGateways.findIndex(g => g.name === activeGatewayName);
    const activeGateway = settings.paymentGateways[activeIndex] || settings.paymentGateways[0];

    const getIcon = (name) => {
        switch (name) {
            case 'Stripe': return ShieldCheck;
            case 'PayPal': return CreditCard;
            case 'Razorpay': return Zap;
            default: return CreditCard;
        }
    };

    const getColor = (name) => {
        switch (name) {
            case 'Stripe': return '#6366f1';
            case 'PayPal': return '#0070ba';
            case 'Razorpay': return '#2b3bca';
            default: return 'var(--primary-color)';
        }
    };

    const ActiveIcon = getIcon(activeGateway.name);

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <SectionTitle label="Payment Gateways" icon={CreditCard} color="var(--primary-color)" />
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Configure secure checkout options for your platform. Enable multiple gateways to provide flexible payment methods to your customers.
                </p>
            </div>

            {/* Provider Tabs */}
            <div style={{ marginBottom: '2rem' }}>
                <label style={{ ...LabelStyle, marginBottom: '16px', display: 'block' }}>Select Gateway to Configure</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {settings.paymentGateways.map(gateway => {
                        const Icon = getIcon(gateway.name);
                        return (
                            <button
                                key={gateway.name}
                                type="button"
                                onClick={() => setActiveGatewayName(gateway.name)}
                                style={{
                                    padding: '14px 28px',
                                    borderRadius: '16px',
                                    border: activeGatewayName === gateway.name ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                                    background: activeGatewayName === gateway.name ? 'var(--primary-color)' : 'var(--bg-lite)',
                                    color: activeGatewayName === gateway.name ? 'white' : 'var(--text-sub)',
                                    cursor: 'pointer',
                                    fontWeight: '800',
                                    fontSize: '0.9rem',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: activeGatewayName === gateway.name ? '0 8px 20px color-mix(in srgb, var(--primary-color) 25%, transparent)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}
                            >
                                <Icon size={18} color={activeGatewayName === gateway.name ? 'white' : getColor(gateway.name)} />
                                {gateway.name}
                                {gateway.enabled && (
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        background: activeGatewayName === gateway.name ? 'white' : '#10b981',
                                        marginLeft: '4px'
                                    }} />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Gateway Configuration Body */}
            <div style={{ padding: '32px', border: '1px solid var(--border-color)', borderRadius: '24px', background: 'var(--bg-lite)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ActiveIcon size={24} color={getColor(activeGateway.name)} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-main)', fontWeight: '800' }}>
                                {activeGateway.name} Integration
                            </h3>
                            {activeGateway.enabled ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>Active & Ready</span>
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: '6px 0 0' }}>Configuration Pending (Disabled)</p>
                            )}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].enabled = !ng[activeIndex].enabled;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        style={{
                            padding: '10px 24px',
                            borderRadius: '50px',
                            background: activeGateway.enabled ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            color: activeGateway.enabled ? '#ef4444' : 'var(--primary-color)',
                            border: activeGateway.enabled ? '1.5px solid rgba(239, 68, 68, 0.2)' : '1.5px solid var(--primary-color)',
                            fontSize: '0.85rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {activeGateway.enabled ? 'Disable Gateway' : 'Enable Gateway'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ padding: '16px 20px', background: 'color-mix(in srgb, var(--primary-color) 5%, transparent)', borderLeft: '4px solid var(--primary-color)', borderRadius: '8px' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.6', fontWeight: '500' }}>
                                {activeGateway.name === 'Razorpay' ?
                                    'Scale your business in India with India\'s most reliable payment gateway. Supports UPI, All major cards, Netbanking, and Wallets.' :
                                    activeGateway.name === 'Stripe' ?
                                        'Accept payments globally with Stripe\'s unified API. Supports high-converting checkout experiences, Apple Pay, Google Pay, and localized methods.' :
                                        'Connect with over 400 million active users worldwide. Trusted online payment processing with built-in fraud protection.'}
                            </p>
                        </div>
                    </div>

                    <InputGroup
                        label={activeGateway.name === 'PayPal' ? 'Client ID' : 'Public / API Key'}
                        value={activeGateway.apiKey}
                        onChange={v => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].apiKey = v;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        placeholder={`Enter your ${activeGateway.name} production key`}
                    />
                    <InputGroup
                        label={activeGateway.name === 'PayPal' ? 'Secret Key' : 'Secret / Private Key'}
                        type="password"
                        value={activeGateway.apiSecret}
                        onChange={v => {
                            const ng = [...settings.paymentGateways];
                            ng[activeIndex].apiSecret = v;
                            setSettings({ ...settings, paymentGateways: ng });
                        }}
                        placeholder={`Enter your ${activeGateway.name} secret key`}
                    />
                </div>
            </div>
        </section>
    );
};


const GoogleAuthSettings = ({ settings, setSettings }) => {
    const handleUpdate = (field, value) => {
        const cleanValue = typeof value === 'string' ? value.trim() : value;
        setSettings({
            ...settings,
            googleAuth: {
                ...settings.googleAuth,
                [field]: cleanValue
            }
        });
    };

    const isEnabled = settings.googleAuth.enabled;

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <SectionTitle label="Google Authentication" icon={ShieldCheck} color="var(--primary-color)" />
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '600px' }}>
                        Configure Google OAuth credentials to enable secure, unified sign-in across your Web, Android, and iOS applications.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: isEnabled ? 'color-mix(in srgb, var(--success-color) 15%, transparent)' : 'color-mix(in srgb, var(--text-sub) 15%, transparent)',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    border: `1px solid ${isEnabled ? 'color-mix(in srgb, var(--success-color) 30%, transparent)' : 'color-mix(in srgb, var(--text-sub) 20%, transparent)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }} onClick={() => handleUpdate('enabled', !isEnabled)}>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isEnabled ? 'var(--success-color)' : 'var(--text-sub)'
                    }} />
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '800',
                        color: isEnabled ? 'var(--success-color)' : 'var(--text-sub)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {isEnabled ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Web Configuration Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex' }}>
                            <Globe size={18} color="var(--primary-color)" />
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Web Configuration</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <InputGroup
                            label="Web Client ID"
                            value={settings.googleAuth.webClientId}
                            onChange={v => handleUpdate('webClientId', v)}
                            placeholder="Enter Google Web Client ID"
                        />
                        <InputGroup
                            label="Web Client Secret"
                            type="password"
                            value={settings.googleAuth.webClientSecret}
                            onChange={v => handleUpdate('webClientSecret', v)}
                            placeholder="Enter Google Web Client Secret"
                        />
                    </div>
                </div>

                {/* Mobile Platforms Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <div style={{ padding: '8px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex' }}>
                            <Zap size={18} color="var(--primary-color)" />
                        </div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Mobile Platforms</h4>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <InputGroup
                            label="Android Client ID"
                            value={settings.googleAuth.androidClientId}
                            onChange={v => handleUpdate('androidClientId', v)}
                            placeholder="Android Client ID from Console"
                        />
                        <InputGroup
                            label="iOS Client ID"
                            value={settings.googleAuth.iosClientId}
                            onChange={v => handleUpdate('iosClientId', v)}
                            placeholder="iOS Client ID from Console"
                        />
                    </div>
                </div>
            </div>


        </section>
    );
};


const MobileAppSettings = ({ settings, setSettings, handleAssetUpload, handleRemoveAsset }) => {
    const mobileLogoInputRef = useRef(null);
    const splashIconInputRef = useRef(null);

    const handleUpdate = (field, value) => {
        setSettings({
            ...settings,
            mobileApp: { ...settings.mobileApp, [field]: value }
        });
    };

    const AssetUploadBox = ({ label, value, onRemove, inputRef, fieldForUpload, hint }) => (
        <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={{ ...LabelStyle, marginBottom: '12px' }}>{label}</label>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                padding: '16px',
                background: 'var(--card-bg)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                transition: 'all 0.3s ease'
            }}>
                <div
                    onClick={() => inputRef.current?.click()}
                    style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '14px',
                        background: 'var(--bg-lite)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'all 0.2s',
                        flexShrink: 0
                    }}>
                    {value ? (
                        <img
                            src={getImageUrl(value)}
                            alt={label}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <Image color="var(--text-sub)" size={20} style={{ opacity: 0.5 }} />
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-sub)', fontWeight: '800' }}>SVG/PNG</span>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Upload size={14} />
                            Upload
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={onRemove}
                                style={{
                                    padding: '8px 14px',
                                    borderRadius: '10px',
                                    background: 'transparent',
                                    color: 'var(--danger-color)',
                                    border: '1px solid var(--danger-color)',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                    {hint && <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: '500' }}>{hint}</span>}
                    <input
                        ref={inputRef}
                        type="file"
                        hidden
                        onChange={(e) => handleAssetUpload(e, fieldForUpload)}
                        accept="image/*"
                    />
                </div>
            </div>
        </div>
    );

    return (
        <section className="settings-section-card responsive-section-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '30px', padding: '32px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <SectionTitle label="Mobile App Branding" icon={Smartphone} color="var(--primary-color)" />
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    Customize the appearance and identity of your mobile application for Android and iOS platforms.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Branding & Visuals Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Palette size={18} color="var(--primary-color)" /> Visual Identity
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                        <AssetUploadBox
                            label="App Icon"
                            value={settings.mobileApp.appLogo}
                            onRemove={() => handleRemoveAsset('appLogo')}
                            inputRef={mobileLogoInputRef}
                            fieldForUpload="mobileLogo"
                            hint="Recommended: 1024x1024 px PNG/SVG"
                        />
                        <AssetUploadBox
                            label="Splash Screen Icon"
                            value={settings.mobileApp.splashIcon}
                            onRemove={() => handleRemoveAsset('splashIcon')}
                            inputRef={splashIconInputRef}
                            fieldForUpload="splashIcon"
                            hint="Recommended: 512x512 px Optimized"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ ...LabelStyle, marginBottom: '8px' }}>Theme Primary Color</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--card-bg)', padding: '10px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                <div
                                    onClick={() => document.getElementById('mobilePrimaryColorPicker').click()}
                                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: settings.mobileApp.primaryColor || '#0075ff', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                />
                                <input
                                    type="text"
                                    value={settings.mobileApp.primaryColor?.toUpperCase()}
                                    onChange={(e) => handleUpdate('primaryColor', e.target.value)}
                                    style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', flex: 1, border: 'none', background: 'transparent', outline: 'none' }}
                                />
                                <input id="mobilePrimaryColorPicker" type="color" value={settings.mobileApp.primaryColor || '#0075ff'} onChange={e => handleUpdate('primaryColor', e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                            </div>
                        </div>
                        <div>
                            <label style={{ ...LabelStyle, marginBottom: '8px' }}>Theme Secondary Color</label>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--card-bg)', padding: '10px', borderRadius: '15px', border: '1px solid var(--border-color)' }}>
                                <div
                                    onClick={() => document.getElementById('mobileSecondaryColorPicker').click()}
                                    style={{ width: '32px', height: '32px', borderRadius: '8px', background: settings.mobileApp.secondaryColor || '#ffffff', cursor: 'pointer', border: '1px solid var(--border-color)' }}
                                />
                                <input
                                    type="text"
                                    value={settings.mobileApp.secondaryColor?.toUpperCase()}
                                    onChange={(e) => handleUpdate('secondaryColor', e.target.value)}
                                    style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700', fontFamily: 'monospace', flex: 1, border: 'none', background: 'transparent', outline: 'none' }}
                                />
                                <input id="mobileSecondaryColorPicker" type="color" value={settings.mobileApp.secondaryColor || '#ffffff'} onChange={e => handleUpdate('secondaryColor', e.target.value)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Basic Info & Versioning */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Smartphone size={18} color="var(--primary-color)" /> General Information
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <InputGroup
                                label="App Name"
                                value={settings.mobileApp.appName}
                                onChange={v => handleUpdate('appName', v)}
                                placeholder="e.g. Buddy AI"
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <InputGroup
                                    label="Build Version"
                                    value={settings.mobileApp.appVersion}
                                    onChange={v => handleUpdate('appVersion', v)}
                                    placeholder="1.0.0"
                                />
                                <InputGroup
                                    label="Latest Release"
                                    value={settings.mobileApp.latestAppVersion}
                                    onChange={v => handleUpdate('latestAppVersion', v)}
                                    placeholder="1.0.1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Platform Identification */}
                    <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <ShieldCheck size={18} color="var(--primary-color)" /> Platform IDs
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <InputGroup
                                label="Android Package Name"
                                value={settings.mobileApp.androidPackageName}
                                onChange={v => handleUpdate('androidPackageName', v)}
                                placeholder="com.company.app"
                            />
                            <InputGroup
                                label="iOS Bundle Identifier"
                                value={settings.mobileApp.iosBundleId}
                                onChange={v => handleUpdate('iosBundleId', v)}
                                placeholder="com.company.app"
                            />
                        </div>
                    </div>
                </div>

                {/* Updates & Distribution Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <RefreshCw size={18} color="var(--primary-color)" /> Distribution & Updates
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        <InputGroup
                            label="APK Download / Update URL"
                            value={settings.mobileApp.updateUrl}
                            onChange={v => handleUpdate('updateUrl', v)}
                            placeholder="https://example.com/builds/app.apk"
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ ...LabelStyle, marginBottom: 0 }}>Update Enforcement</label>
                            <CustomSelect
                                value={settings.mobileApp.mandatoryUpdate ? 'true' : 'false'}
                                onChange={e => handleUpdate('mandatoryUpdate', e.target.value === 'true')}
                                options={[
                                    { value: 'false', label: 'Optional Update (User Choice)' },
                                    { value: 'true', label: 'Mandatory Update (Blocking)' }
                                ]}
                            />
                        </div>
                    </div>
                </div>
                {/* Support Information Card */}
                <div style={{ padding: '24px', background: 'var(--bg-lite)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Mail size={18} color="var(--primary-color)" /> Support Information
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        <InputGroup
                            label="Mobile Support Email"
                            value={settings.mobileApp.supportEmail}
                            onChange={v => handleUpdate('supportEmail', v)}
                            placeholder="app-support@company.com"
                            icon={Mail}
                        />
                        <InputGroup
                            label="Mobile Support Phone"
                            value={settings.mobileApp.supportPhone}
                            onChange={v => handleUpdate('supportPhone', v)}
                            placeholder="+1 234 567 890"
                            icon={Smartphone}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AdminSettings;
