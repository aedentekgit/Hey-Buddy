const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const { protect } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');

// Configure Multer for document uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) return cb(null, true);
        cb(new Error("Only images and PDFs are allowed"));
    }
});

router.post('/parse', protect, voiceController.parseVoice);
router.post('/save', protect, voiceController.saveReminder);
router.get('/', protect, voiceController.getReminders);
router.delete('/:id', protect, voiceController.deleteReminder);
router.put('/:id', protect, voiceController.updateReminder);

// Medical / Prescription routes (Supports both hyphen and underscore aliases for robustness)
router.post('/upload-prescription', protect, upload.single('document'), voiceController.uploadPrescription);
router.post('/upload_prescription', protect, upload.single('document'), voiceController.uploadPrescription);
router.post('/confirm-medical-reminders', protect, voiceController.confirmMedicalReminders);
router.get('/prescriptions', protect, voiceController.getPrescriptions);
router.get('/prescriptions/:id', protect, voiceController.getPrescriptionById);
router.put('/prescriptions/:id', protect, voiceController.updatePrescription);
router.delete('/prescriptions/:id', protect, voiceController.deletePrescription);

// Memory routes
router.get('/memories', protect, voiceController.getMemories);
router.delete('/memories/:id', protect, voiceController.deleteMemory);

// Google Calendar OAuth
router.get('/google/auth', protect, voiceController.getGoogleAuthUrl);
router.get('/google/callback', voiceController.googleCallback);

module.exports = router;
