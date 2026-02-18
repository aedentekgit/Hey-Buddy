const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { analyzeImage, saveVisionReminders } = require('../controllers/visionController');
const upload = require('../middlewares/uploadMiddleware');

router.use(protect);

// Use the shared upload middleware with memory storage
router.post('/analyze', upload.single('image'), analyzeImage);
router.post('/save', saveVisionReminders);

module.exports = router;
