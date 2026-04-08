const Document = require('../models/Document');
const Memory = require('../models/Memory');
const Reminder = require('../models/Reminder');
const LocationReminder = require('../models/LocationReminder');
const Prescription = require('../models/Prescription');
const Settings = require('../models/Settings');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const { uploadFile } = require('../services/fileService');
const path = require('path');

// Helper to get genAI instance dynamically
async function getGenAI() {
    const settings = await Settings.findOne().select('+ai.geminiApiKey');
    const apiKey = settings?.ai?.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API Key not configured.");
    return new GoogleGenerativeAI(apiKey);
}


exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const genAI = await getGenAI();
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            },
        };

        const prompt = "Transcribe the following document into clean, searchable text. If it's an image, describe its content accurately. Return only the extracted text.";
        const result = await model.generateContent([prompt, imagePart]);
        const extractedText = result.response.text();

        // Upload via unified service
        const destination = `documents/${req.user._id}-${Date.now()}${path.extname(req.file.originalname)}`;
        const publicUrl = await uploadFile(req.file.buffer, destination, req.file.mimetype);

        const doc = await Document.create({
            userId: req.user._id,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            fileUrl: publicUrl,
            content: extractedText,
            metadata: { size: req.file.size }
        });

        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        console.error("RAG Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.queryKnowledge = async (req, res) => {
    try {
        const { question } = req.body;

        // Simple search (can be enhanced with vector search)
        const docs = await Document.find({
            userId: req.user._id,
            $text: { $search: question }
        }).limit(3);

        // If no text index, fallback to basic find
        let contextText = "";
        if (docs.length > 0) {
            contextText = docs.map(d => `Source: ${d.fileName}\nContent: ${d.content}`).join("\n\n");
        } else {
            // Fallback: search all user docs if keywords match
            const allDocs = await Document.find({ userId: req.user._id }).limit(5);
            contextText = allDocs.map(d => d.content).join("\n\n");
        }

        const genAI = await getGenAI();
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `
            You are Buddy Assistant's Knowledge Core. Use the following user documents to answer their question.
            If the answer isn't in the documents, say "I couldn't find that specifically in your items, but based on general knowledge..."
            
            Documents:
            ${contextText}
            
            User Question: ${question}
        `;

        const result = await model.generateContent(prompt);
        res.status(200).json({ success: true, answer: result.response.text(), sources: docs.map(d => d.fileName) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDocuments = async (req, res) => {
    try {
        const docs = await Document.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: docs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const doc = await Document.findOne({ _id: req.params.id, userId: req.user._id });
        if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

        if (doc.fileUrl) {
            await deleteFile(doc.fileUrl).catch(e => console.warn('File delete failed:', e));
        }
        await Document.deleteOne({ _id: req.params.id });

        res.json({ success: true, message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * INTERNAL USE ONLY: Fetch absolutely everything for Python RAG indexing
 * Consolidated across all knowledge-base models
 */
exports.getAllKnowledge = async (req, res) => {
    try {
        // We fetch everything. The Python side will handle chunking and multi-tenant isolation via metadata.
        const [docs, memories, reminders, locationReminders, prescriptions] = await Promise.all([
            Document.find({}).lean(),
            Memory.find({}).lean(),
            Reminder.find({}).lean(),
            LocationReminder.find({}).lean(),
            Prescription.find({}).lean()
        ]);

        // Merge standard and location reminders into a single list for the AI
        const allReminders = [...reminders, ...locationReminders.map(lr => ({
            ...lr,
            reminderType: 'location' // Ensure it's tagged properly
        }))];

        const consolidated = {
            documents: docs,
            memories: memories,
            reminders: allReminders,
            prescriptions: prescriptions
        };

        res.status(200).json({ success: true, data: consolidated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
