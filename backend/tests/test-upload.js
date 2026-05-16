const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
    const formData = new FormData();
    // Create a dummy image
    const dummyImagePath = path.join(__dirname, 'dummy.png');
    fs.writeFileSync(dummyImagePath, 'dummy content');

    formData.append('logo', fs.createReadStream(dummyImagePath));
    formData.append('general', JSON.stringify({
        companyName: 'Test Company',
        address: 'Test Address',
        phone: '1234567890'
    }));

    try {
        const res = await axios.put('http://localhost:5001/api/settings', formData, {
            headers: {
                ...formData.getHeaders(),
                'Authorization': `Bearer ${process.argv[2]}` // Pass token as arg
            }
        });
        console.log('Success:', res.data.success);
        console.log('Logo Path:', res.data.data.general.logo);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    } finally {
        fs.unlinkSync(dummyImagePath);
    }
}

testUpload();
