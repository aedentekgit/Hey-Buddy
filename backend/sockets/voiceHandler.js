const BuddyAgent = require('../agents/BuddyAgent');
const jwt = require('jsonwebtoken');

// Map to track active agents per socket
const activeAgents = new Map();

const findAgentByUserId = (userId) => {
    // Return the most recently created agent for this user
    const agents = Array.from(activeAgents.values())
        .filter(agent => agent.userId === userId.toString())
        .sort((a, b) => b.createdAt - a.createdAt);
    return agents.length > 0 ? agents[0] : null;
};

const voiceHandler = (io) => {

    io.use((socket, next) => {
        const token = socket.handshake.auth.token;

        // DEVELOPMENT ONLY: Allow unauthenticated connections when explicitly enabled.
        // NEVER enable this flag in production or staging environments.
        if (process.env.DISABLE_AUTH === 'true') {
            socket.userId = `dev_${socket.id}`;
            return next();
        }

        if (!token || token === 'null' || token === 'undefined') {
            console.warn(`[Socket] Rejected unauthenticated connection from ${socket.id}`);
            return next(new Error('Authentication required. Please provide a valid JWT token.'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch (err) {
            console.warn(`[Socket] Auth failed for ${socket.id}: ${err.message}`);
            return next(new Error('Authentication failed: session may have expired.'));
        }
    });

    io.on('connection', (socket) => {
        const transport = socket.conn.transport.name; // 'polling' or 'websocket'
        console.log(`[Socket] 📞 New Voice Session: ${socket.id} (User: ${socket.userId}) [Transport: ${transport}]`);

        // Join a private room for this user to receive targeted notifications
        socket.join(socket.userId);

        socket.on('setup_agent', (config) => {
            const { language = 'en-US', conversationId = null, standby = false } = config || {};

            // Cleanup existing agent if any
            if (activeAgents.has(socket.id)) {
                activeAgents.get(socket.id).cleanup();
            }

            try {
                const agent = new BuddyAgent(socket.userId, socket, language, conversationId, standby);
                // Cap activeAgents Map to prevent unbounded growth
                if (activeAgents.size >= 500) {
                    // Evict oldest entry
                    const oldestKey = activeAgents.keys().next().value;
                    const oldest = activeAgents.get(oldestKey);
                    if (oldest && typeof oldest.cleanup === 'function') oldest.cleanup();
                    activeAgents.delete(oldestKey);
                }
                activeAgents.set(socket.id, agent);
                console.log(`[Socket] Agent configured for ${socket.id} (Standby: ${standby})`);
            } catch (err) {
                console.error(`[Socket] ❌ Failed to create agent for ${socket.id}:`, err);
                socket.emit('error', 'Failed to initialize AI assistant.');
            }
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

        socket.on('activate_agent', () => {
            const agent = activeAgents.get(socket.id);
            if (agent) agent.activate(true); // Continuous mode by default for web/Flutter
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] 🛑 Voice Session Ended: ${socket.id}, Reason: ${reason}`);
            // Explicit socket.io room cleanup
            socket.rooms.forEach(room => socket.leave(room));
            const agent = activeAgents.get(socket.id);
            if (agent) {
                if (typeof agent.cleanup === 'function') agent.cleanup();
                activeAgents.delete(socket.id);
            }
        });

        socket.on('error', (err) => {
            console.error(`[Socket] ❌ Socket Error for ${socket.id}:`, err);
        });
    });
};

module.exports = voiceHandler;
module.exports.activeAgents = activeAgents;
module.exports.findAgentByUserId = findAgentByUserId;
