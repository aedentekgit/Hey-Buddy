const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const geminiService = require('./services/geminiService');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://buddy_admin:HeyBuddySecure123!@82.29.167.22:27017/staging_Heybuddy?authSource=admin';

async function runTest() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const initialSettings = await Settings.findOne();
        const initialSpent = initialSettings.ai.totalTokensUsed || 0;
        console.log(`Initial Spent: ${initialSpent}`);

        console.log('Generating AI Response...');
        const response = await geminiService.generateResponse("Hello, this is a test to check if token tracking is working. Please give me a brief 2-sentence reply.");

        console.log('AI Reply:', response.reply);

        // Wait a bit for the async update to finish (though updateTokenUsage is awaited in geminiService usually, 
        // let's check one more once it's done)
        const finalSettings = await Settings.findOne();
        const finalSpent = finalSettings.ai.totalTokensUsed || 0;

        console.log(`Final Spent: ${finalSpent}`);
        console.log(`Tokens tracked in this test: ${finalSpent - initialSpent}`);

        if (finalSpent > initialSpent) {
            console.log('SUCCESS: Token tracking is functional!');
        } else {
            console.log('FAILURE: Token count did not increase.');
        }

        process.exit(0);
    } catch (err) {
        console.error('Test failed with error:', err);
        process.exit(1);
    }
}

runTest();
