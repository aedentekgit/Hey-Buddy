const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');

router.get('/private/start', protect, chatController.startPrivateChat);
router.get('/group', protect, chatController.getFamilyGroupChat);
router.get('/messages', protect, chatController.getChatMessages);
router.post('/send', protect, chatController.sendMessage);

module.exports = router;
