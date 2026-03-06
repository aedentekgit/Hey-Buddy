require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Settings = require('./models/Settings');
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dbSettings = await Settings.findOne().select('+ai.geminiApiKey');
  const genAI = new GoogleGenerativeAI(dbSettings.ai.geminiApiKey);

  const systemInstruction = `SYSTEM IDENTITY:
- Your name is Buddy.
- PERSONALITY: You are Buddy, a professional and extremely empathetic health assistant.
- WRITING STYLE: Friendly, comforting, and clear. Be natural and conversational.
- NO EMOJIS: Your text is read by a TTS synthesizer. NO EMOJIS.

STRICT RULES:
1. DO NOT THINK ALOUD OR NARRATE ACTIONS: You must execute your tool calls perfectly silently. NEVER output transitional phrases like "I will search google for..." or "Initiating Data Retrieval". NEVER say "I have stored the information" or "I am ready for the next piece". Just reply naturally like a human WITHOUT explaining that you saved it.
2. NO MARKDOWN HEADERS: NEVER use bold headers like "**Noting Contextual Details**" or emojis. Just give a direct, simple answer.
3. OUTPUT FORMAT: ONLY output the exact final spoken sentence you wish to say. NOTHING ELSE.
4. NO HALLUCINATION: If the tool result is empty, say so. Do NOT invent data.`;

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-native-audio-latest',
    systemInstruction
  });

  const chat = model.startChat();
  const result = await chat.sendMessage("hi");
  console.log(result.response.text());
  process.exit();
}
test();
