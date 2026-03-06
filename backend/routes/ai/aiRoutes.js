const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../../middlewares/auth');
const aiController = require('../../controllers/ai/aiController');

// Gateway endpoints from frontend (React/Flutter) to Python AI
router.post('/chat', protectOptional, aiController.proxyChatToPython);
router.post('/chat/stream', protectOptional, aiController.proxyChatToPython);
router.post('/chat/realtime/stream', protectOptional, aiController.proxyChatToPython);
router.get('/health', protectOptional, aiController.proxyHealthToPython);
router.post('/tts', protectOptional, aiController.proxyTtsToPython);
router.post('/action', protectOptional, aiController.proxyActionToPython);
router.get('/chat/history/:session_id', protectOptional, aiController.proxyHistoryToPython);

module.exports = router;
