const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
    getConversations,
    getConversationById,
    deleteConversation
} = require('../controllers/conversationController');

router.use(protect);

router.get('/', getConversations);
router.get('/:id', getConversationById);
router.delete('/:id', deleteConversation);

module.exports = router;
