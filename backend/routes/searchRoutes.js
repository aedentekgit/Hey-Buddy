const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { globalSearch } = require('../controllers/searchController');

router.get('/', protect, globalSearch);

module.exports = router;
