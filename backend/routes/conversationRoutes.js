const express = require('express');
const router = express.Router();
const { protect, protectInternal } = require('../middlewares/auth');
const {
    getConversations,
    getConversationById,
    deleteConversation,
    deleteAllConversations,
    syncConversation,
    getLatestConversationByUserId,
    getAllConversationsInternal,
    getConversationInternalById
} = require('../controllers/conversationController');

// SECURITY: Internal endpoints are now protected by INTERNAL_SECRET bearer token.
// Only the Python AI service (with the correct INTERNAL_SECRET env var) can call these.
// Previously these had NO authentication — anyone could read all conversations or inject data.
router.post('/sync', protectInternal, syncConversation);
router.get('/internal/all', protectInternal, getAllConversationsInternal);
router.get('/internal/session/:id', protectInternal, getConversationInternalById);
router.get('/internal/users/first', protectInternal, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const User = mongoose.model('User') || require('../models/User');
        const user = await User.findOne({}).select('_id name email role');
        if (!user) {
            return res.status(404).json({ success: false, message: 'No users found' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/internal/:userId/context', protectInternal, async (req, res) => {
    try {
        const contextService = require('../services/contextService');
        const context = await contextService.getContext(req.params.userId);
        res.status(200).json({ success: true, data: context });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
router.get('/internal/:userId', protectInternal, getLatestConversationByUserId);

router.use(protect);

router.get('/', getConversations);
router.delete('/', deleteAllConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

module.exports = router;
