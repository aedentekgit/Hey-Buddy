const { io } = require('socket.io-client');

const socket = io('http://localhost:5001', {
    transports: ['websocket'],
    auth: { token: 'null' } // Connect as Guest
});

console.log('--- [Self-Test] Initiating Connection to Buddy Backend ---');

socket.on('connect', () => {
    console.log('✅ Connected to Backend! ID:', socket.id);

    console.log('📤 Sending setup_agent (Manual Mode)...');
    socket.emit('setup_agent', {
        language: 'en-US',
        standby: false // Start in active mode for quick testing
    });

    // Wait a moment for initialization, then send a message
    setTimeout(() => {
        console.log('⌨️ Sending test message: "Hello Buddy, how are you today?"');
        socket.emit('text_message', 'Hello Buddy, how are you today?');
    }, 2000);
});

socket.on('turn_started', () => {
    console.log('🧠 Buddy is thinking...');
});

socket.on('caption', (text) => {
    process.stdout.write(text); // Print stream text
});

socket.on('audio_out', (chunk) => {
    console.log('\n🔊 [Received Audio Chunk]:', chunk.length, 'bytes');
});

socket.on('response_done', () => {
    console.log('\n🏁 Response finished!');
    console.log('--- [Self-Test] SUCCESS: Connection, Brain, and Audio path verified. ---');
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

// Timeout fail
setTimeout(() => {
    console.error('❌ Test Timed Out - Check if AI Service (Brain) is running on port 8000.');
    process.exit(1);
}, 20000);
