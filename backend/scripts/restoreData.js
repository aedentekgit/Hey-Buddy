const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const models = {
    User: require('./models/User'),
    Role: require('./models/Role'),
    Settings: require('./models/Settings'),
    Reminder: require('./models/Reminder'),
    Memory: require('./models/Memory'),
    Prescription: require('./models/Prescription'),
    Notification: require('./models/Notification'),
    Conversation: require('./models/Conversation'),
    Webhook: require('./models/Webhook'),
    Document: require('./models/Document')
};

const EXPORT_DIR = path.join(__dirname, 'db_export');

async function restore() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const files = {
            User: 'users.json',
            Role: 'roles.json',
            Settings: 'settings.json',
            Reminder: 'reminders.json',
            Memory: 'memories.json',
            Prescription: 'prescriptions.json',
            Notification: 'notifications.json',
            Conversation: 'conversations.json',
            Webhook: 'webhooks.json',
            Document: 'documents.json'
        };

        for (const [modelName, fileName] of Object.entries(files)) {
            const filePath = path.join(EXPORT_DIR, fileName);
            if (!fs.existsSync(filePath)) {
                console.log(`Skipping ${modelName}: File ${fileName} not found.`);
                continue;
            }

            console.log(`Restoring ${modelName}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            if (!Array.isArray(data)) {
                console.log(`Skipping ${modelName}: Data is not an array.`);
                continue;
            }

            if (data.length === 0) {
                console.log(`Skipping ${modelName}: Array is empty.`);
                continue;
            }

            // Clear current data
            await models[modelName].deleteMany({});

            // Insert backup data
            await models[modelName].insertMany(data);
            console.log(`Successfully restored ${data.length} records for ${modelName}.`);
        }

        console.log('\n--- Restore Complete ---');
        console.log('NOTE: Since users were restored, your password might have changed.');
        console.log('If your recent temporary admin reset was lost, use the setup-vps route again.');

        process.exit(0);
    } catch (err) {
        console.error('Restore Failed:', err);
        process.exit(1);
    }
}

restore();
