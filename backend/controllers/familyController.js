const User = require('../models/User');
const Family = require('../models/Family');
const FamilyRequest = require('../models/FamilyRequest');
const ChatRoom = require('../models/ChatRoom');
const Notification = require('../models/Notification');
const { sendPushNotificationBatch } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const { emitDataSync } = require('../utils/socketEmitter');

// POST /family/request
exports.sendFamilyRequest = async (req, res) => {
    try {
        const { email } = req.body;
        const senderId = req.user._id;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        const sender = await User.findById(senderId);
        const recipient = await User.findOne({ email: email.toLowerCase() });

        // Check if a request already exists
        const existingRequest = await FamilyRequest.findOne({
            senderId,
            email: email.toLowerCase(),
            status: 'pending'
        });

        if (existingRequest) {
            return res.status(400).json({ success: false, message: "Request already pending" });
        }

        const newRequest = new FamilyRequest({
            senderId,
            email: email.toLowerCase(),
            recipientId: recipient ? recipient._id : null
        });

        await newRequest.save();

        if (recipient) {
            // Send Push Notification
            if (recipient.fcmTokens && recipient.fcmTokens.length > 0) {
                await sendPushNotificationBatch(
                    recipient.fcmTokens,
                    "Family Connection Request",
                    `${sender.name} wants to connect with you in the Family Hub.`,
                    { type: 'family_request', requestId: newRequest._id }
                );
            }

            // Also create an in-app notification
            const notification = new Notification({
                userId: recipient._id,
                title: "Family Request",
                message: `${sender.name} invited you to join their family.`,
                type: 'system',
                actionUrl: '/family-hub'
            });
            await notification.save();
        } else {
            // Send Email Invitation
            const appUrl = process.env.FRONTEND_URL || 'https://buddy.ayuskart.com';
            try {
                await sendEmail(
                    email,
                    "Invitation to join Buddy Family Hub",
                    `Hi, ${sender.name} has invited you to join their family on Buddy AI. Download the app to connect!`,
                    `<p>Hi,</p><p><strong>${sender.name}</strong> has invited you to join their family on Buddy AI.</p><p>Buddy AI helps families stay connected with shared reminders, location safety, and real-time chat.</p><p><a href="${appUrl}/signup">Click here to sign up and join</a></p>`
                );
            } catch (emailError) {
                console.error("Failed to send invitation email, but request was created:", emailError.message);
                // We still want to return success because the request is in the database and the user can accept it in-app if they sign up later.
            }
        }

        res.status(200).json({ success: true, message: "Request sent successfully", data: newRequest });
    } catch (error) {
        console.error("Family request error:", error);
        res.status(500).json({ success: false, message: "Failed to send family request" });
    }
};

// GET /family/requests
exports.getFamilyRequests = async (req, res) => {
    try {
        const userId = req.user._id;
        const requests = await FamilyRequest.find({
            recipientId: userId,
            status: 'pending'
        }).populate('senderId', 'name email profilePicture');

        const formattedRequests = requests.map(req => ({
            request_id: req._id,
            sender_name: req.senderId.name,
            sender_email: req.senderId.email,
            sender_avatar: req.senderId.profilePicture,
            status: req.status
        }));

        res.status(200).json({ success: true, data: formattedRequests });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch requests" });
    }
};

// POST /family/respond
exports.respondToRequest = async (req, res) => {
    try {
        const { request_id, action } = req.body;
        const userId = req.user._id;

        const request = await FamilyRequest.findById(request_id);
        if (!request || request.recipientId !== userId) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        if (action === 'decline') {
            request.status = 'declined';
            await request.save();
            
            // EMIT REAL-TIME SYNC: Notify sender of the decline
            emitDataSync(req, res, request.senderId, 'family', 'decline', { id: request_id });

            return res.status(200).json({ success: true, message: "Request declined" });
        }

        if (action === 'accept') {
            request.status = 'accepted';
            await request.save();

            const sender = await User.findById(request.senderId);
            const recipient = await User.findById(userId);

            let family;
            if (sender.familyId) {
                family = await Family.findById(sender.familyId);
            } else if (recipient.familyId) {
                family = await Family.findById(recipient.familyId);
            }

            if (!family) {
                // Create new Family
                family = new Family({
                    members: [sender._id, recipient._id]
                });
                await family.save();

                // Create family group chat
                const chatRoom = new ChatRoom({
                    type: 'group',
                    members: [sender._id, recipient._id],
                    familyId: family._id
                });
                await chatRoom.save();
                family.groupChatId = chatRoom._id;
                await family.save();
            } else {
                // Add to existing Family
                if (!family.members.includes(recipient._id)) {
                    family.members.push(recipient._id);
                }
                if (!family.members.includes(sender._id)) {
                    family.members.push(sender._id);
                }
                await family.save();

                // Update family group chat members
                const groupChat = await ChatRoom.findById(family.groupChatId);
                if (groupChat) {
                    if (!groupChat.members.includes(recipient._id)) groupChat.members.push(recipient._id);
                    if (!groupChat.members.includes(sender._id)) groupChat.members.push(sender._id);
                    await groupChat.save();
                }
            }

            // Update both users
            sender.familyId = family._id;
            recipient.familyId = family._id;
            await sender.save();
            await recipient.save();

            // Notify sender that their request was accepted
            if (sender.fcmTokens && sender.fcmTokens.length > 0) {
                await sendPushNotificationBatch(
                    sender.fcmTokens,
                    "Family Request Accepted",
                    `${recipient.name} accepted your family connection request.`,
                    { type: 'family_accept', familyId: family._id }
                );
            }

            const notification = new Notification({
                userId: sender._id,
                title: "Family Request Accepted",
                message: `${recipient.name} is now part of your family hub.`,
                type: 'system',
                actionUrl: '/family-hub'
            });
            await notification.save();

            // EMIT REAL-TIME SYNC: Notify both sender and recipient to refresh family data
            emitDataSync(req, res, [sender._id, recipient._id], 'family', 'accept', { familyId: family._id });

            return res.status(200).json({ success: true, message: "Family connection established", data: family });
        }

        res.status(400).json({ success: false, message: "Invalid action" });
    } catch (error) {
        console.error("Respond to family request error:", error);
        res.status(500).json({ success: false, message: "Failed to respond to request" });
    }
};

// GET /family/members
exports.getFamilyMembers = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        // 1. Get Pending Outgoing Requests
        const pendingRequests = await FamilyRequest.find({
            senderId: req.user._id,
            status: 'pending'
        });

        const pendingResults = pendingRequests.map(pr => ({
            user_id: `pending_${pr._id}`,
            name: pr.email.split('@')[0], 
            email: pr.email,
            status: 'pending',
            profilePicture: null
        }));

        let connectedResults = [];
        if (user.familyId) {
            const family = await Family.findById(user.familyId).populate('members', 'name email profilePicture');
            connectedResults = await Promise.all(family.members.map(async m => {
                const isMe = m._id.toString() === req.user._id.toString();
                let lastMessage = null;
                let unreadCount = 0;
                
                if (!isMe) {
                    const room = await ChatRoom.findOne({
                        type: 'private',
                        members: { $all: [req.user._id, m._id] }
                    });
                    
                    if (room) {
                        lastMessage = room.lastMessage;
                        unreadCount = await ChatMessage.countDocuments({
                            roomId: room._id,
                            senderId: { $ne: req.user._id },
                            readBy: { $ne: req.user._id }
                        });
                    }
                }

                return {
                    user_id: m._id,
                    name: isMe ? "You" : m.name,
                    email: m.email,
                    status: 'connected',
                    profilePicture: m.profilePicture,
                    lastMessage,
                    unreadCount
                };
            }));
        }

        const results = [...connectedResults, ...pendingResults];
        res.status(200).json({ success: true, data: results });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch members" });
    }
};

// DELETE /family/member/:id (Remove member)
exports.removeMember = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.user._id;

        const currentUser = await User.findById(currentUserId);
        if (!currentUser.familyId) {
            return res.status(400).json({ success: false, message: "No family group found" });
        }

        const family = await Family.findById(currentUser.familyId);
        if (!family) return res.status(404).json({ success: false, message: "Family not found" });

        // Check if removing self or someone else
        // In this app, anyone in family can remove? Or only the one who invites?
        // Let's allow removing anyone for simplicity now.

        family.members = family.members.filter(m => m !== targetUserId);

        if (family.members.length < 2) {
            // Delete family if only 1 or 0 members left
            await Family.findByIdAndDelete(family._id);
            // Clear familyId for all remaining members?
            await User.updateMany({ familyId: family._id }, { familyId: null });
        } else {
            await family.save();
            // Clear familyId for the removed user
            await User.findByIdAndUpdate(targetUserId, { familyId: null });

            // Update group chat members too
            if (family.groupChatId) {
                const groupChat = await ChatRoom.findById(family.groupChatId);
                if (groupChat) {
                    groupChat.members = groupChat.members.filter(m => m !== targetUserId);
                    await groupChat.save();
                }
            }
        }

        res.status(200).json({ success: true, message: "Member removed from family" });

        // EMIT REAL-TIME SYNC: Notify both users to refresh
        emitDataSync(req, res, [currentUserId, targetUserId], 'family', 'delete', { memberId: targetUserId });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to remove member" });
    }
};

// DELETE /family/request/:id (Cancel outgoing request)
exports.cancelFamilyRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        const userId = req.user._id;

        const result = await FamilyRequest.findOneAndDelete({
            _id: requestId,
            senderId: userId,
            status: 'pending'
        });

        if (!result) {
            return res.status(404).json({ success: false, message: "Request not found or already processed" });
        }

        res.status(200).json({ success: true, message: "Invitation cancelled" });
    } catch (error) {
        console.error("Cancel family request error:", error);
        res.status(500).json({ success: false, message: "Failed to cancel invitation" });
    }
};

// POST /family/emergency
exports.sendEmergencyAlert = async (req, res) => {
    try {
        const { message } = req.body;
        const senderId = req.user._id;
        const sender = await User.findById(senderId);

        if (!sender.familyId) {
            return res.status(400).json({ success: false, message: "No family group found to send alert to" });
        }

        const family = await Family.findById(sender.familyId).populate('members', 'fcmTokens name email');
        const recipients = family.members.filter(m => m._id.toString() !== senderId.toString());

        const fcmTokens = recipients.flatMap(r => r.fcmTokens || []);

        if (fcmTokens.length > 0) {
            await sendPushNotificationBatch(
                fcmTokens,
                "🚨 EMERGENCY ALERT!",
                `${sender.name}: ${message || 'Emergency help needed!'}`,
                { type: 'emergency', senderId: sender._id, senderName: sender.name }
            );
        }

        // Save notifications record for each member
        const notificationPromises = recipients.map(r => {
            const notif = new Notification({
                userId: r._id,
                title: "Emergency Alert",
                message: `${sender.name} sent an emergency alert: ${message || 'Help needed!'}`,
                type: 'system',
                actionUrl: '/family-hub'
            });
            return notif.save();
        });
        await Promise.all(notificationPromises);

        res.status(200).json({ success: true, message: "Emergency alert sent to all family members" });
    } catch (error) {
        console.error("Emergency alert error:", error);
        res.status(500).json({ success: false, message: "Failed to send emergency alert" });
    }
};
