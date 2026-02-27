const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const token = jwt.sign({ id: '6970970931bae19816f8e636', role: 'user' }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

async function testApi() {
    try {
        console.log("Calling preview API based on user prefs (Male, Energetic)...");
        const res = await axios.get('http://localhost:5001/api/voice/preview-voice?gender=male&tone=energetic', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status:", res.status);
        if (res.data.success) {
            console.log("Success! Voice Name Used:", res.data.voiceName);
            console.log("Audio Size (bytes):", res.data.audio.length);
        } else {
            console.log("API returned success: false");
        }
    } catch (err) {
        console.log("Error:", err.response ? err.response.data : err.message);
    }
}
testApi();
