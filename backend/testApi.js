const axios = require('axios');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: '/Users/aedenteka/Downloads/Buddy copy 8/backend/.env' });

async function testApi() {
  const token = jwt.sign({ id: '69a63020f14dbce4a4db6859' }, process.env.JWT_SECRET);

  try {
    const res = await axios.get('http://localhost:5001/api/family/members', {
      headers: { 'Authorization': `Bearer ${token}`, 'x-platform': 'mobile' }
    });
    console.log("SUCCESS:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.error("FAILED:", err.response.data);
    } else {
      console.error("FAILED.", err.message);
    }
  }
}
testApi();
