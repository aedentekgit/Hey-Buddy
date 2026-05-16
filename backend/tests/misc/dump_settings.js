const mongoose = require('mongoose');
const Settings = require('./models/Settings');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error('MONGODB_URI is required.');

async function dump() {
    await mongoose.connect(MONGODB_URI);
    const settings = await Settings.findOne();
    console.log(JSON.stringify(settings, null, 2));
    await mongoose.disconnect();
}

dump();
