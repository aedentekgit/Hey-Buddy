require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@buddy.com' });
    if (!user) { console.log("No user"); process.exit(1); }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const axios = require('axios');
    const res = await axios.get('http://localhost:5001/api/settings', { headers: { Authorization: 'Bearer ' + token } });
    console.log(JSON.stringify(res.data, null, 2));
    process.exit(0);
})();
