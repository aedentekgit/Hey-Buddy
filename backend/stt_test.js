const { io } = require('socket.io-client');

const socket = io('http://localhost:5001', {
    transports: ['websocket'],
    auth: { token: 'null' }
});

console.log('--- [STT Handshake Test] ---');

socket.on('connect', () => {
    console.log('✅ Connected to Backend.');
    socket.emit('setup_agent', { standby: true });
});

socket.on('error', (err) => console.log('❌ Agent Error:', err));

// We will wait for the logs to show "Ears Connected"
setTimeout(() => {
    console.log('📝 Checking server logs for handshake status...');
    process.exit(0);
}, 5000);
