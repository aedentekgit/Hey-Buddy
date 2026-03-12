const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] New connection: ${socket.id}`);

        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`[Socket] User ${socket.id} joined room: ${roomId}`);
        });

        socket.on('send_message', async (data) => {
            try {
                const { roomId, senderId, content } = data;

                // Save message to database
                const newMessage = new ChatMessage({
                    roomId,
                    senderId,
                    content
                });
                await newMessage.save();

                // Update room lastMessage
                await ChatRoom.findByIdAndUpdate(roomId, {
                    lastMessage: content,
                    lastMessageAt: Date.now()
                });

                // Get sender info for the frontend
                const sender = await User.findById(senderId, 'name profilePicture');

                // Broadcast message to everyone in the room
                io.to(roomId).emit('new_message', {
                    id: newMessage._id,
                    roomId,
                    sender_id: senderId,
                    sender_name: sender.name,
                    sender_avatar: sender.profilePicture,
                    content,
                    timestamp: newMessage.createdAt
                });
            } catch (error) {
                console.error("[Socket] Message error:", error);
                socket.emit('error', { message: "Failed to send message" });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });
};
