const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const collections = [
    { name: 'User', file: 'users.json', collectionName: 'users' },
    { name: 'Reminder', file: 'reminders.json', collectionName: 'reminders' },
    { name: 'Memory', file: 'memories.json', collectionName: 'memories' },
    { name: 'Conversation', file: 'conversations.json', collectionName: 'conversations' },
    { name: 'Role', file: 'roles.json', collectionName: 'roles' },
    { name: 'Setting', file: 'settings.json', collectionName: 'settings' }
];

const importData = async () => {
    try {
        console.log("Connecting to:", process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);

        for (const col of collections) {
            const filePath = path.join(__dirname, 'db_export', col.file);
            if (!fs.existsSync(filePath)) {
                console.log(`Skipping ${col.name} - file not found at ${filePath}`);
                continue;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`Importing ${data.length} items into ${col.collectionName}...`);

            const collection = mongoose.connection.db.collection(col.collectionName);

            // Delete current staging data for this collection
            await collection.deleteMany({});

            if (data.length > 0) {
                // Remove _id from roles to let MongoDB regenerate them if there are duplicate issues, 
                // but better to keep them for consistency.
                await collection.insertMany(data);
            }
        }

        console.log("✅ Data Import Complete!");
        process.exit(0);
    } catch (e) {
        console.error("Import failed:", e);
        process.exit(1);
    }
}

importData();
