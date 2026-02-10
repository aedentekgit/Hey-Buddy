const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
// Assuming we have some middleware for authentication, for now we let it be open or simple
// const { protect, admin } = require('../middleware/authMiddleware');

const { protect, authorize } = require('../middlewares/auth');

router.get('/', protect, authorize('admin'), userController.getUsers);
router.post('/', protect, authorize('admin'), userController.createUser);
router.put('/:id', protect, authorize('admin'), userController.updateUser);
router.delete('/:id', protect, authorize('admin'), userController.deleteUser);
// Profile Routes (Any authenticated user)
router.put('/profile', protect, userController.updateProfile);
router.delete('/profile', protect, userController.deleteMyAccount);
router.post('/fcm-token', protect, userController.saveFcmToken);
router.post('/unlink-calendar', protect, userController.unlinkCalendar);

module.exports = router;
