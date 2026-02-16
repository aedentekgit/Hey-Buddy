const Settings = require('../models/Settings');
const path = require('path');
const { sendTestEmail } = require('../services/emailService');
const { sendTestSMS } = require('../services/smsService');
const { sendPushNotification } = require('../services/notificationService');
const { uploadFile } = require('../services/fileService');

const getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne().select('+smtp.password +googleAuth.webClientSecret +ai.geminiApiKey +googleCalendar.accounts.personal.clientSecret +googleCalendar.accounts.work.clientSecret +googleCalendar.accounts.business.clientSecret');
        res.json({ success: true, data: settings || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        const updateData = req.body;

        if (req.files) {
            if (updateData.general) {
                updateData.general = typeof updateData.general === 'string' ? JSON.parse(updateData.general) : updateData.general;
            } else {
                updateData.general = {};
            }

            if (req.files['logo']) {
                const logoFile = req.files['logo'][0];
                const destination = `general/logo-${Date.now()}${path.extname(logoFile.originalname)}`;
                updateData.general.logo = await uploadFile(logoFile.buffer, destination, logoFile.mimetype);
            }

            if (updateData.notification) {
                updateData.notification = typeof updateData.notification === 'string' ? JSON.parse(updateData.notification) : updateData.notification;
            }

            if (req.files['serviceAccountJson']) {
                updateData.notification = updateData.notification || {};
                const saFile = req.files['serviceAccountJson'][0];
                const destination = `config/firebase-sa-${Date.now()}.json`;
                updateData.notification.serviceAccountJson = await uploadFile(saFile.buffer, destination, saFile.mimetype);
            }

            if (updateData.storage) {
                updateData.storage = typeof updateData.storage === 'string' ? JSON.parse(updateData.storage) : updateData.storage;
            }

            if (req.files['gcsKeyJson']) {
                updateData.storage = updateData.storage || {};
                const gcsFile = req.files['gcsKeyJson'][0];
                const destination = `config/gcs-key-${Date.now()}.json`;
                updateData.storage.gcs = updateData.storage.gcs || {};
                updateData.storage.gcs.serviceAccountKeyJson = await uploadFile(gcsFile.buffer, destination, gcsFile.mimetype);
            }

            if (updateData.mobileApp) {
                updateData.mobileApp = typeof updateData.mobileApp === 'string' ? JSON.parse(updateData.mobileApp) : updateData.mobileApp;
            } else {
                updateData.mobileApp = {};
            }

            if (req.files['mobileLogo']) {
                const mlf = req.files['mobileLogo'][0];
                const dest = `mobile/logo-${Date.now()}${path.extname(mlf.originalname)}`;
                updateData.mobileApp.appLogo = await uploadFile(mlf.buffer, dest, mlf.mimetype);
            }

            if (req.files['splashIcon']) {
                const sif = req.files['splashIcon'][0];
                const dest = `mobile/splash-${Date.now()}${path.extname(sif.originalname)}`;
                updateData.mobileApp.splashIcon = await uploadFile(sif.buffer, dest, sif.mimetype);
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

            if (updateData.general) {
                Object.assign(settings.general, updateData.general);
                settings.markModified('general');
            }

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

            if (updateData.notification && Object.keys(updateData.notification).length > 0) {
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

            if (updateData.mobileApp && Object.keys(updateData.mobileApp).length > 0) {
                if (!settings.mobileApp) settings.mobileApp = {};
                Object.assign(settings.mobileApp, updateData.mobileApp);
                settings.markModified('mobileApp');
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
        const settings = await Settings.findOne().select('appearance general mobileApp googleAuth.webClientId googleAuth.enabled');
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
