const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getConversations,
    getConversationById,
    deleteConversation,
    deleteAllConversations,
    syncConversation,
    getLatestConversationByUserId,
    getAllConversationsInternal
} = require('../controllers/conversationController');

// Allow internal AI service to sync and fetch conversations
router.post('/sync', syncConversation);
router.get('/internal/all', getAllConversationsInternal);
router.get('/internal/:userId', getLatestConversationByUserId);

router.use(protect);

router.get('/', getConversations);
router.delete('/', deleteAllConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

module.exports = router;
