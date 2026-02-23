const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getConversations,
    getConversationById,
    deleteConversation,
    deleteAllConversations
} = require('../controllers/conversationController');

router.use(protect);

router.get('/', getConversations);
router.delete('/', deleteAllConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

module.exports = router;
