const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const { protect } = require('../middlewares/auth');

router.post('/request', protect, familyController.sendFamilyRequest);
router.delete('/request/:id', protect, familyController.cancelFamilyRequest);
router.get('/requests', protect, familyController.getFamilyRequests);
router.post('/respond', protect, familyController.respondToRequest);
router.get('/members', protect, familyController.getFamilyMembers);
router.delete('/member/:id', protect, familyController.removeMember);
router.post('/emergency', protect, familyController.sendEmergencyAlert);

module.exports = router;
