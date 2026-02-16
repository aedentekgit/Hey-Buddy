const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middlewares/auth');
const { uploadDocument, queryKnowledge, getDocuments } = require('../controllers/ragController');

const upload = multer({ dest: 'uploads/' });

router.use(protect);

router.post('/upload', upload.single('document'), uploadDocument);
router.post('/query', queryKnowledge);
router.get('/documents', getDocuments);

module.exports = router;
