const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use the native audio model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // or gemini-2.5-flash

    // Test the newer generation capabilities
    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: "Hello! This is a test." }] }]
        });
        console.log("Response successful");
    } catch (e) {
        console.error(e);
    }
}
run();
