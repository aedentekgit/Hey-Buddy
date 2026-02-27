require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const jwt = require('jsonwebtoken');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: 'admin@buddy.com' });
    if (!user) { console.log("No user"); process.exit(1); }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Fallback to fetch API so no axios is needed
    try {
        const res = await fetch('http://localhost:5001/api/settings', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch err: ", err);
    }
    process.exit(0);
})();
