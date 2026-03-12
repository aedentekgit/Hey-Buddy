const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    name: {
        type: String,
        default: "Our Family"
    },
    members: [{
        type: String,
        ref: 'User'
    }],
    groupChatId: {
        type: String, // Filled when group chat is created
        default: null
    }
}, { timestamps: true });

familySchema.index({ members: 1 });

module.exports = mongoose.model('Family', familySchema);
