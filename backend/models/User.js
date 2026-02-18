const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toHexString(),
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    profilePicture: {
        type: String,
        default: null
    },
    role: {
        type: String,
        default: 'user'
    },
    googleRefreshToken: {
        type: String,
        default: null
    },
    fcmTokens: [{
        type: mongoose.Schema.Types.Mixed
    }],
    voicePreferences: {
        gender: {
            type: String,
            enum: ['male', 'female'],
            default: 'female'
        },
        tone: {
            type: String,
            enum: ['soft', 'normal', 'energetic'],
            default: 'soft'
        }
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    currentLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date
    },
    previousLocation: {
        lat: Number,
        lng: Number,
        timestamp: Date
    },
    notificationPreferences: {
        push: {
            enabled: { type: Boolean, default: true },
            delay: { type: Number, default: 0 }
        },
        sms: {
            enabled: { type: Boolean, default: false },
            delay: { type: Number, default: 5 }
        },
        email: {
            enabled: { type: Boolean, default: true },
            delay: { type: Number, default: 0 }
        },
        inApp: {
            enabled: { type: Boolean, default: true },
            delay: { type: Number, default: 0 }
        }
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ role: 1 });
userSchema.index({ googleRefreshToken: 1 });

module.exports = mongoose.model('User', userSchema);
