const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const models = await genAI.listModels();
    console.log('Available Models:');
    for (const m of models.models) {
        console.log(`- ${m.name} (Methods: ${m.supportedMethods.join(', ')})`);
        if (m.supportedMethods.includes('bidiGenerateContent')) {
            console.log('   >>> SUPPORTED FOR BIDI!');
        }
    }
}

listModels().catch(console.error);
