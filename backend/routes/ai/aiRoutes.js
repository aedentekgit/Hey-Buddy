const express = require('express');
const router = express.Router({ mergeParams: true });
const { protect } = require('../../middlewares/auth');
const aiController = require('../../controllers/ai/aiController');

// Body size limits to prevent abuse
// Regular endpoints: 50KB, streaming endpoints: 1MB (for larger context payloads with memory_context)
router.use(express.json({ limit: '1mb' }));
router.use(express.text({ limit: '1mb' }));

// Gateway endpoints from frontend (React/Flutter) to Python AI
router.post('/chat', protect, aiController.proxyChatToPython);
router.post('/chat/stream', protect, aiController.proxyChatToPython);
router.post('/chat/realtime', protect, aiController.proxyChatToPython);
router.post('/chat/realtime/stream', protect, aiController.proxyChatToPython);
router.post('/chat/consensus', protect, aiController.proxyChatToPython);
router.get('/health', protect, aiController.proxyHealthToPython);
router.post('/tts', protect, aiController.proxyTtsToPython);
router.post('/action', protect, aiController.proxyActionToPython);
router.get('/chat/history/:session_id', protect, aiController.proxyHistoryToPython);

module.exports = router;

