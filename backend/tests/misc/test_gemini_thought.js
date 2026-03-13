require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
async function test() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-native-audio-latest' });
    const result = await model.generateContent("What is the capital of France?");
    console.log(JSON.stringify(result.response, null, 2));
  } catch (err) {
    console.error(err);
  }
}
test();
