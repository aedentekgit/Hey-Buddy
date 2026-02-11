const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// Assuming we have some middleware for authentication, for now we let it be open or simple
// const { protect, admin } = require('../middleware/authMiddleware');

const { protect, authorize } = require('../middlewares/auth');

const upload = require('../middlewares/uploadMiddleware');

// Profile Routes (Any authenticated user) - MUST come before /:id routes
router.put('/profile', protect, userController.updateProfile);
router.post('/profile/avatar', protect, upload.single('profilePicture'), userController.uploadProfilePicture);
router.delete('/profile/avatar', protect, userController.deleteProfilePicture);
router.delete('/profile', protect, userController.deleteMyAccount);
router.post('/fcm-token', protect, userController.saveFcmToken);
router.post('/unlink-calendar', protect, userController.unlinkCalendar);
router.post('/location', protect, userController.updateLocation);

// Admin Routes with :id parameter
router.get('/', protect, authorize('admin'), userController.getUsers);
router.post('/', protect, authorize('admin'), userController.createUser);
router.put('/:id', protect, authorize('admin'), userController.updateUser);
router.delete('/:id', protect, authorize('admin'), userController.deleteUser);

module.exports = router;
