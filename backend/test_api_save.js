const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const testApi = async () => {
    try {
        console.log("1. Logging in...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: "admin@example.com",
            password: "adminpassword123"
        });

        const token = loginRes.data.data.token;
        console.log("Login successful. Token:", token ? "YES" : "NO");

        console.log("2. Saving Reminder...");
        const saveRes = await axios.post(`${API_URL}/voice/save`, {
            saveTo: 'buddy',
            reminderData: {
                title: "API Test Reminder",
                intent: "api_test",
                condition: "none"
            }
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log("Save Response Status:", saveRes.status);
        console.log("Save Response Data:", JSON.stringify(saveRes.data, null, 2));

    } catch (error) {
        console.error("API Test Failed:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
};

testApi();
