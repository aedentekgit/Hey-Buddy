const Document = require('../models/Document');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // In a real RAG system we'd parse PDF/Doc here. 
        // For simplicity, we'll assume text extraction or use Gemini to "read" the image/text.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const fileBuffer = fs.readFileSync(req.file.path);
        const imagePart = {
            inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: req.file.mimetype
            },
        };

        const prompt = "Transcribe the following document into clean, searchable text. If it's an image, describe its content accurately. Return only the extracted text.";
        const result = await model.generateContent([prompt, imagePart]);
        const extractedText = result.response.text();

        const doc = await Document.create({
            userId: req.user._id,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            content: extractedText,
            metadata: { size: req.file.size }
        });

        fs.unlinkSync(req.file.path);

        res.status(201).json({ success: true, data: doc });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
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

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
