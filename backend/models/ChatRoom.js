const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    type: {
        type: String,
        enum: ['private', 'group'],
        required: true
    },
    members: [{
        type: String,
        ref: 'User',
        required: true
    }],
    familyId: { // Filled only for family-level groups
        type: String,
        ref: 'Family',
        default: null
    },
    lastMessage: {
        type: String,
        default: null
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

chatRoomSchema.index({ members: 1 });
chatRoomSchema.index({ familyId: 1 });

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
