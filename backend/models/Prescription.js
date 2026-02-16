const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: String,
    fileUrl: String, // Path to local file or Cloudinary/S3 URL
    mimeType: String,
    extractedData: {
        patientName: String,
        doctorName: String,
        medicines: [{
            name: String,
            dosage: String,
            frequency: {
                morning: { type: Boolean, default: false },
                afternoon: { type: Boolean, default: false },
                night: { type: Boolean, default: false }
            },
            timing: String, // e.g., "Before food", "After food"
            duration: String,
            startDate: Date,
            instructions: String
        }],
        notes: String,
        warnings: String
    },
    status: {
        type: String,
        enum: ['pending', 'processed', 'failed'],
        default: 'pending'
    },
    summary: String // Friendly summary for Buddy to speak
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
