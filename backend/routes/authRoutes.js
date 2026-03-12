const express = require('express');
const router = express.Router();
const { login, signup, googleLogin, getMe, setupVPS, guestLogin, forgotPassword, verifyResetOtp, resetPassword, changePassword } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/signup', signup);
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/guest-login', guestLogin);

// SECURITY: setup-vps is restricted to local/internal callers only.
// It seeds the DB with an admin account and must never be exposed publicly.
// Guard: only allow requests from localhost or when ALLOW_SETUP=true in env.
router.post('/setup-vps', (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const allowSetup = process.env.ALLOW_SETUP === 'true';
    if (!isLocal && !allowSetup) {
        return res.status(403).json({ success: false, message: 'Setup endpoint is not accessible from this origin.' });
    }
    next();
}, setupVPS);

router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
