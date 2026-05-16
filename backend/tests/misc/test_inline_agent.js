const mongoose = require('mongoose');
const BuddyAgent = require('./agents/BuddyAgent');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mockSocket = {
    id: 'test_socket_id',
    emit: (event, ...args) => {
        console.log(`[MockSocket Emit] ${event}:`, args.length === 1 && typeof args[0] === 'string' ? args[0] : JSON.stringify(args).substring(0, 100));
    }
};

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to DB. Starting BuddyAgent inline...');
    const agent = new BuddyAgent('test_user_id', mockSocket, 'en-US', null, false);

    // Give it 3 seconds to connect and then send text
    setTimeout(() => {
        console.log('Sending text: hlo');
        agent.handleText('hlo');
    }, 3000);

    setTimeout(() => {
        console.log('Test complete. Exiting.');
        process.exit(0);
    }, 10000);
});
