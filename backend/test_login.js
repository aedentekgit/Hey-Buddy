const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('http://localhost:5001/api/auth/login', { email: 'admin@buddy.com', password: 'admin123' });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
})();
