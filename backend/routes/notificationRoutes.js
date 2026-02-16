const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getNotifications,
    markAsRead,
    markAllRead,
    deleteNotification,
    sendTestNotification
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.post('/test', sendTestNotification);
router.put('/mark-all-read', markAllRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;
