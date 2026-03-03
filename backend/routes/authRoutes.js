const express = require('express');
const router = express.Router();
const { login, signup, googleLogin, getMe, setupVPS, guestLogin, forgotPassword, verifyResetOtp, resetPassword } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/guest-login', guestLogin);
router.post('/setup-vps', setupVPS); // Database initialization route
router.get('/me', protect, getMe);

router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
