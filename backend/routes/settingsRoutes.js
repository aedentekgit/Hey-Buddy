const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, getPublicSettings, testSMTP, testSMS, testNotification } = require('../controllers/settingsController');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.get('/public', getPublicSettings);
router.get('/', protect, getSettings);
router.put('/', protect, authorize('admin'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'serviceAccountJson', maxCount: 1 }, { name: 'gcsKeyJson', maxCount: 1 }]), updateSettings);
router.post('/test-smtp', protect, authorize('admin'), testSMTP);
router.post('/test-sms', protect, authorize('admin'), testSMS);
router.post('/test-notification', protect, authorize('admin'), testNotification);

module.exports = router;
