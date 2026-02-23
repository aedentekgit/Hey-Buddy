const BuddyAgent = require('../agents/BuddyAgent');
const jwt = require('jsonwebtoken');

const voiceHandler = (io) => {
    // Map to track active agents per socket
    const activeAgents = new Map();

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Auth error'));

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch (err) {
            next(new Error('Auth error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] 📞 New Voice Session: ${socket.id} (User: ${socket.userId})`);

        socket.on('setup_agent', (config) => {
            const { language = 'en-US' } = config || {};

            // Cleanup existing agent if any
            if (activeAgents.has(socket.id)) {
                activeAgents.get(socket.id).cleanup();
            }

            const agent = new BuddyAgent(socket.userId, socket, language);
            activeAgents.set(socket.id, agent);
            console.log(`[Socket] Agent configured for ${socket.id} with language: ${language}`);
        });

        socket.on('audio_chunk', (data) => {
            const agent = activeAgents.get(socket.id);
            if (agent) agent.handleIncomingAudio(data);
        });

        socket.on('text_message', (text) => {
            const agent = activeAgents.get(socket.id);
            if (agent) agent.handleText(text);
        });

        socket.on('user_interruption', () => {
            console.log(`[Socket] ⏹️ User interruption: ${socket.id}`);
            const agent = activeAgents.get(socket.id);
            if (agent) agent.interrupt();
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] 🛑 Voice Session Ended: ${socket.id}, Reason: ${reason}`);
            const agent = activeAgents.get(socket.id);
            if (agent) {
                agent.cleanup();
                activeAgents.delete(socket.id);
            }
        });

        socket.on('error', (err) => {
            console.error(`[Socket] ❌ Socket Error for ${socket.id}:`, err);
        });
    });
};

module.exports = voiceHandler;
