const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `chat_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.get('/private/start', protect, chatController.startPrivateChat);
router.get('/group', protect, chatController.getFamilyGroupChat);
router.get('/messages', protect, chatController.getChatMessages);
router.post('/send', protect, chatController.sendMessage);
router.post('/upload', protect, upload.single('file'), chatController.uploadFile);
router.delete('/:chat_id/history', protect, chatController.deleteChatHistory);
router.post('/:chat_id/mute', protect, chatController.muteChat);
router.post('/:chat_id/archive', protect, chatController.archiveChat);

module.exports = router;
