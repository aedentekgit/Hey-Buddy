const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getReminders,
    createReminder,
    updateReminder,
    deleteReminder,
    batchDeleteReminders,
    shareReminder,
    unshareReminder
} = require('../controllers/reminderController');

router.use(protect);

router.get('/', getReminders);
router.post('/', createReminder);
router.post('/batch-delete', batchDeleteReminders);
router.post('/:id/share', shareReminder);
router.delete('/:id/unshare/:userId', unshareReminder);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);

module.exports = router;
