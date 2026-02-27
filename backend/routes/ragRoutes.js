const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { protect } = require('../middlewares/auth');
const { uploadDocument, queryKnowledge, getDocuments } = require('../controllers/ragController');

router.use(protect);

router.post('/upload', upload.single('document'), uploadDocument);
router.post('/query', queryKnowledge);
router.get('/documents', getDocuments);

module.exports = router;
