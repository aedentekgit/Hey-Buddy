const axios = require('axios');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

async function listModels() {
    dotenv.config({ path: path.join(__dirname, '.env') });

    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) throw new Error('MONGODB_URI is required.');

    console.log('Connecting to MongoDB to fetch Gemini API Key...');
    await mongoose.connect(MONGODB_URI);

    const Settings = mongoose.model('Settings', new mongoose.Schema({
        ai: { geminiApiKey: { type: String, select: false } }
    }), 'settings');

    const settings = await Settings.findOne().select('+ai.geminiApiKey');
    let apiKey = settings?.ai?.geminiApiKey;
    await mongoose.disconnect();

    if (!apiKey) {
        console.error('No API Key found in Database.');
        process.exit(1);
    }

    console.log('API Key found. Calling Google API directly...');

    try {
        const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        console.log('--- Available Models for your Key ---');
        response.data.models.forEach(model => {
            const canBidi = model.supportedGenerationMethods.some(m => m.includes('bidiGenerateContent'));
            if (canBidi) {
                console.log(`✅ [LIVE SUPPORTED]: ${model.name}`);
            } else {
                console.log(`- ${model.name}`);
            }
        });
    } catch (err) {
        console.error('Error from Google:', err.response?.data?.error?.message || err.message);
    }
}

listModels();
