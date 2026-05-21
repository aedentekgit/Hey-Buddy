const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const s = await mongoose.connection.db.collection('settings').findOne({});
    if (s && s.ai) {
        console.log('availableVoices:', JSON.stringify(s.ai.availableVoices, null, 2));
    } else {
        console.log('No settings or no ai field. ai:', s ? JSON.stringify(s.ai) : 'no doc');
    }
    await mongoose.disconnect();
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
