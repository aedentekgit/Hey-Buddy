const Settings = require('../models/Settings');
const { sendTestEmail } = require('../services/emailService');
const { sendTestSMS } = require('../services/smsService');
const { sendPushNotification } = require('../services/notificationService');
const { uploadFileToFirebase } = require('../services/fileService');

const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne().select('+smtp.password +ai.geminiApiKey +googleAuth.webClientSecret +googleCalendar.accounts.personal.clientSecret +googleCalendar.accounts.work.clientSecret +googleCalendar.accounts.business.clientSecret');
        if (!settings) {
            settings = await Settings.create({
                general: {
                    companyName: 'Admin Dashboard',
                    address: 'Main Headquarters, Silicon Valley',
                    phone: '9876543210',
                    countryCode: 'IN',
                    emails: ['admin@example.com'],
                    dateFormat: 'DD-MM-YYYY',
                    timeZone: 'UTC',
                    timeFormat: '24h'
                },
                smtp: { host: '', port: 465, username: '', fromEmail: '', fromName: '', encryption: 'ssl' },
                sms: {
                    activeGateway: 'msg91',
                    gateways: {
                        msg91: { authKey: '', senderId: '', templateId: '', templateVariable: '', enabled: false }
                    }
                },
                otp: { method: 'both', digits: 4, expiry: 10 },
                notification: {
                    firebasePublicVapidKey: '',
                    firebaseApiKey: '',
                    firebaseAuthDomain: '',
                    firebaseProjectId: '',
                    firebaseStorageBucket: '',
                    firebaseMessageSenderId: '',
                    firebaseAppId: '',
                    firebaseMeasurementId: '',
                    serviceAccountJson: '',
                    enabled: false
                },
                storage: {
                    activeProvider: 'local',
                    local: { uploadPath: 'uploads/' },
                    cloudinary: { cloudName: '', apiKey: '', apiSecret: '' },
                    gcs: { bucketName: '', projectId: '', serviceAccountKeyJson: '' }
                },
                socialMedia: { facebook: '', instagram: '', whatsapp: '', twitter: '', linkedin: '', youtube: '', github: '' },
                isConfigured: true
            });
        }
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        const updateData = req.body;

        if (req.files) {
            updateData.general = JSON.parse(updateData.general || '{}');
            if (req.files['logo']) {
                const logoFile = req.files['logo'][0];
                const destination = `general/logo-${Date.now()}${path.extname(logoFile.originalname)}`;
                updateData.general.logo = await uploadFileToFirebase(logoFile.buffer, destination, logoFile.mimetype);
            }

            updateData.notification = JSON.parse(updateData.notification || '{}');
            if (req.files['serviceAccountJson']) {
                const saFile = req.files['serviceAccountJson'][0];
                const destination = `config/firebase-sa-${Date.now()}.json`;
                updateData.notification.serviceAccountJson = await uploadFileToFirebase(saFile.buffer, destination, saFile.mimetype);
            }

            updateData.storage = JSON.parse(updateData.storage || '{}');
            if (req.files['gcsKeyJson']) {
                const gcsFile = req.files['gcsKeyJson'][0];
                const destination = `config/gcs-key-${Date.now()}.json`;
                updateData.storage.gcs = updateData.storage.gcs || {};
                updateData.storage.gcs.serviceAccountKeyJson = await uploadFileToFirebase(gcsFile.buffer, destination, gcsFile.mimetype);
            }
        }

        if (!settings) {
            settings = new Settings(updateData);
        } else {
            // Ensure sub-objects exist
            if (!settings.general) settings.general = {};
            if (!settings.smtp) settings.smtp = {};
            if (!settings.sms) settings.sms = {};
            if (!settings.otp) settings.otp = {};
            if (!settings.notification) settings.notification = {};
            if (!settings.storage) settings.storage = {};
            if (!settings.socialMedia) settings.socialMedia = {};

            if (updateData.general) Object.assign(settings.general, updateData.general);

            if (updateData.smtp) {
                const { password, ...others } = updateData.smtp;
                Object.assign(settings.smtp, others);
                if (password) settings.smtp.password = password;
                settings.markModified('smtp');
            }

            if (updateData.sms) {
                Object.assign(settings.sms, updateData.sms);
                settings.markModified('sms');
            }

            if (updateData.socialMedia) {
                Object.assign(settings.socialMedia, updateData.socialMedia);
                settings.markModified('socialMedia');
            }

            if (updateData.paymentGateways) {
                settings.paymentGateways = updateData.paymentGateways;
                settings.markModified('paymentGateways');
            }

            if (updateData.otp) {
                Object.assign(settings.otp, updateData.otp);
                settings.markModified('otp');
            }

            if (updateData.notification) {
                Object.assign(settings.notification, updateData.notification);
                settings.markModified('notification');
            }

            if (updateData.storage) {
                // If deep merging is needed, do it here. For now simplest assign.
                // Deep merge activeProvider and provider configs
                settings.storage.activeProvider = updateData.storage.activeProvider || settings.storage.activeProvider;
                if (updateData.storage.local) Object.assign(settings.storage.local, updateData.storage.local);
                if (updateData.storage.cloudinary) Object.assign(settings.storage.cloudinary, updateData.storage.cloudinary);
                if (updateData.storage.gcs) Object.assign(settings.storage.gcs, updateData.storage.gcs);

                settings.markModified('storage');
            }

            if (updateData.ai) {
                if (!settings.ai) settings.ai = {};
                Object.assign(settings.ai, updateData.ai);
                settings.markModified('ai');
            }

            if (updateData.appearance) {
                if (!settings.appearance) settings.appearance = {};
                Object.assign(settings.appearance, updateData.appearance);
                settings.markModified('appearance');
            }

            if (updateData.googleAuth) {
                if (!settings.googleAuth) settings.googleAuth = {};
                const { webClientSecret, ...others } = updateData.googleAuth;
                Object.assign(settings.googleAuth, others);
                if (webClientSecret) settings.googleAuth.webClientSecret = webClientSecret;
                settings.markModified('googleAuth');
            }

            if (updateData.googleCalendar) {
                if (!settings.googleCalendar) settings.googleCalendar = {};

                // Handle activeAccount
                if (updateData.googleCalendar.activeAccount !== undefined) {
                    settings.googleCalendar.activeAccount = updateData.googleCalendar.activeAccount;
                }

                // Handle accounts (personal, work, business)
                if (updateData.googleCalendar.accounts) {
                    if (!settings.googleCalendar.accounts) settings.googleCalendar.accounts = {};

                    ['personal', 'work', 'business'].forEach(accountType => {
                        if (updateData.googleCalendar.accounts[accountType]) {
                            if (!settings.googleCalendar.accounts[accountType]) {
                                settings.googleCalendar.accounts[accountType] = {};
                            }

                            const { clientSecret, ...others } = updateData.googleCalendar.accounts[accountType];
                            Object.assign(settings.googleCalendar.accounts[accountType], others);

                            // Only update clientSecret if provided
                            if (clientSecret) {
                                settings.googleCalendar.accounts[accountType].clientSecret = clientSecret;
                            }
                        }
                    });
                }

                settings.markModified('googleCalendar');
            }
        }

        const { general } = settings;
        if (general?.companyName && general?.phone) {
            settings.isConfigured = true;
        }

        await settings.save();
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const testSMTP = async (req, res) => {
    const { smtpConfig, testEmail } = req.body;
    try {
        await sendTestEmail(smtpConfig, testEmail);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: `SMTP Test Failed: ${error.message}` });
    }
};

const testSMS = async (req, res) => {
    const { smsConfig, testPhone } = req.body;
    try {
        const response = await sendTestSMS(smsConfig, testPhone);
        res.json({ success: true, message: 'Test SMS sent successfully', data: response });
    } catch (error) {
        res.status(400).json({ success: false, message: `SMS Test Failed: ${error.message}` });
    }
};

const getPublicSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne().select('appearance general googleAuth.webClientId googleAuth.enabled');
        res.json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const testNotification = async (req, res) => {
    const { token, title, body } = req.body;
    try {
        await sendPushNotification(token, title || 'Test Notification', body || 'It works!');
        res.json({ success: true, message: 'Test notification sent successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: `Notification Test Failed: ${error.message}` });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    getPublicSettings,
    testSMTP,
    testSMS,
    testNotification
};
