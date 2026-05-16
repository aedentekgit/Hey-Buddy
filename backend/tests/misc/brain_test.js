const { io } = require('socket.io-client');

const socket = io('http://localhost:5001', {
    transports: ['websocket'],
    auth: { token: 'null' }
});

console.log('--- [Brain-Verification] Testing Python Response via Socket ---');

socket.on('connect', () => {
    console.log('✅ Connected.');
    socket.emit('setup_agent', { standby: false });

    setTimeout(() => {
        console.log('⌨️ Sending: "Who are you?"');
        socket.emit('text_message', 'Who are you?');
    }, 1500);
});

socket.on('caption', (text) => {
    console.log('[Buddy]:', text);
});

socket.on('audio_out', (chunk) => {
    console.log('🔊 Received Audio:', chunk.length, 'bytes');
});

socket.on('response_done', () => {
    console.log('🏁 Test finished.');
    process.exit(0);
});

setTimeout(() => {
    console.log('❌ Timeout.');
    process.exit(1);
}, 15000);
