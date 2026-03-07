const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
    dismissNotification,
    dismissAllNotifications,
    sendTestNotification,
    updatePreferences
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.post('/test', sendTestNotification);
router.put('/mark-all-read', markAllRead);
router.put('/clear-all', dismissAllNotifications);
router.put('/preferences', updatePreferences);
router.put('/:id/read', markAsRead);
router.put('/:id/dismiss', dismissNotification);
router.delete('/:id', deleteNotification);

module.exports = router;
