const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Conversation = require('./backend/models/Conversation');
require('dotenv').config({ path: './backend/.env' });
async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const convs = await Conversation.find().limit(5);
    console.log(`Found ${convs.length} conversations`);
    process.exit(0);
}
test();
