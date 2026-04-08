const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { sendPushNotificationBatch } = require('../services/notificationService');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[Socket] New connection: ${socket.id}`);

        socket.on('join_room', (roomId) => {
            socket.join(roomId);
            console.log(`[Socket] User ${socket.id} joined room: ${roomId}`);
        });

        socket.on('send_message', async (data) => {
            try {
                const { roomId, senderId, content, replyTo, fileUrl, fileName, fileType } = data;

                if (!content && !fileUrl) {
                    return socket.emit('error', { message: "Message cannot be empty" });
                }

                // Save message to database
                const newMessage = new ChatMessage({
                    roomId,
                    senderId,
                    content,
                    replyTo,
                    fileUrl,
                    fileName,
                    fileType
                });
                await newMessage.save();

                // Update room lastMessage
                const lastMsgHint = fileUrl ? (fileType === 'image' ? '📷 Photo' : '📄 Document') : content;
                await ChatRoom.findByIdAndUpdate(roomId, {
                    lastMessage: lastMsgHint,
                    lastMessageAt: Date.now()
                });

                // Get sender info for the frontend
                const sender = await User.findById(senderId, 'name profilePicture');

                const messagePayload = {
                    id: newMessage._id,
                    roomId,
                    sender_id: senderId,
                    sender_name: sender.name,
                    sender_avatar: sender.profilePicture,
                    content,
                    replyTo,
                    fileUrl,
                    fileName,
                    fileType,
                    readBy: [],
                    deliveredTo: [],
                    timestamp: newMessage.createdAt
                };

                // Broadcast to the specific roomId (for those inside the chat)
                io.to(roomId).emit('new_message', messagePayload);

                // ALSO: Broadcast to each member's private room (for those outside the chat, in the hub/list)
                const room = await ChatRoom.findById(roomId).populate('members', 'fcmTokens');
                if (room) {
                    room.members.forEach(member => {
                        // send to member's personal room (userId)
                        // This allows global state to update (unread badges, last message previews)
                        if (member._id.toString() !== senderId.toString()) {
                           io.to(member._id.toString()).emit('new_message', messagePayload);
                        }
                    });

                    // Push Notifications for other members
                    const otherMembers = room.members.filter(m => m._id.toString() !== senderId.toString());
                    const fcmTokens = otherMembers.flatMap(m => m.fcmTokens || []);

                    if (fcmTokens.length > 0) {
                        await sendPushNotificationBatch(
                            fcmTokens,
                            sender.name,
                            lastMsgHint,
                            { type: 'chat_message', roomId: roomId, senderId: senderId }
                        );
                    }
                }
            } catch (error) {
                console.error("[Socket] Message error:", error);
                socket.emit('error', { message: "Failed to send message" });
            }
        });

        socket.on('react_message', async (data) => {
            try {
                const { messageId, roomId, senderId, emoji } = data;
                const message = await ChatMessage.findById(messageId);
                if (!message) return;

                // Toggle reaction: remove if exists, else add
                const existingIdx = message.reactions.findIndex(r => r.userId === senderId && r.emoji === emoji);
                if (existingIdx > -1) {
                    message.reactions.splice(existingIdx, 1);
                } else {
                    message.reactions.push({ userId: senderId, emoji });
                }
                await message.save();

                io.to(roomId).emit('message_updated', {
                    messageId,
                    roomId,
                    reactions: message.reactions
                });
            } catch (error) {
                console.error("[Socket] Reaction error:", error);
            }
        });

        socket.on('star_message', async (data) => {
            try {
                const { messageId, roomId, userId, isStarred } = data;
                const message = await ChatMessage.findById(messageId);
                if (!message) return;

                const starredIdx = message.isStarredBy.indexOf(userId);
                if (isStarred && starredIdx === -1) {
                    message.isStarredBy.push(userId);
                } else if (!isStarred && starredIdx > -1) {
                    message.isStarredBy.splice(starredIdx, 1);
                }
                await message.save();

                socket.emit('message_updated', {
                    messageId,
                    roomId,
                    isStarred: isStarred // Only send to the requester since stars are per-user
                });
            } catch (error) {
                console.error("[Socket] Star error:", error);
            }
        });

        socket.on('pin_message', async (data) => {
            try {
                const { messageId, roomId, isPinned } = data;
                const message = await ChatMessage.findById(messageId);
                if (!message) return;

                message.isPinned = isPinned;
                await message.save();

                io.to(roomId).emit('message_updated', {
                    messageId,
                    roomId,
                    isPinned
                });
            } catch (error) {
                console.error("[Socket] Pin error:", error);
            }
        });

        socket.on('forward_message', async (data) => {
            try {
                const { originalMessageId, targetRoomId, senderId } = data;
                const original = await ChatMessage.findById(originalMessageId);
                if (!original) return;

                const newMessage = new ChatMessage({
                    roomId: targetRoomId,
                    senderId,
                    content: original.content,
                    fileUrl: original.fileUrl,
                    fileName: original.fileName,
                    fileType: original.fileType,
                    forwardedFrom: originalMessageId
                });
                await newMessage.save();

                // Update room lastMessage
                const lastMsgHint = original.fileUrl ? (original.fileType === 'image' ? '📷 Photo' : '📄 Document') : original.content;
                await ChatRoom.findByIdAndUpdate(targetRoomId, {
                    lastMessage: lastMsgHint,
                    lastMessageAt: Date.now()
                });

                // Broadcast
                const populated = await newMessage.populate('senderId', 'name profilePicture');
                const formatted = {
                    id: populated._id,
                    roomId: populated.roomId,
                    content: populated.content,
                    sender_id: populated.senderId._id,
                    sender_name: populated.senderId.name,
                    sender_avatar: populated.senderId.profilePicture,
                    fileUrl: populated.fileUrl,
                    fileName: populated.fileName,
                    fileType: populated.fileType,
                    forwardedFrom: populated.forwardedFrom,
                    readBy: [],
                    deliveredTo: [],
                    timestamp: populated.createdAt
                };

                io.to(targetRoomId).emit('new_message', formatted);
            } catch (error) {
                console.error("[Socket] Forward error:", error);
            }
        });

        socket.on('mark_read', async (data) => {
            try {
                const { roomId, userId } = data;
                if (!roomId || !userId) return;

                await ChatMessage.updateMany(
                    { roomId, readBy: { $ne: userId } },
                    { $addToSet: { readBy: userId, deliveredTo: userId } }
                );

                io.to(roomId).emit('message_updated', {
                    roomId,
                    userId,
                    type: 'read'
                });
            } catch (error) {
                console.error("[Socket] Mark read error:", error);
            }
        });

        socket.on('mark_delivered', async (data) => {
            try {
                const { roomId, userId } = data;
                if (!roomId || !userId) return;

                await ChatMessage.updateMany(
                    { roomId, deliveredTo: { $ne: userId } },
                    { $addToSet: { deliveredTo: userId } }
                );

                io.to(roomId).emit('message_updated', {
                    roomId,
                    userId,
                    type: 'delivered'
                });
            } catch (error) {
                console.error("[Socket] Mark delivered error:", error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });
};
