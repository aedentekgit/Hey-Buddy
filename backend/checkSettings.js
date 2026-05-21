const mongoose = require('mongoose');
const Settings = require('./models/Settings');

async function run() {
    if (!process.env.MONGODB_URI) {
        console.error("MONGODB_URI env var is not set!");
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const settings = await Settings.findOne();
    console.log("MOBILE APP SETTINGS:");
    console.log(JSON.stringify(settings?.mobileApp || null, null, 2));
    console.log("GENERAL SETTINGS:");
    console.log(JSON.stringify(settings?.general || null, null, 2));
    process.exit(0);
}

run();
