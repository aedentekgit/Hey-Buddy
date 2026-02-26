const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGODB_URI;

console.log('Testing connection to:', uri ? uri.split('@')[1] : 'UNDEFINED');

async function test() {
    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000
        });
        console.log('✅ LIVE STATUS: DATABASE CONNECTED');

        // Try to list collections as a final proof of life
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Found collections:', collections.map(c => c.name).join(', ') || 'None (Empty DB)');

        process.exit(0);
    } catch (err) {
        console.log('❌ LIVE STATUS: CONNECTION FAILED');
        console.log('Error Type:', err.name);
        console.log('Error Message:', err.message);
        process.exit(1);
    }
}

test();
