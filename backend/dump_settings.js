const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Settings = require('./models/Settings');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        const settings = await Settings.findOne();
        console.log(JSON.stringify(settings, null, 2));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
