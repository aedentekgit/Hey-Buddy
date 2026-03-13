const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('No GEMINI_API_KEY found in .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const result = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }).listModels();
        console.log('Available Models:');
        result.models.forEach(m => {
            console.log(`- ${m.name} (${m.supportedGenerationMethods.join(', ')})`);
        });
    } catch (err) {
        // Falling back to a direct fetch as listModels might not be exactly like this in the SDK
        const axios = require('axios');
        try {
            const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            console.log('Available Models (via axios):');
            response.data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('bidiGenerateContent')) {
                    console.log(`🌟 [LIVE COMPATIBLE] - ${m.name}`);
                } else {
                    console.log(`- ${m.name}`);
                }
            });
        } catch (axiosErr) {
            console.error('Failed to list models:', axiosErr.message);
        }
    }
}

listModels();
