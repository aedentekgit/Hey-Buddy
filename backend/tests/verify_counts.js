const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/staging_Heybuddy';

async function checkCounts() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('--- Collection Counts ---');

        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(`${col.name}: ${count}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

checkCounts();
