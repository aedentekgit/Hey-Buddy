const axios = require('axios');

const testSignup = async () => {
    try {
        const response = await axios.post('http://localhost:5001/api/auth/signup', {
            name: 'Test User',
            email: `test_${Date.now()}@example.com`,
            password: 'password123'
        });
        console.log('Signup Success:', response.data);
    } catch (error) {
        console.error('Signup Failed:', error.response ? error.response.data : error.message);
    }
};

testSignup();
