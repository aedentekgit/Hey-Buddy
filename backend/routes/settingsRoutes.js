const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getSettings, updateSettings, getPublicSettings, getAppLogo, testSMTP, testSMS, testNotification, internalFileSync, internalFileDeleteSync } = require('../controllers/settingsController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// Helper: Wraps multer middleware to catch multer-specific errors (file size, bad type)
// and return a proper 400 JSON response instead of crashing to the global 500 handler.
const uploadWithErrorHandling = (fields) => (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                // Multer-specific errors (e.g. LIMIT_FILE_SIZE)
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, message: 'File is too large. Maximum allowed size is 200MB.' });
                }
                return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
            }
            // Custom fileFilter errors (wrong type)
            return res.status(400).json({ success: false, message: err.message || 'Invalid file type. Only images (PNG, JPG, GIF, WebP, SVG) and JSON are allowed.' });
        }
        next();
    });
};

router.get('/public', getPublicSettings);
router.get('/logo', getAppLogo);
router.head('/logo', getAppLogo);
router.get('/', protect, getSettings);
router.put('/', protect, authorize('admin'), uploadWithErrorHandling([
    { name: 'logo', maxCount: 1 },
    { name: 'mobileLogo', maxCount: 1 },
    { name: 'splashIcon', maxCount: 1 },
    { name: 'serviceAccountJson', maxCount: 1 },
    { name: 'gcsKeyJson', maxCount: 1 }
]), updateSettings);
router.post('/test-smtp', protect, authorize('admin'), testSMTP);
router.post('/test-sms', protect, authorize('admin'), testSMS);
router.post('/test-notification', protect, authorize('admin'), testNotification);

// Internal sync route for syncing files from local dev to VPS
router.post('/internal-file-sync', uploadWithErrorHandling([{ name: 'file', maxCount: 1 }]), internalFileSync);
router.delete('/internal-file-sync', internalFileDeleteSync);

module.exports = router;
