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
        let updateData = req.body;

        // Fetch current settings once for deep-merging
        const settings = await Settings.findOne();
        const currentSettings = settings ? settings.toObject() : {};

        // Handle file uploads first
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

        // If no document exists yet, create one via normal save
        if (!settings) {
            const newSettings = new Settings(updateData);
            const { general } = newSettings;
            if (general?.companyName && general?.phone) {
                newSettings.isConfigured = true;
            }
            await newSettings.save();
            return res.json({ success: true, data: newSettings });
        }

        // Build update doc by deep-merging current settings with inbound data.
        // Using findOneAndUpdate with $set avoids Mongoose version (__v) conflicts entirely.
        const updateDoc = {};

        // General
        if (updateData.general) {
            updateDoc['general'] = { ...(currentSettings.general || {}), ...updateData.general };
        }

        // SMTP — keep existing password if no new one provided
        if (updateData.smtp) {
            const { password, ...others } = updateData.smtp;
            updateDoc['smtp'] = { ...(currentSettings.smtp || {}), ...others };
            if (password) updateDoc['smtp'].password = password;
        }

        // SMS
        if (updateData.sms) {
            updateDoc['sms'] = { ...(currentSettings.sms || {}), ...updateData.sms };
        }

        // Social Media
        if (updateData.socialMedia) {
            updateDoc['socialMedia'] = { ...(currentSettings.socialMedia || {}), ...updateData.socialMedia };
        }

        // Payment Gateways (replace array entirely)
        if (updateData.paymentGateways) {
            updateDoc['paymentGateways'] = updateData.paymentGateways;
        }

        // OTP
        if (updateData.otp) {
            updateDoc['otp'] = { ...(currentSettings.otp || {}), ...updateData.otp };
        }

        // Notification
        if (updateData.notification && Object.keys(updateData.notification).length > 0) {
            updateDoc['notification'] = { ...(currentSettings.notification || {}), ...updateData.notification };
        }

        // Storage — deep merge provider sub-objects
        if (updateData.storage) {
            const mergedStorage = { ...(currentSettings.storage || {}) };
            if (updateData.storage.activeProvider !== undefined) {
                mergedStorage.activeProvider = updateData.storage.activeProvider;
            }
            if (updateData.storage.local) {
                mergedStorage.local = { ...(mergedStorage.local || {}), ...updateData.storage.local };
            }
            if (updateData.storage.cloudinary) {
                mergedStorage.cloudinary = { ...(mergedStorage.cloudinary || {}), ...updateData.storage.cloudinary };
            }
            if (updateData.storage.gcs) {
                mergedStorage.gcs = { ...(mergedStorage.gcs || {}), ...updateData.storage.gcs };
            }
            updateDoc['storage'] = mergedStorage;
        }

        // AI
        if (updateData.ai) {
            updateDoc['ai'] = { ...(currentSettings.ai || {}), ...updateData.ai };
        }

        // Appearance
        if (updateData.appearance) {
            updateDoc['appearance'] = { ...(currentSettings.appearance || {}), ...updateData.appearance };
        }

        // Google Auth — protect webClientSecret
        if (updateData.googleAuth) {
            const { webClientSecret, ...others } = updateData.googleAuth;
            updateDoc['googleAuth'] = { ...(currentSettings.googleAuth || {}), ...others };
            if (webClientSecret) updateDoc['googleAuth'].webClientSecret = webClientSecret;
        }

        // Google Calendar — deep merge accounts
        if (updateData.googleCalendar) {
            const mergedCalendar = { ...(currentSettings.googleCalendar || {}) };
            if (updateData.googleCalendar.activeAccount !== undefined) {
                mergedCalendar.activeAccount = updateData.googleCalendar.activeAccount;
            }
            if (updateData.googleCalendar.accounts) {
                mergedCalendar.accounts = { ...(mergedCalendar.accounts || {}) };
                ['personal', 'work', 'business'].forEach(accountType => {
                    if (updateData.googleCalendar.accounts[accountType]) {
                        const { clientSecret, ...others } = updateData.googleCalendar.accounts[accountType];
                        mergedCalendar.accounts[accountType] = {
                            ...(mergedCalendar.accounts[accountType] || {}),
                            ...others
                        };
                        if (clientSecret) {
                            mergedCalendar.accounts[accountType].clientSecret = clientSecret;
                        }
                    }
                });
            }
            updateDoc['googleCalendar'] = mergedCalendar;
        }

        // Mobile App
        if (updateData.mobileApp && Object.keys(updateData.mobileApp).length > 0) {
            updateDoc['mobileApp'] = { ...(currentSettings.mobileApp || {}), ...updateData.mobileApp };
        }

        // Determine isConfigured
        const finalCompanyName = (updateDoc['general'] || currentSettings.general)?.companyName;
        const finalPhone = (updateDoc['general'] || currentSettings.general)?.phone;
        if (finalCompanyName && finalPhone) {
            updateDoc['isConfigured'] = true;
        }

        // Use findOneAndUpdate with $set — bypasses __v version conflicts completely
        const updatedSettings = await Settings.findOneAndUpdate(
            {},
            { $set: updateDoc },
            {
                new: true,
                upsert: false,
                runValidators: false,
            }
        ).select('+smtp.password +googleAuth.webClientSecret +ai.geminiApiKey');

        res.json({ success: true, data: updatedSettings });
    } catch (error) {
        console.error('updateSettings error:', error);
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
