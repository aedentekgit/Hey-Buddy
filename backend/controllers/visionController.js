const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.analyzeImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Helper to convert file to GoogleGenerativeAI.Part object
        function fileToGenerativePart(path, mimeType) {
            return {
                inlineData: {
                    data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                    mimeType
                },
            };
        }

        const imagePart = fileToGenerativePart(req.file.path, req.file.mimetype);

        const prompt = `
            Analyze this image and extract actionable information. 
            Identify if it's a grocery list, a medicine prescription/bottle, a bill, or a general note.
            Return a JSON object with the following structure:
            {
                "type": "grocery" | "medicine" | "bill" | "generic",
                "summary": "Short summary of what was found",
                "items": [
                    {
                        "title": "Item name/Task",
                        "details": "Quantity/Dosage/Price",
                        "date": "Extracted date if any (YYYY-MM-DD)",
                        "time": "Extracted time if any (HH:mm)"
                    }
                ],
                "rawContent": "A brief transcription of key text"
            }
            If no actionable items are found, return an empty items array.
            Strictly return ONLY JSON.
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Clean text (remove markdown code blocks if any)
        const jsonStr = text.replace(/```json|```/g, "").trim();
        const analysis = JSON.parse(jsonStr);

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.status(200).json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error("Vision Error:", error);
        res.status(500).json({ success: false, message: "AI Analysis failed", error: error.message });
        // Cleanup on error if file exists
        if (req.file) fs.unlinkSync(req.file.path);
    }
};

exports.saveVisionReminders = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: "Invalid items" });
        }

        const createdReminders = [];
        for (const item of items) {
            const reminder = await Reminder.create({
                userId: req.user._id,
                title: item.title,
                description: item.details || '',
                date: item.date || new Date().toISOString().split('T')[0],
                time: item.time || '09:00',
                source: 'buddy',
                intent: 'generic'
            });
            createdReminders.push(reminder);
        }

        // Create a summary notification
        await Notification.create({
            userId: req.user._id,
            title: 'Vision Import Complete',
            message: `Successfully imported ${items.length} items from your image analysis.`,
            type: 'reminder'
        });

        res.status(201).json({ success: true, count: createdReminders.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
