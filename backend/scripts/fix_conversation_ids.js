/**
 * ONE-TIME MIGRATION: Fix Conversation documents where _id === userId
 * 
 * Root cause: The old syncConversation() used userId as the _id, causing ALL
 * users' conversations to collide into a single document per user ID.
 * This script detects those malformed docs and re-saves them with auto-generated _ids.
 *
 * Run once: node backend/scripts/fix_conversation_ids.js
 */
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    _id: { type: String, default: () => new mongoose.Types.ObjectId().toHexString(), required: true },
    userId: { type: String, ref: 'User', required: true },
    messages: [{ role: String, content: String, timestamp: { type: Date, default: Date.now } }],
    title: { type: String, default: 'New Conversation' }
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', ConversationSchema);

async function fixConversationIds() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGO_URI not found in .env');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Find all conversations where _id === userId (the bug)
    const allConversations = await Conversation.find({}).lean();
    const malformed = allConversations.filter(c => c._id === c.userId);

    console.log(`📊 Total conversations: ${allConversations.length}`);
    console.log(`🐛 Malformed (where _id === userId): ${malformed.length}`);

    if (malformed.length === 0) {
        console.log('✅ No malformed conversations found. Database is clean!');
        await mongoose.disconnect();
        return;
    }

    let fixed = 0;
    let failed = 0;

    for (const conv of malformed) {
        try {
            // Delete the malformed document
            await Conversation.deleteOne({ _id: conv._id });

            // Recreate it with a proper auto-generated _id
            await Conversation.create({
                userId: conv.userId,
                messages: conv.messages,
                title: conv.title || 'Buddy Conversation',
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt
            });

            console.log(`  ✅ Fixed conversation for userId: ${conv.userId} (was using userId as _id)`);
            fixed++;
        } catch (e) {
            console.error(`  ❌ Failed to fix conv for userId: ${conv.userId}:`, e.message);
            failed++;
        }
    }

    console.log(`\n📋 Migration complete: ${fixed} fixed, ${failed} failed`);
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
}

fixConversationIds().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
