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
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt']);
        const allowedMimes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']);
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.has(ext) && allowedMimes.has(file.mimetype)) return cb(null, true);
        cb(new Error('Unsupported chat attachment type'));
    }
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
