const Settings = require('../models/Settings');
const path = require('path');
const { sendTestEmail } = require('../services/emailService');
const { sendTestSMS } = require('../services/smsService');
const { sendPushNotification, resetFirebase } = require('../services/notificationService');
const { uploadFile } = require('../services/fileService');

const getSettings = async (req, res) => {
    try {
        const settings = await Settings.findOne().select('+smtp.password +googleAuth.webClientSecret +ai.geminiApiKey +ai.openaiApiKey +ai.claudeApiKey +ai.deepseekApiKey +ai.groqApiKey +ai.elevenLabsApiKey +googleCalendar.clientSecret +googleMaps.apiKey');
        res.json({ success: true, data: settings || {} });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Default voices injected when the DB has none configured yet
const DEFAULT_AVAILABLE_VOICES = [
    { name: 'Puck (British Male)', voiceId: 'Puck', gender: 'male', isDefault: true },
    { name: 'Charon (Deep Male)', voiceId: 'Charon', gender: 'male', isDefault: false },
    { name: 'Fenrir (Strong Male)', voiceId: 'Fenrir', gender: 'male', isDefault: false },
    { name: 'Aoede (Soft Female)', voiceId: 'Aoede', gender: 'female', isDefault: false },
    { name: 'Kore (Bright Female)', voiceId: 'Kore', gender: 'female', isDefault: false },
];

let publicSettingsCache = null;

const getPublicSettings = async (req, res) => {
    try {
        if (publicSettingsCache) {
            return res.json({ success: true, data: publicSettingsCache });
        }

        const settings = await Settings.findOne().select(
            'appearance general mobileApp googleAuth.webClientId googleAuth.enabled googleMaps.apiKey googleMaps.enabled ai.availableVoices ' +
            'notification.enabled notification.firebasePublicVapidKey notification.firebaseApiKey notification.firebaseAuthDomain ' +
            'notification.firebaseProjectId notification.firebaseStorageBucket notification.firebaseMessageSenderId ' +
            'notification.firebaseAppId notification.firebaseMeasurementId'
        );

        // Only cache when a real settings document exists (avoids caching empty state on startup)
        if (settings) {
            const settingsObj = settings.toObject ? settings.toObject() : settings;
            if (!settingsObj.ai) settingsObj.ai = {};
            // Inject defaults if DB has an empty availableVoices array
            if (!settingsObj.ai.availableVoices || settingsObj.ai.availableVoices.length === 0) {
                settingsObj.ai.availableVoices = DEFAULT_AVAILABLE_VOICES;
            }
            publicSettingsCache = settingsObj;
            return res.json({ success: true, data: settingsObj });
        }

        // No settings document yet — return defaults without caching so next request retries DB
        res.json({ success: true, data: { ai: { availableVoices: DEFAULT_AVAILABLE_VOICES } } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const invalidatePublicCache = () => {
    publicSettingsCache = null;
};

// Update existing updateSettings to invalidate cache
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

            if (updateData.googleMaps) {
                updateData.googleMaps = typeof updateData.googleMaps === 'string' ? JSON.parse(updateData.googleMaps) : updateData.googleMaps;
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
            invalidatePublicCache(); // Invalidate on create
            return res.json({ success: true, data: newSettings });
        }

        // Build update doc by deep-merging current settings with inbound data.
        const updateDoc = {};

        // General
        if (updateData.general) {
            updateDoc['general'] = { ...(currentSettings.general || {}), ...updateData.general };
        }

        // SMTP
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

        // Payment Gateways
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

        // Storage
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

        // Google Auth
        if (updateData.googleAuth) {
            const { webClientSecret, ...others } = updateData.googleAuth;
            updateDoc['googleAuth'] = { ...(currentSettings.googleAuth || {}), ...others };
            if (webClientSecret) updateDoc['googleAuth'].webClientSecret = webClientSecret;
        }

        // Google Calendar
        if (updateData.googleCalendar) {
            const { clientSecret, ...others } = updateData.googleCalendar;
            updateDoc['googleCalendar'] = { ...(currentSettings.googleCalendar || {}), ...others };
            if (clientSecret) updateDoc['googleCalendar'].clientSecret = clientSecret;
        }

        // Google Maps
        if (updateData.googleMaps) {
            updateDoc['googleMaps'] = { ...(currentSettings.googleMaps || {}), ...updateData.googleMaps };
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

        const updatedSettings = await Settings.findOneAndUpdate(
            {},
            { $set: updateDoc },
            {
                new: true,
                upsert: false,
                runValidators: false,
            }
        ).select('+smtp.password +googleAuth.webClientSecret +ai.geminiApiKey +ai.openaiApiKey +ai.claudeApiKey +ai.deepseekApiKey +ai.groqApiKey +ai.elevenLabsApiKey +googleCalendar.clientSecret');

        invalidatePublicCache(); // Invalidate on update

        // Reset Firebase so it re-initializes on next notification send (picks up new service account / enabled flag)
        if (updateData.notification) {
            resetFirebase().catch(e => console.error('[Firebase] Reset error (non-fatal):', e.message));
        }

        res.json({ success: true, data: updatedSettings });
    } catch (error) {
        console.error('updateSettings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const testSMTP = async (req, res) => {
    try {
        const { smtpConfig, testEmail } = req.body;
        if (!smtpConfig || !testEmail) {
            return res.status(400).json({ success: false, message: 'Missing smtpConfig or testEmail' });
        }
        await sendTestEmail(smtpConfig, testEmail);
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Test SMTP Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const testSMS = async (req, res) => {
    try {
        const { to, message } = req.body;
        await sendTestSMS(to, message);
        res.json({ success: true, message: 'Test SMS sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const testNotification = async (req, res) => {
    try {
        const { token, title, body } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'FCM Token is required' });
        }
        await sendPushNotification(token, title, body);
        res.json({ success: true, message: 'Test notification sent successfully' });
    } catch (error) {
        console.error('Test Notification Error:', error);
        // Provide a more user-friendly message for common setup errors
        let message = error.message;
        if (message.includes('Service Account JSON not found')) {
            message = 'Firebase Service Account JSON is missing. Please upload it in the "Cloud Messaging (FCM)" tab.';
        }
        res.status(500).json({ success: false, message });
    }
};

const fs = require('fs');

const uploadsRoot = path.resolve(__dirname, '..', 'uploads');

const resolveUploadPath = (relativePath) => {
    if (!relativePath || typeof relativePath !== 'string') return null;
    const cleaned = relativePath.replace(/^\/+/, '');
    const resolved = path.resolve(uploadsRoot, cleaned);
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
        return null;
    }
    return resolved;
};

const internalFileSync = async (req, res) => {
    try {
        if (!req.files || !req.files['file'] || !req.body.destination) {
            return res.status(400).json({ success: false, message: 'Missing file or destination' });
        }

        const syncFile = req.files['file'][0];
        const destination = req.body.destination;

        const fullPath = resolveUploadPath(destination);
        if (!fullPath) {
            return res.status(400).json({ success: false, message: 'Invalid destination path' });
        }
        const dir = path.dirname(fullPath);

        // Ensure directory exists
        await fs.promises.mkdir(dir, { recursive: true });

        // Write file
        await fs.promises.writeFile(fullPath, syncFile.buffer);

        console.log(`📥 Received synced file from local dev: ${destination}`);
        res.json({ success: true, path: `/uploads/${destination}` });
    } catch (error) {
        console.error("Sync Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const internalFileDeleteSync = async (req, res) => {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) {
            return res.status(400).json({ success: false, message: 'Missing fileUrl' });
        }

        // Expected format: /uploads/filename.ext
        if (fileUrl.startsWith('/uploads/')) {
            const relativePath = fileUrl.replace('/uploads/', '');
            const fullPath = resolveUploadPath(relativePath);
            if (!fullPath) {
                return res.status(400).json({ success: false, message: 'Invalid file path' });
            }
            try {
                await fs.promises.unlink(fullPath);
                console.log(`🗑️ Synced DELETION from local dev: ${relativePath}`);
            } catch (err) {
                // Ignore if not found
                console.log(`🗑️ Sync DELETION failed (not found/ignore): ${relativePath}`);
            }
        }

        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        console.error("Delete Sync Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAppLogo = async (req, res) => {
    try {
        const settings = await Settings.findOne();
        if (settings && settings.general && settings.general.logo) {
            return res.redirect(settings.general.logo);
        }
        res.status(404).json({ success: false, message: 'Logo not found' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    getPublicSettings,
    getAppLogo,
    testSMTP,
    testSMS,
    testNotification,
    internalFileSync,
    internalFileDeleteSync
};
