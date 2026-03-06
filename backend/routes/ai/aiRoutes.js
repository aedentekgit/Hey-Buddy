const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../../middlewares/auth');
const aiController = require('../../controllers/ai/aiController');

// Gateway endpoints from frontend (React/Flutter) to Python AI
router.post('/chat', protect, aiController.proxyChatToPython);
router.post('/chat/stream', protect, aiController.proxyChatToPython);
router.post('/chat/realtime/stream', protect, aiController.proxyChatToPython);
router.get('/health', protect, aiController.proxyHealthToPython);
router.post('/tts', protect, aiController.proxyTtsToPython);
router.post('/action', protect, aiController.proxyActionToPython);
router.get('/chat/history/:session_id', protect, aiController.proxyHistoryToPython);

module.exports = router;
