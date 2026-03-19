require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const geminiService = require('./services/geminiService');

async function test() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/buddy_ai");
  const prompt = `Act as a news curator for Madurai. Provide exactly 3 short, interesting news points (max 12 words each).
        - Point 1 & 2: Local news relevant to Madurai or its region.
        - Point 3: A major global/international news headline from today.
        
        You must return EXACTLY 3 lines of text, one point per line, with no bullet points, no markdown, and absolutely no conversational filler. Do not apologize. Include emojis. Use your web_search tool to ensure these are real, current headlines for today.`;
  
  try {
      const aiResponse = await geminiService.generateResponse(prompt, null, { userContext: { timeZone: 'Asia/Kolkata' } });
      console.log('AI Response:', aiResponse);
      const cleanReply = aiResponse.reply.replace(/```(json)?/gi, '').replace(/[\[\]]/g, '');
      const textLines = cleanReply.split('\n').filter(l => l.trim().length > 5);
      const news = textLines.slice(0, 3).map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').replace(/^["']|["']$/g, '').trim());
      console.log('Parsed news:', news);
  } catch (err) {
      console.error('Error:', err);
  }
  process.exit(0);
}
test();
