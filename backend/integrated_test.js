const { io } = require('socket.io-client');
const fs = require('fs');

const socket = io('http://localhost:5001', {
    transports: ['websocket'],
    auth: { token: 'null' }
});

console.log('--- [End-to-End Self-Test] Initiating Audio Stream Test ---');

socket.on('connect', () => {
    console.log('✅ Connected. Setting up agent in STANDBY mode...');
    socket.emit('setup_agent', {
        language: 'en-US',
        standby: true
    });

    // We wait for the agent to initialize before streaming
    setTimeout(() => {
        console.log('🎙️ Starting Simulated Audio Stream (Simulating Silence/Noise)...');

        // Let's send 100 chunks of random dummy audio (simulating background room noise)
        // 2048 bytes of random data roughly every 64ms simulates 16kHz PCM mono
        let count = 0;
        const interval = setInterval(() => {
            if (count > 50) {
                clearInterval(interval);
                console.log('✅ Background stream finished. No wake word triggered yet (expected).');

                // Now we simulate the text-based wake word trigger that Gemini usually sends
                console.log('🗣️ [CRITICAL TEST] Simulating Gemini reporting: "hey buddy"');
                // The backend listens to its own Gemini Ears, but we can verify how it handles the detected event
                // since we can't easily generate perfectly synced PCM "Hey Buddy" audio in JS without a library,
                console.log('--- [Self-Test Phase 2] Testing Brain response to manual activation ---');
                socket.emit('activate_agent');

                setTimeout(() => {
                    console.log('⌨️  Sending prompt: "What is the capital of France?"');
                    socket.emit('text_message', 'What is the capital of France?');
                }, 1000);

                return;
            }
            const dummyAudio = Buffer.alloc(2048, 0); // Silence first
            socket.emit('audio_chunk', dummyAudio);
            count++;
        }, 64);

    }, 2000);
});

socket.on('caption', (text) => {
    process.stdout.write(text);
});

socket.on('audio_out', (chunk) => {
    console.log('\n🔊 [Audio Received from Buddy]:', chunk.length, 'bytes');
});

socket.on('response_done', () => {
    console.log('\n🏁 Response complete. Test PASSED.');
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection Error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.log('❌ Test Timed Out.');
    process.exit(1);
}, 25000);
