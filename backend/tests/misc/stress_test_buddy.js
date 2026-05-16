const { io } = require('socket.io-client');

const TOTAL_TESTS = 50;
const CONCURRENCY = 5; // Run 5 at a time
let successCount = 0;
let failCount = 0;

async function runSingleTest(testId) {
    return new Promise((resolve) => {
        const socket = io('http://localhost:5001', {
            transports: ['websocket'],
            auth: { token: 'null' },
            forceNew: true,
            timeout: 10000
        });

        const testTimeout = setTimeout(() => {
            console.log(`❌ Test #${testId}: TIMED OUT`);
            socket.disconnect();
            failCount++;
            resolve();
        }, 25000);

        socket.on('connect', () => {
            socket.emit('setup_agent', { standby: false });

            let chunksSent = 0;
            const audioInterval = setInterval(() => {
                if (chunksSent >= 10) { // Send 10 chunks faster
                    clearInterval(audioInterval);
                    socket.emit('text_message', `Ping #${testId}`);
                    return;
                }
                const buffer = Buffer.alloc(1024);
                for (let i = 0; i < 1024; i++) buffer[i] = Math.floor(Math.random() * 256);
                socket.emit('audio_chunk', buffer);
                chunksSent++;
            }, 30);
        });

        socket.on('response_done', () => {
            clearTimeout(testTimeout);
            successCount++;
            socket.disconnect();
            resolve();
        });

        socket.on('connect_error', (err) => {
            clearTimeout(testTimeout);
            console.log(`❌ Test #${testId}: CONNECT ERROR - ${err.message}`);
            failCount++;
            socket.disconnect();
            resolve();
        });

        socket.on('error', (err) => {
            clearTimeout(testTimeout);
            console.log(`❌ Test #${testId}: SOCKET ERROR - ${err}`);
            failCount++;
            socket.disconnect();
            resolve();
        });
    });
}

async function runStressTest() {
    console.log(`🚀 Accelerated Stress Test: ${TOTAL_TESTS} sessions (${CONCURRENCY} concurrent)...\n`);
    const startTime = Date.now();

    for (let i = 0; i < TOTAL_TESTS; i += CONCURRENCY) {
        const batch = [];
        for (let j = 1; j <= CONCURRENCY && (i + j) <= TOTAL_TESTS; j++) {
            batch.push(runSingleTest(i + j));
        }
        await Promise.all(batch);
        console.log(`📊 Progress: ${Math.min(i + CONCURRENCY, TOTAL_TESTS)}/${TOTAL_TESTS} completed...`);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log('\n====================================');
    console.log('🏁 STRESS TEST RESULT');
    console.log('====================================');
    console.log(`Total Attempts: ${TOTAL_TESTS}`);
    console.log(`Successes:      ${successCount} ✅`);
    console.log(`Failures:       ${failCount} ❌`);
    console.log(`Total Time:     ${duration.toFixed(2)}s`);
    console.log('====================================');

    process.exit(failCount > 0 ? 1 : 0);
}

runStressTest();
