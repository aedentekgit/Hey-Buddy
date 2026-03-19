const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const SettingsSchema = new mongoose.Schema({ ai: Object }, { strict: false });
const Settings = mongoose.model('Settings', SettingsSchema);

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Bypass any mongoose selection layers to see raw DB content
    const settings = await mongoose.connection.db.collection('settings').findOne({});
    console.log("RAW SETTINGS FROM DB:");
    if (settings && settings.ai) {
        console.log("Groq:", settings.ai.groqApiKey);
        console.log("Gemini:", settings.ai.geminiApiKey);
        console.log("OpenAI:", settings.ai.openaiApiKey);
        console.log("Provider:", settings.ai.activeModel);
    } else {
        console.log("No AI settings found.");
    }
    process.exit(0);
}
test();
