const express = require('express');
const router = express.Router();
const { getDashboardStats, getDetailedAnalytics } = require('../controllers/statsController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, getDashboardStats);
router.get('/detailed', protect, getDetailedAnalytics);

module.exports = router;
