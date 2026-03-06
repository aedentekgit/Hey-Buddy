const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkModels() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Fetching Settings...');
        const Settings = require('./models/Settings');
        const settings = await Settings.findOne().select('+ai.geminiApiKey');
        const apiKey = settings?.ai?.geminiApiKey;

        if (!apiKey) {
            console.error('No Gemini API Key found in DB.');
            process.exit(1);
        }

        console.log(`Checking bidi-compatible models for key starting with ${apiKey.substring(0, 5)}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await axios.get(url);

        console.log('\n--- Bidi-Compatible (Live) Models ---');
        response.data.models.forEach(m => {
            if (m.supportedGenerationMethods.includes('bidiGenerateContent')) {
                console.log(`✅ ${m.name}`);
            }
        });

        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

checkModels();
