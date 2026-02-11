const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { createWebhook, getWebhooks, deleteWebhook, handleIncoming } = require('../controllers/webhookController');

// Inbound public listener
router.post('/incoming/:secret', handleIncoming);

// Protected management routes
router.use(protect);
router.get('/', getWebhooks);
router.post('/', createWebhook);
router.delete('/:id', deleteWebhook);

module.exports = router;
