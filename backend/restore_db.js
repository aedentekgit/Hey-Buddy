const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// No dotenv needed - using local MongoDB on VPS
const MONGODB_URI = 'mongodb://localhost:27017/staging_Heybuddy';
const IMPORT_DIR = path.join(__dirname, 'db_export');

async function importDB() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const files = fs.readdirSync(IMPORT_DIR).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const colName = file.replace('.json', '');
            console.log(`Importing ${colName}...`);
            const data = JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, file), 'utf8'));

            if (data.length > 0) {
                // Drop existing collection if it exists
                try {
                    await mongoose.connection.db.collection(colName).drop();
                } catch (e) {
                    // Ignore if it doesn't exist
                }

                // Convert string dates/IDs if necessary (mongoose does some of this)
                // For direct DB import, we just insert the data
                await mongoose.connection.db.collection(colName).insertMany(data);
            }
        }

        console.log('Import complete!');
        process.exit(0);
    } catch (err) {
        console.error('Import failed:', err);
        process.exit(1);
    }
}

importDB();
