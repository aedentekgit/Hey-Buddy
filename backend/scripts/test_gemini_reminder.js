const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: './.env' });
const token = jwt.sign({ id: '6970970931bae19816f8e636' }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '1y' });

async function test() {
    const API_URL = 'http://localhost:5001/api';
    console.log("Asking bot to create a reminder...");
    try {
        let res = await axios.post(`${API_URL}/voice/parse`, {
            text: 'Remind me to call mother tomorrow evening at 5 PM',
            history: []
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Bot Response 1:", res.data.data.reply);
        let convId = res.data.meta.conversationId;

        // confirm
        res = await axios.post(`${API_URL}/voice/parse`, {
            text: 'yes please set it',
            history: [{ role: 'user', content: 'Remind me to call mother tomorrow evening at 5 PM' }, { role: 'assistant', content: res.data.data.reply }],
            conversationId: convId
        }, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Bot Response 2:", res.data.data.reply);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();
