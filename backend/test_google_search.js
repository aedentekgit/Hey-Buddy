const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testSearch() {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        tools: [{ googleSearch: {} }],
        systemInstruction: "Do not explain your tools. Just answer the question directly."
    });

    const chat = model.startChat();

    console.log("Asking question...");
    const result = await chat.sendMessage("who is the cm of tn?");

    console.log("Response Text:", result.response.text());
    console.log("Function Calls:", result.response.functionCalls());
}

testSearch().catch(console.error);
