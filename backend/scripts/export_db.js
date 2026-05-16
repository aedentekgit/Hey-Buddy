const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required.');
const EXPORT_DIR = path.join(__dirname, 'db_export');

async function exportDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        if (!fs.existsSync(EXPORT_DIR)) {
            fs.mkdirSync(EXPORT_DIR);
        }

        const collections = await mongoose.connection.db.listCollections().toArray();

        for (const col of collections) {
            console.log(`Exporting ${col.name}...`);
            const data = await mongoose.connection.db.collection(col.name).find({}).toArray();
            fs.writeFileSync(
                path.join(EXPORT_DIR, `${col.name}.json`),
                JSON.stringify(data, null, 2)
            );
        }

        console.log('Export complete! Files saved in db_export/');
        process.exit(0);
    } catch (err) {
        console.error('Export failed:', err);
        process.exit(1);
    }
}

exportDB();
