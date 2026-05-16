/**
 * Migration: Set all 5 smart feature toggles to ON for existing reminders
 * Run with: node scripts/migrate_smart_features_on.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function migrate() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            console.error('❌ MONGODB_URI not found in .env');
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('✅ Connected!\n');

        const db = mongoose.connection.db;
        const collection = db.collection('reminders');

        // Count before
        const total = await collection.countDocuments({});
        console.log(`📊 Total reminders in DB: ${total}`);

        // Run the update
        const result = await collection.updateMany(
            {}, // all documents
            {
                $set: {
                    'smartFeatures.earlyWarning': true,
                    'smartFeatures.trafficAware': true,
                    'smartFeatures.itemExitGuards': true,
                    'alerts.email': true
                }
            }
        );

        console.log(`\n✅ Migration complete!`);
        console.log(`   Matched:  ${result.matchedCount} reminders`);
        console.log(`   Modified: ${result.modifiedCount} reminders`);

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB.');
        process.exit(0);
    }
}

migrate();
