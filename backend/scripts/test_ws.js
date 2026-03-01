const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

const token = jwt.sign({ id: '6970970931bae19816f8e636' }, process.env.JWT_SECRET || 'supersecretkey123', { expiresIn: '1y' });

const socket = io('http://localhost:5001', {
    auth: { token },
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('Connected to socket server');
    socket.emit('setup_agent', { language: 'en-US', standby: false });

    setTimeout(() => {
        console.log('Sending text payload...');
        socket.emit('text_message', 'set reminder to call my mom tomorrow morning at 9');
    }, 2000);
});

socket.on('caption', (text) => process.stdout.write(text));
socket.on('user_caption', (text) => console.log('\nUser: ' + text));
socket.on('response_done', () => setTimeout(() => process.exit(0), 4000));
socket.on('error', (err) => console.error('Socket error:', err));
socket.on('disconnect', () => console.log('Disconnected.'));
