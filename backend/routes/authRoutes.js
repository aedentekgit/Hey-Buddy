const express = require('express');
const router = express.Router();
const { login, signup, googleLogin, getMe, setupVPS } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/setup-vps', setupVPS); // Database initialization route
router.get('/me', protect, getMe);

module.exports = router;
