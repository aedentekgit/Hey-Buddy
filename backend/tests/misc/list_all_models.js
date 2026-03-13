const axios = require('axios');
require('dotenv').config();

async function listAllModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    console.log('All Models:');
    response.data.models.forEach(m => {
        const methods = m.supportedGenerationMethods || m.supportedMethods || [];
        console.log(`- ${m.name} (Methods: ${methods.join(', ')})`);
    });
}

listAllModels().catch(console.error);
