const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.get(url);
    const bidiModels = response.data.models.filter(m =>
        (m.supportedMethods && m.supportedMethods.includes('bidiGenerateContent')) ||
        (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('bidiGenerateContent'))
    );
    console.log('Models supporting BIDI:');
    bidiModels.forEach(m => console.log(`- ${m.name}`));
}

listModels().catch(console.error);
