// Shared constants for AdminSettings

export const FONTS = [
    { value: "'Inter', sans-serif", label: "Inter (Modern)" },
    { value: "'Poppins', sans-serif", label: "Poppins (Rounded)" },
    { value: "'Outfit', sans-serif", label: "Outfit (Professional)" },
    { value: "'Lexend', sans-serif", label: "Lexend (Clean)" },
    { value: "'Public Sans', sans-serif", label: "Public Sans (SaaS)" },
    { value: "'Sora', sans-serif", label: "Sora (Unique)" },
    { value: "'Roboto', sans-serif", label: "Roboto (Classic)" }
];

export const COUNTRIES = [
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

export const ACCENT_COLORS = [
    '#0075ff', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899',
    '#8b5cf6', '#6d28d9', '#6b0e9b', '#6366f1', '#0ea5e9', '#06b6d4', '#22c55e', '#facc15'
];

export const SMTP_PRESETS = [
    { name: 'Custom', host: '', port: '' },
    { name: 'Gmail', host: 'smtp.gmail.com', port: '465' },
    { name: 'Outlook', host: 'smtp.office365.com', port: '587' },
    { name: 'SendGrid', host: 'smtp.sendgrid.net', port: '465' },
    { name: 'Mailtrap', host: 'sandbox.smtp.mailtrap.io', port: '2525' }
];

export const DEFAULT_SETTINGS = {
    general: {
        companyName: '', address: '', phone: '', countryCode: 'IN', emails: [''],
        logo: '', dateFormat: 'DD-MM-YYYY', timeZone: 'UTC', timeFormat: '24h',
        fontFamily: "'Inter', sans-serif", language: 'en-US'
    },
    smtp: { host: '', port: '', username: '', password: '', fromEmail: '', fromName: '', encryption: 'ssl', enabled: false },
    sms: { apiKey: '', senderId: '', templateId: '', provider: 'msg91', enabled: false },
    otp: { method: 'both', digits: 4, expiry: 10 },
    notification: {
        firebasePublicVapidKey: '', firebaseApiKey: '', firebaseAuthDomain: '',
        firebaseProjectId: '', firebaseStorageBucket: '', firebaseMessageSenderId: '',
        firebaseAppId: '', firebaseMeasurementId: '', serviceAccountJson: '',
        androidPackageName: '', iosBundleId: ''
    },
    storage: {
        activeProvider: 'local',
        local: { uploadPath: 'uploads/' },
        cloudinary: { cloudName: '', apiKey: '', apiSecret: '' },
        gcs: { bucketName: '', projectId: '', serviceAccountKeyJson: '' }
    },
    paymentGateways: [
        { name: 'Stripe', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false },
        { name: 'PayPal', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false },
        { name: 'Razorpay', apiKey: '', apiSecret: '', callbackUrl: '', enabled: false }
    ],
    socialMedia: { facebook: '', instagram: '', whatsapp: '', twitter: '', linkedin: '', youtube: '' },
    ai: {
        activeModel: 'anthropic/claude-3.5-sonnet', consensusMode: false, listeningDuration: 5,
        models: { gpt4o: 'openai/gpt-4o-mini', claude: 'anthropic/claude-3.5-sonnet', deepseek: 'deepseek/deepseek-chat', groq: 'groq/llama-3.3-70b-versatile' },
        geminiApiKey: '', groqApiKey: '', elevenLabsApiKey: '', elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', availableVoices: []
    },
    googleCalendar: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    googleAuth: { webClientId: '', webClientSecret: '', androidClientId: '', iosClientId: '', enabled: false },
    googleMaps: { apiKey: '', enabled: false },
    mobileApp: {
        appName: '', appLogo: '', splashIcon: '', androidPackageName: '', iosBundleId: '',
        appVersion: '1.0.0', primaryColor: '#0075ff', secondaryColor: '#ffffff', supportEmail: '', supportPhone: ''
    }
};

export const TABS = [
    { id: 'general', label: 'General', icon: 'Settings', color: 'var(--primary-color)' },
    { id: 'smtp', label: 'SMTP', icon: 'Mail', color: 'var(--primary-color)' },
    { id: 'sms', label: 'SMS', icon: 'MessageSquare', color: 'var(--primary-color)' },
    { id: 'otp', label: 'OTP', icon: 'Lock', color: 'var(--primary-color)' },
    { id: 'notification', label: 'Notification', icon: 'Bell', color: 'var(--primary-color)' },
    { id: 'storage', label: 'Storage', icon: 'Database', color: 'var(--primary-color)' },
    { id: 'payments', label: 'Payments', icon: 'CreditCard', color: 'var(--primary-color)' },
    { id: 'social', label: 'Social', icon: 'Share2', color: 'var(--primary-color)' },
    { id: 'appearance', label: 'Appearance', icon: 'Palette', color: 'var(--primary-color)' },
    { id: 'ai', label: 'AI Engine', icon: 'Zap', color: 'var(--primary-color)' },
    { id: 'googleMaps', label: 'Google Maps', icon: 'MapPin', color: 'var(--primary-color)' },
    { id: 'integrations', label: 'Integrations', icon: 'Link2', color: 'var(--primary-color)' },
    { id: 'auth', label: 'Authentication', icon: 'ShieldCheck', color: 'var(--primary-color)' },
    { id: 'mobile', label: 'Mobile App', icon: 'Smartphone', color: 'var(--primary-color)' }
];