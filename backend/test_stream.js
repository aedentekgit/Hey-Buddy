const axios = require('axios');
const mongoose = require('mongoose');

async function testNode() {
    try {
        const response = await axios.post('http://localhost:5001/api/ai/chat/stream', {
            message: "hi",
            session_id: "testsession123",
            user_id: "660c1d68a5c2f3b9abc12345" // Dummy user ID
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.INTERNAL_SECRET || 'dev_secret'}`, // Mock auth
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });

        response.data.on('data', chunk => {
            console.log(chunk.toString());
        });

        response.data.on('end', () => {
             console.log("Stream ended.");
             process.exit(0);
        });
    } catch (e) {
        console.error("Test Request Failed:", e.message);
        if (e.response) {
            console.error("Error Status:", e.response.status);
            console.error("Error Data:", e.response.data);
        }
        process.exit(1);
    }
}
testNode();
