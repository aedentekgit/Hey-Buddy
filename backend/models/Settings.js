const mongoose = require('mongoose');
const config = require('../config/env');

const settingsSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    general: {
        logo: String,
        fontFamily: { type: String, default: 'Inter' },
        companyName: { type: String, required: true },
        address: { type: String, required: true },
        phone: { type: String, required: true },
        countryCode: { type: String, default: 'IN' },
        emails: [String],
        dateFormat: { type: String, default: 'DD-MM-YYYY' },
        timeZone: { type: String, default: 'UTC' },
        timeFormat: { type: String, enum: ['12h', '24h'], default: '24h' },
        language: { type: String, default: 'en-US' }
    },
    smtp: {
        host: String,
        port: Number,
        username: String,
        password: { type: String, select: false },
        fromEmail: String,
        fromName: String,
        encryption: { type: String, enum: ['ssl', 'tls'], default: 'ssl' },
        enabled: { type: Boolean, default: false }
    },
    sms: {
        activeGateway: { type: String, default: 'msg91' },
        gateways: {
            msg91: {
                authKey: String,
                senderId: String,
                templateId: String,
                templateVariable: String,
                enabled: { type: Boolean, default: false }
            },
            twilio: {
                accountSid: String,
                authToken: String,
                fromPhone: String,
                enabled: { type: Boolean, default: false }
            },
            clickatell: {
                apiKey: String,
                enabled: { type: Boolean, default: false }
            },
            nexmo: {
                apiKey: String,
                apiSecret: String,
                from: String,
                enabled: { type: Boolean, default: false }
            },
            twofactor: {
                apiKey: String,
                enabled: { type: Boolean, default: false }
            },
            bulksms: {
                username: String,
                password: String,
                enabled: { type: Boolean, default: false }
            },
            bulksmsbd: {
                apiKey: String,
                senderId: String,
                enabled: { type: Boolean, default: false }
            },
            telesign: {
                customerId: String,
                apiKey: String,
                enabled: { type: Boolean, default: false }
            }
        }
    },
    paymentGateways: [{
        name: String,
        apiKey: String,
        apiSecret: String,
        callbackUrl: String,
        enabled: { type: Boolean, default: false }
    }],
    socialMedia: {
        facebook: String,
        instagram: String,
        whatsapp: String,
        twitter: String,
        linkedin: String,
        youtube: String,
        github: String
    },
    otp: {
        method: { type: String, enum: ['sms', 'email', 'both'], default: 'both' },
        digits: { type: Number, enum: [4, 6], default: 4 },
        expiry: { type: Number, default: 10 } // in minutes
    },
    notification: {
        firebasePublicVapidKey: String,
        firebaseApiKey: String,
        firebaseAuthDomain: String,
        firebaseProjectId: String,
        firebaseStorageBucket: String,
        firebaseMessageSenderId: String,
        firebaseAppId: String,
        firebaseMeasurementId: String,
        serviceAccountJson: String, // Path to file
        androidPackageName: String,
        iosBundleId: String,
        enabled: { type: Boolean, default: false }
    },
    storage: {
        activeProvider: { type: String, enum: ['local', 'cloudinary', 'gcs'], default: 'local' }, // local = Hostinger VPS
        local: {
            uploadPath: { type: String, default: 'uploads/' }
        },
        cloudinary: {
            cloudName: String,
            apiKey: String,
            apiSecret: String
        },
        gcs: {
            bucketName: String,
            projectId: String,
            serviceAccountKeyJson: String // Path to uploaded JSON key
        }
    },
    ai: {
        activeModel: { type: String, default: 'openai/gpt-4o-mini' },
        activeVoiceModel: { type: String, default: 'google/gemini-2.5-flash-native-audio-latest' },
        consensusMode: { type: Boolean, default: false },
        listeningDuration: { type: Number, default: 2 }, // Seconds to listen
        models: {
            gpt4o: { type: String, default: 'openai/gpt-4o-mini' },
            claude: { type: String, default: 'anthropic/claude-3.5-sonnet' },
            deepseek: { type: String, default: 'deepseek/deepseek-chat' },
            groq: { type: String, default: 'groq/llama-3.3-70b-versatile' }
        },
        geminiApiKey: { type: String, select: false },
        openaiApiKey: { type: String, select: false },
        claudeApiKey: { type: String, select: false },
        deepseekApiKey: { type: String, select: false },
        groqApiKey: { type: String, select: false },
        aiAssistantApiUrl: { type: String, default: '' },
        tokenLimit: { type: Number, default: 1000000 },
        totalTokensUsed: { type: Number, default: 0 }
    },
    googleAuth: {
        webClientId: String,
        webClientSecret: { type: String, select: false },
        androidClientId: String,
        iosClientId: String,
        enabled: { type: Boolean, default: false }
    },
    googleCalendar: {
        clientId: String,
        clientSecret: { type: String, select: false },
        redirectUri: { type: String, default: config.GOOGLE_REDIRECT_URI },
        enabled: { type: Boolean, default: false }
    },
    googleMaps: {
        apiKey: String,
        enabled: { type: Boolean, default: false }
    },
    appearance: {
        themeMode: { type: String, default: 'night' },
        accentColor: { type: String, default: '#0075ff' }
    },
    mobileApp: {
        appName: String,
        appLogo: String,
        splashIcon: String,
        androidPackageName: String,
        iosBundleId: String,
        appVersion: { type: String, default: '1.0.0' },
        latestAppVersion: { type: String, default: '1.0.0' },
        mandatoryUpdate: { type: Boolean, default: false },
        updateUrl: { type: String, default: '' },
        primaryColor: { type: String, default: '#0075ff' },
        secondaryColor: { type: String, default: '#ffffff' },
        supportEmail: String,
        supportPhone: String
    },
    isConfigured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
