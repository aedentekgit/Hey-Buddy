const axios = require('axios');

async function run() {
  const start = Date.now();
  console.log('Sending request...');
  try {
    const res = await axios.post('http://localhost:3000/api/voice/parse', {
      text: "How are you doing today? Just testing latency.",
      language: "en-US"
    }, { headers: { 'Content-Type': 'application/json' }});
    console.log('Done! Total time:', Date.now() - start, 'ms');
  } catch (e) {
    if (e.response) {
      console.log('Error data:', e.response.data);
    } else {
      console.log('Error:', e.message);
    }
  }
}

run();
