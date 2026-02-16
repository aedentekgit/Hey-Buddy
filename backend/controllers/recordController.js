const Prescription = require('../models/Prescription');
const Memory = require('../models/Memory');
const Reminder = require('../models/Reminder');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const paginate = require('../utils/paginate');
const { uploadFileToFirebase } = require('../services/fileService');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});

const recordController = {
    uploadPrescription: async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

            const userId = req.user._id;
            const language = req.body.language || 'en-US';

            // Use buffer directly for OpenAI
            const base64Image = req.file.buffer.toString('base64');
            const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

            const prompt = `Extract medical info from this prescription as JSON: {patientName, doctorName, medicines: [{name, dosage, frequency: {morning, afternoon, night}, timing, duration, instructions}], notes, warnings, summary}. Language: ${language}`;

            const response = await openai.chat.completions.create({
                model: "openai/gpt-4o-mini",
                messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
                response_format: { type: "json_object" }
            });

            const extractedData = JSON.parse(response.choices[0].message.content);

            // Upload to Firebase
            const destination = `prescriptions/${userId}-${Date.now()}${path.extname(req.file.originalname)}`;
            const publicUrl = await uploadFileToFirebase(req.file.buffer, destination, req.file.mimetype);

            const prescription = await Prescription.create({
                userId,
                fileName: req.file.originalname,
                fileUrl: publicUrl,
                extractedData,
                summary: extractedData.summary || "Prescription processed.",
                status: 'processed'
            });

            res.status(200).json({ success: true, data: prescription });
        } catch (error) {
            console.error('Prescription Error:', error);
            res.status(500).json({ success: false, message: "Analysis failed." });
        }
    },

    getPrescriptions: async (req, res) => {
        try {
            const results = await paginate(Prescription, { userId: req.user._id }, req.query);
            res.json({ success: true, ...results });
        } catch (error) {
            res.status(500).json({ success: false, message: "Failed" });
        }
    },

    getPrescriptionById: async (req, res) => {
        const doc = await Prescription.findOne({ _id: req.params.id, userId: req.user._id });
        if (!doc) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, data: doc });
    },

    updatePrescription: async (req, res) => {
        const doc = await Prescription.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true });
        res.json({ success: true, data: doc });
    },

    deletePrescription: async (req, res) => {
        const prescription = await Prescription.findOne({ _id: req.params.id, userId: req.user._id });
        if (!prescription) return res.status(404).json({ success: false });

        // Since files are now in Firebase, we don't handle local deletion here for now.
        // We could add Firebase deletion later if needed.

        await Reminder.deleteMany({ prescriptionId: prescription._id });
        await Prescription.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: "Deleted." });
    },

    confirmMedicalReminders: async (req, res) => {
        try {
            const { prescriptionId, confirmationData } = req.body;
            const created = [];
            for (const med of confirmationData.medicines) {
                const times = [];
                if (med.frequency.morning) times.push("09:00");
                if (med.frequency.afternoon) times.push("14:00");
                if (med.frequency.night) times.push("21:00");

                for (const time of times) {
                    const reminder = await Reminder.create({
                        userId: req.user._id,
                        prescriptionId,
                        title: `Take ${med.name}`,
                        intent: 'medicine',
                        time,
                        date: med.startDate || new Date().toISOString().split('T')[0],
                        repeat: true,
                        medicineDetails: { ...med }
                    });
                    created.push(reminder);
                }
            }
            res.json({ success: true, data: created });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    getMemories: async (req, res) => {
        const results = await paginate(Memory, { userId: req.user._id }, req.query);
        res.json({ success: true, ...results });
    },

    updateMemory: async (req, res) => {
        const doc = await Memory.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true });
        res.json({ success: true, data: doc });
    },

    deleteMemory: async (req, res) => {
        await Memory.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.json({ success: true, message: "Deleted." });
    },

    getAllRecords: async (req, res) => {
        try {
            const userId = req.user._id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';

            const memQuery = { userId };
            const presQuery = { userId };

            if (search) {
                memQuery.content = { $regex: search, $options: 'i' };
                presQuery['$or'] = [
                    { 'extractedData.patientName': { $regex: search, $options: 'i' } },
                    { fileName: { $regex: search, $options: 'i' } }
                ];
            }

            const [memories, prescriptions] = await Promise.all([
                Memory.find(memQuery).lean(),
                Prescription.find(presQuery).lean()
            ]);

            const combined = [
                ...memories.map(m => ({ ...m, type: 'memory' })),
                ...prescriptions.map(p => ({ ...p, type: 'record' }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const total = combined.length;
            const totalPages = Math.ceil(total / limit);
            const startIndex = (page - 1) * limit;
            const paginatedData = combined.slice(startIndex, startIndex + limit);

            res.json({
                success: true,
                data: paginatedData,
                pagination: {
                    total,
                    totalPages,
                    currentPage: page,
                    limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: "Failed" });
        }
    }
};

module.exports = recordController;
