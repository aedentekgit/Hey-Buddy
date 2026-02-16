const express = require('express');
const router = express.Router();
const voiceControllerV2 = require('../controllers/voiceControllerV2');
const recordController = require('../controllers/recordController');
const reminderController = require('../controllers/reminderController');
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

// Core Voice Interactions (Step 1-6)
router.post('/parse', protect, voiceControllerV2.processVoice);
router.post('/save', protect, voiceControllerV2.saveReminder);

// Reminder CRUD (Refactored to separate controller)
router.get('/', protect, reminderController.getReminders);
router.delete('/:id', protect, reminderController.deleteReminder);
router.put('/:id', protect, reminderController.updateReminder);

// Medical / Prescription routes
router.post('/upload-prescription', protect, upload.single('document'), recordController.uploadPrescription);
router.post('/upload_prescription', protect, upload.single('document'), recordController.uploadPrescription);
router.post('/confirm-medical-reminders', protect, recordController.confirmMedicalReminders);
router.get('/prescriptions', protect, recordController.getPrescriptions);
router.get('/prescriptions/:id', protect, recordController.getPrescriptionById);
router.put('/prescriptions/:id', protect, recordController.updatePrescription);
router.delete('/prescriptions/:id', protect, recordController.deletePrescription);

// Memory routes
router.get('/memories', protect, recordController.getMemories);
router.get('/memories/mix', protect, recordController.getAllRecords);
router.put('/memories/:id', protect, recordController.updateMemory);
router.delete('/memories/:id', protect, recordController.deleteMemory);

// Google Calendar OAuth
router.get('/google/auth', protect, reminderController.getGoogleAuthUrl);
router.get('/google/callback', reminderController.googleCallback);

module.exports = router;
