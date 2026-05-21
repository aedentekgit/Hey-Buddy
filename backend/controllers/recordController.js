const Prescription = require('../models/Prescription');
const Memory = require('../models/Memory');
const Reminder = require('../models/Reminder');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');
const paginate = require('../utils/paginate');
const { uploadFile, deleteFile } = require('../services/fileService');
const Settings = require('../models/Settings');
const { emitDataSync } = require('../utils/socketEmitter');
const { getFallbackKey } = require('../utils/configHelper');

// Helper to get openai instance dynamically
async function getOpenAI() {
    const settings = await Settings.findOne().select('+ai.openaiApiKey');
    const apiKey = settings?.ai?.openaiApiKey || getFallbackKey('OPENAI_API_KEY');
    if (!apiKey) throw new Error("OpenAI API Key not configured.");
    return new OpenAI({ apiKey });
}


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

            const openai = await getOpenAI();
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
                response_format: { type: "json_object" }
            });

            const extractedData = JSON.parse(response.choices[0].message.content);

            // Upload using unified service (respects activeProvider & has local fallback)
            const destination = `prescriptions/${userId}-${Date.now()}${path.extname(req.file.originalname)}`;
            const publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);

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
        try {
            const userId = req.user._id;
            const prescription = await Prescription.findOne({ _id: req.params.id, userId });
            if (!prescription) return res.status(404).json({ success: false, message: "Not found" });

            if (prescription.fileUrl) {
                await deleteFile(prescription.fileUrl);
            }

            // Cleanup associated reminders AND their Google Calendar events
            const reminders = await Reminder.find({ prescriptionId: prescription._id });
            if (reminders.length > 0) {
                const { deleteGoogleCalendarEvent } = require('../services/googleCalendarService');
                for (const r of reminders) {
                    if (r.googleEventId) {
                        await deleteGoogleCalendarEvent(userId, r.googleEventId).catch(() => { });
                    }
                }
                await Reminder.deleteMany({ prescriptionId: prescription._id });
            }

            await Prescription.deleteOne({ _id: req.params.id });

            // Pipeline Sync
            const { triggerVectorReload } = require('./reminders/helpers');
            emitDataSync(req, res, userId, 'task', 'delete', { type: 'prescription', id: req.params.id });
            triggerVectorReload();

            res.json({ success: true, message: "Deleted successfully." });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    confirmMedicalReminders: async (req, res) => {
        try {
            const { prescriptionId, confirmationData } = req.body;
            const userId = req.user._id;
            const created = [];
            const { syncReminder } = require('../services/googleCalendarService');

            for (const med of confirmationData.medicines) {
                const times = [];
                if (med.frequency.morning) times.push("09:00");
                if (med.frequency.afternoon) times.push("14:00");
                if (med.frequency.night) times.push("21:00");

                for (const time of times) {
                    const reminder = await Reminder.create({
                        userId,
                        prescriptionId,
                        title: `Take ${med.name}`,
                        intent: 'medicine',
                        time,
                        date: med.startDate || new Date().toISOString().split('T')[0],
                        repeat: true,
                        medicineDetails: { ...med }
                    });
                    
                    // Sync to Google Calendar
                    syncReminder(req.user, reminder).then(async (googleEventId) => {
                        if (googleEventId) {
                            await Reminder.findByIdAndUpdate(reminder._id, { googleEventId, source: 'google' });
                        }
                    }).catch(() => { });

                    created.push(reminder);
                }
            }

            // Pipeline Sync
            const { triggerVectorReload } = require('./reminders/helpers');
            emitDataSync(req, res, userId, 'task', 'create', { type: 'medical_batch' });
            triggerVectorReload();

            res.json({ success: true, data: created });
        } catch (error) {
            console.error('Confirm Medical Reminders Error:', error);
            res.status(500).json({ success: false, message: "Failed to create medical reminders." });
        }
    },

    getMemories: async (req, res) => {
        const results = await paginate(Memory, { userId: req.user._id }, req.query);
        res.json({ success: true, ...results });
    },

    updateMemory: async (req, res) => {
        try {
            const memoryId = req.params.id;
            const userId = req.user._id;

            let updateData = { ...req.body };

            if (req.file) {
                // Delete old file if exists
                const existing = await Memory.findOne({ _id: memoryId, userId });
                if (existing && existing.fileUrl) {
                    await deleteFile(existing.fileUrl).catch(e => console.warn('Old file delete failed:', e));
                }

                const destination = `memories/${userId}-${Date.now()}${path.extname(req.file.originalname)}`;
                const publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);
                updateData.fileUrl = publicUrl;
                updateData.fileName = req.file.originalname;
            }

            const doc = await Memory.findOneAndUpdate({ _id: memoryId, userId }, updateData, { new: true });

            // EMIT REAL-TIME SYNC
            emitDataSync(req, res, userId, 'memory', 'update', { id: memoryId });

            res.json({ success: true, data: doc });
        } catch (error) {
            console.error('Update Memory Error:', error);
            res.status(500).json({ success: false, message: "Update failed" });
        }
    },

    deleteMemory: async (req, res) => {
        const memory = await Memory.findOne({ _id: req.params.id, userId: req.user._id });
        if (memory && memory.fileUrl) {
            await deleteFile(memory.fileUrl).catch(e => console.warn('File delete failed:', e));
        }
        await Memory.deleteOne({ _id: req.params.id, userId: req.user._id });

        // EMIT REAL-TIME SYNC
        emitDataSync(req, res, req.user._id, 'memory', 'delete', { id: req.params.id });

        res.json({ success: true, message: "Deleted." });
    },

    createMemory: async (req, res) => {
        try {
            const { content, category, fileUrl: bodyFileUrl, fileName: bodyFileName } = req.body;
            const userId = req.user._id;
            if (!content) return res.status(400).json({ success: false, message: "Content is required" });

            let fileUrl = bodyFileUrl || null;
            let fileName = bodyFileName || null;

            if (req.file) {
                const destination = `memories/${userId}-${Date.now()}${path.extname(req.file.originalname)}`;
                fileUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);
                fileName = req.file.originalname;
            }

            const memory = await Memory.create({
                userId,
                content,
                category: category || 'general',
                fileUrl,
                fileName
            });
            
            // EMIT REAL-TIME SYNC
            emitDataSync(req, res, userId, 'memory', 'create', { id: memory._id });

            res.status(201).json({ success: true, data: memory });
        } catch (error) {
            console.error('Create Memory Error:', error);
            res.status(500).json({ success: false, message: "Failed to save memory" });
        }
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

            const Document = require('../models/Document');
            const [memories, prescriptions, documents] = await Promise.all([
                Memory.find(memQuery).lean(),
                Prescription.find(presQuery).lean(),
                Document.find({ userId }).lean()
            ]);

            const combined = [
                ...memories.map(m => ({ ...m, type: 'memory' })),
                ...prescriptions.map(p => ({ ...p, type: 'record' })),
                ...documents.map(d => ({ ...d, type: 'document' }))
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
