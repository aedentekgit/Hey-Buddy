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
    googleEmail: {
        type: String,
        default: null,
        trim: true,
        lowercase: true
    },
    googleCalendarConnected: {
        type: Boolean,
        default: false
    },
    fcmTokens: [{
        type: String
    }],
    familyId: {
        type: String, // String ID for simplicity with current _id: String pattern
        ref: 'Family',
        default: null
    },
    voicePreferences: {
        voiceId: {
            type: String,
            default: 'Puck'
        },
        gender: {
            type: String,
            enum: ['male', 'female'],
            default: 'male'
        },
        tone: {
            type: String,
            enum: ['soft', 'normal', 'energetic'],
            default: 'normal'
        },
        voiceEnabled: {
            type: Boolean,
            default: true   // true = voice ON (normal behaviour)
        }
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'DD/MM/YYYY'
    },
    timeFormat: {
        type: String,
        enum: ['12', '24'],
        default: '12'
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
        voice: {
            enabled: { type: Boolean, default: true }
        },
        push: {
            enabled: { type: Boolean, default: true }
        },
        sms: {
            enabled: { type: Boolean, default: false }
        },
        email: {
            enabled: { type: Boolean, default: true }
        },
        inApp: {
            enabled: { type: Boolean, default: true }
        }
    },
    resetPasswordOtp: String,
    resetPasswordExpires: Date,
    resetPasswordAttempts: {
        type: Number,
        default: 0
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
userSchema.index({ fcmTokens: 1 });

module.exports = mongoose.model('User', userSchema);
