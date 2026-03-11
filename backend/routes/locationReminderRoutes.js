const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getLocationReminders,
    getLocationReminder,
    createLocationReminder,
    updateLocationReminder,
    deleteLocationReminder,
    setEarlyWarning,
    setFamilyBackup
} = require('../controllers/locationReminderController');

router.use(protect);

// CRUD
router.get('/', getLocationReminders);
router.get('/:id', getLocationReminder);
router.post('/', createLocationReminder);
router.put('/:id', updateLocationReminder);
router.delete('/:id', deleteLocationReminder);

// Actions
router.post('/:id/early-warning', setEarlyWarning);
router.post('/:id/family-backup', setFamilyBackup);

module.exports = router;
