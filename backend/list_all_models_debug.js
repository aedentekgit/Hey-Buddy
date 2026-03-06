const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function listAllModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    console.log('All Models:');
    response.data.models.forEach(m => console.log(`- ${m.name} (${m.supportedMethods?.join(', ')})`));
}

listAllModels().catch(console.error);
