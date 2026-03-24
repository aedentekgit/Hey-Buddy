const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    permissions: [{
        type: String
    }],
    allowedPages: [{
        type: String
    }],
    isSystem: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    webAccess: {
        type: Boolean,
        default: true
    },
    mobileAccess: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
