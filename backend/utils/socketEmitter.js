const logger = require('./logger');

/**
 * Emits a real-time data sync event to specific users via Socket.io
 * @param {import('express').Request} req - Express request to get 'io'
 * @param {string|string[]} userIds - User ID or array of IDs to notify
 * @param {string} type - data type ('reminder', 'task', 'memory', 'profile', 'family')
 * @param {string} action - action performed ('create', 'update', 'delete')
 * @param {object} payload - optional extra data
 */
const emitDataSync = (req, res, userIds = [], type, action, payload = {}) => {
    const io = req.app.get('io');
    if (!io) {
        logger.warn('[SocketEmitter] IO instance not found on app');
        return;
    }

    const ids = Array.isArray(userIds) ? userIds : [userIds];
    const uniqueIds = [...new Set(ids.filter(id => id && id.toString() !== 'null'))];

    uniqueIds.forEach(id => {
        const userIdStr = id.toString();
        logger.info(`[SocketEmitter] Sending ${type} sync (${action}) to user: ${userIdStr}`);
        io.to(userIdStr).emit('data_sync', {
            type,
            action,
            payload,
            timestamp: new Date().toISOString()
        });
    });
};

module.exports = { emitDataSync };
