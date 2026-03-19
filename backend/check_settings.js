const mongoose = require('mongoose');
const Settings = require('./models/Settings');
require('dotenv').config();

const checkSettings = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const settings = await Settings.findOne().select('+ai.geminiApiKey +ai.openaiApiKey +ai.claudeApiKey +ai.deepseekApiKey +ai.groqApiKey');

        if (!settings) {
            console.log('No settings found in the database.');
        } else {
            console.log('Active Model:', settings.ai.activeModel);
            console.log('Gemini API Key:', settings.ai.geminiApiKey ? 'SET' : 'MISSING');
            console.log('OpenAI API Key:', settings.ai.openaiApiKey ? 'SET' : 'MISSING');
            console.log('Groq API Key:', settings.ai.groqApiKey ? 'SET' : 'MISSING');
            console.log('Claude API Key:', settings.ai.claudeApiKey ? 'SET' : 'MISSING');
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
};

checkSettings();
