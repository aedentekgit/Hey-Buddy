const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, protectInternal } = require('../middlewares/auth');
const { uploadDocument, queryKnowledge, getDocuments, getAllKnowledge, deleteDocument } = require('../controllers/ragController');

// SECURITY: Restrict uploads to safe document types and cap at 10 MB.
// Previously: any file type, no size limit.
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed. Permitted: PDF, TXT, MD, DOC, DOCX.'), false);
        }
    }
});

// SECURITY: Internal knowledge endpoint now requires INTERNAL_SECRET bearer token.
// Previously had NO authentication — anyone could fetch all user knowledge.
router.get('/internal/all-knowledge', protectInternal, getAllKnowledge);

router.use(protect);

router.post('/upload', upload.single('document'), uploadDocument);
router.post('/query', queryKnowledge);
router.get('/documents', getDocuments);
router.delete('/documents/:id', deleteDocument);

module.exports = router;
