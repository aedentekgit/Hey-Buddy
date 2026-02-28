const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

const testParse = async () => {
    try {
        console.log("1. Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "admin@buddy.com",
            password: "admin123"
        });

        const token = loginRes.data.token || (loginRes.data.data && loginRes.data.data.token);
        console.log("Login successful. Token:", token ? "YES" : "NO");

        console.log("2. Testing Voice Parse...");
        const text = "Remind me to have a meeting with the team tomorrow at 2 PM";

        console.log(`Sending text: "${text}"`);

        const parseRes = await axios.post(`${API_URL}/voice/parse`, {
            text: text,
            language: 'en-US'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Parse Response Status:", parseRes.status);
        if (parseRes.data.data.audio) {
            console.log("Audio Data length:", parseRes.data.data.audio.length);
        } else {
            console.log("Audio Data: NULL");
        }
        console.log("Parse Response Date:", JSON.stringify(parseRes.data, (k, v) => k === 'audio' ? undefined : v, 2));

    } catch (error) {
        console.error("Parse Test Failed:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
};

testParse();
