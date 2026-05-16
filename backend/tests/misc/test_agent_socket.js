const { io } = require('socket.io-client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const SERVER_URL = 'http://localhost:5001';

console.log('Connecting to Buddy Socket at:', SERVER_URL);
const socket = io(SERVER_URL, {
    auth: { token: 'null' }, // Connect as guest
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ Connected to Socket.io');

    console.log('Setting up Buddy Agent...');
    socket.emit('setup_agent', { language: 'en-US', standby: false });
});

socket.on('turn_started', () => {
    console.log('⏳ Buddy started thinking...');
});

socket.on('caption', (text) => {
    console.log('💬 Buddy Response:', text);
});

socket.on('response_done', () => {
    console.log('🏁 ✅ response_done received. Thinking state should clear.');
    process.exit(0);
});

socket.on('error', (err) => {
    console.error('❌ Socket Error:', err);
    process.exit(1);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

// Wait a bit for setup, then send a message
setTimeout(() => {
    console.log('Sending message: "hlo"');
    socket.emit('text_message', 'hlo');
}, 2000);

// Fail after 30s
setTimeout(() => {
    console.log('Timeout: No response from Buddy.');
    process.exit(1);
}, 30000);
