const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// Assuming we have some middleware for authentication, for now we let it be open or simple
// const { protect, admin } = require('../middleware/authMiddleware');

const { protect, authorize, protectOptional } = require('../middlewares/auth');

const upload = require('../middlewares/uploadMiddleware');

// Profile Routes (Any authenticated user) - MUST come before /:id routes
router.put('/profile', protect, userController.updateProfile);
router.post('/profile/avatar', protect, upload.single('profilePicture'), userController.uploadProfilePicture);
router.delete('/profile/avatar', protect, userController.deleteProfilePicture);
router.delete('/profile', protect, userController.deleteMyAccount);
router.post('/fcm-token', protectOptional, userController.saveFcmToken);
router.post('/unlink-calendar', protect, userController.unlinkCalendar);
router.post('/location', protectOptional, userController.updateLocation);
router.get('/reverse-geocode', protect, userController.reverseGeocode);

// Admin Routes with :id parameter
router.get('/', protect, authorize('admin'), userController.getUsers);
router.post('/', protect, authorize('admin'), userController.createUser);
router.post('/:id/avatar', protect, authorize('admin'), upload.single('profilePicture'), userController.adminUploadProfilePicture);
router.delete('/:id/avatar', protect, authorize('admin'), userController.adminDeleteProfilePicture);
router.put('/:id', protect, authorize('admin'), userController.updateUser);
router.delete('/:id', protect, authorize('admin'), userController.deleteUser);

module.exports = router;
