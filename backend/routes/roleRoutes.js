const express = require('express');
const router = express.Router();
const { getRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, authorize } = require('../middlewares/auth');

router.route('/').get(protect, authorize('admin'), getRoles).post(protect, authorize('admin'), createRole);
router.route('/:id').put(protect, authorize('admin'), updateRole).delete(protect, authorize('admin'), deleteRole);

module.exports = router;
