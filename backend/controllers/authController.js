const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const Settings = require('../models/Settings');
const { OAuth2Client } = require('google-auth-library');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    try {
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            const role = await Role.findOne({ name: user.role });
            const platform = req.headers['x-platform'] || 'web';

            if (role) {
                if (platform === 'web' && !role.webAccess) {
                    return res.status(403).json({ success: false, message: 'Your account does not have permission to access the Web platform.' });
                }
                if (platform === 'mobile' && !role.mobileAccess) {
                    return res.status(403).json({ success: false, message: 'Your account does not have permission to access the Mobile platform.' });
                }
            }

            const prefs = user.voicePreferences || { gender: 'female', tone: 'soft' };
            let pitch = 1.0;
            let speechRate = 0.5;
            if (prefs.gender === 'male') { pitch = 0.8; } else { pitch = 1.1; }
            if (prefs.tone === 'soft') { speechRate = 0.45; pitch -= 0.1; }
            else if (prefs.tone === 'energetic') { speechRate = 0.6; pitch += 0.1; }

            res.json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    profilePicture: user.profilePicture,
                    voicePreferences: user.voicePreferences,
                    resolvedVoiceConfig: { pitch, speechRate },
                    permissions: role ? role.permissions : [],
                    allowedPages: role ? role.allowedPages : [],
                    webAccess: role ? role.webAccess : true,
                    mobileAccess: role ? role.mobileAccess : true,
                    token: generateToken(user._id),
                },
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const googleLogin = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ success: false, message: 'Google ID Token is missing' });
    }

    try {
        // Fetch dynamic settings from database
        const settings = await Settings.findOne().select('googleAuth');
        if (!settings || !settings.googleAuth?.enabled) {
            return res.status(400).json({ success: false, message: 'Google authentication is currently disabled' });
        }

        const { webClientId, androidClientId, iosClientId } = settings.googleAuth;
        const audiences = [webClientId, androidClientId, iosClientId].filter(Boolean);

        if (audiences.length === 0) {
            return res.status(400).json({ success: false, message: 'Google Client IDs not configured' });
        }

        console.log('Verifying Google token against audiences:', audiences);

        const client = new OAuth2Client(webClientId); // Use webClientId as primary
        const ticket = await client.verifyIdToken({
            idToken,
            audience: audiences
        });

        const payload = ticket.getPayload();
        const { name, sub } = payload;
        const email = payload.email.toLowerCase(); // Ensure lowercase to match Mongoose schema

        console.log('Google user verified:', email);

        let user = await User.findOne({ email });

        if (!user) {
            console.log('Creating new user for Google login:', email);
            try {
                user = await User.create({
                    name,
                    email,
                    password: sub, // Social password placeholder
                    role: 'user',
                    googleRefreshToken: null // Explicit null
                });
            } catch (createError) {
                console.error('User creation failed:', createError);
                // Handle race condition or duplicate key error
                if (createError.code === 11000) {
                    user = await User.findOne({ email });
                    if (!user) throw createError;
                } else {
                    throw createError;
                }
            }
        }

        const role = await Role.findOne({ name: user.role });
        const platform = req.headers['x-platform'] || 'web';

        if (role) {
            if (platform === 'web' && !role.webAccess) {
                return res.status(403).json({ success: false, message: 'Your account does not have permission to access the Web platform.' });
            }
            if (platform === 'mobile' && !role.mobileAccess) {
                return res.status(403).json({ success: false, message: 'Your account does not have permission to access the Mobile platform.' });
            }
        }

        const prefs = user.voicePreferences || { gender: 'female', tone: 'soft' };
        let pitch = 1.0;
        let speechRate = 0.5;
        if (prefs.gender === 'male') { pitch = 0.8; } else { pitch = 1.1; }
        if (prefs.tone === 'soft') { speechRate = 0.45; pitch -= 0.1; }
        else if (prefs.tone === 'energetic') { speechRate = 0.6; pitch += 0.1; }

        res.json({
            success: true,
            data: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                profilePicture: user.profilePicture,
                voicePreferences: user.voicePreferences,
                resolvedVoiceConfig: { pitch, speechRate },
                permissions: role ? role.permissions : [],
                allowedPages: role ? role.allowedPages : [],
                webAccess: role ? role.webAccess : true,
                mobileAccess: role ? role.mobileAccess : true,
                dateFormat: user.dateFormat || 'DD/MM/YYYY',
                timeFormat: user.timeFormat || '12',
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        console.error('Google Verification/Login Error:', error);
        res.status(500).json({ success: false, message: `Google Auth Error: ${error.message}` });
    }
};

const signup = async (req, res) => {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    try {
        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: 'user' // Explicitly setting as per request, although it's the default
        });

        if (user) {
            const role = await Role.findOne({ name: user.role });
            res.status(201).json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    profilePicture: user.profilePicture,
                    permissions: role ? role.permissions : [],
                    allowedPages: role ? role.allowedPages : [],
                    dateFormat: user.dateFormat || 'DD/MM/YYYY',
                    timeFormat: user.timeFormat || '12',
                    token: generateToken(user._id),
                },
            });
        } else {
            res.status(400).json({ success: false, message: 'Invalid user data' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const guestLogin = async (req, res) => {
    try {
        const platform = req.headers['x-platform'] || 'web';

        // Return consistent 'guest' data structure
        res.json({
            success: true,
            data: {
                _id: 'guest_' + Math.random().toString(36).substr(2, 9),
                email: 'guest@buddy.internal',
                name: 'Guest User',
                role: 'guest',
                profilePicture: null,
                voicePreferences: { gender: 'female', tone: 'soft' },
                resolvedVoiceConfig: { pitch: 1.1, speechRate: 0.5 },
                permissions: ['buddy'],
                allowedPages: ['buddy'],
                webAccess: true,
                mobileAccess: true,
                token: null, // No token for guests, backend will use protectOptional
                isGuest: true
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        const role = await Role.findOne({ name: user.role });

        const userData = user.toObject();
        userData.permissions = role ? role.permissions : [];
        userData.allowedPages = role ? role.allowedPages : [];

        const prefs = userData.voicePreferences || { gender: 'female', tone: 'soft' };
        let pitch = 1.0;
        let speechRate = 0.5;
        if (prefs.gender === 'male') { pitch = 0.8; } else { pitch = 1.1; }
        if (prefs.tone === 'soft') { speechRate = 0.45; pitch -= 0.1; }
        else if (prefs.tone === 'energetic') { speechRate = 0.6; pitch += 0.1; }
        userData.resolvedVoiceConfig = { pitch, speechRate };

        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const setupVPS = async (req, res) => {
    try {
        // 1. Seed Roles
        const defaultRoles = [
            {
                name: 'admin',
                description: 'System Administrator with full access',
                permissions: ['dashboard', 'analytics', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders', 'management'],
                allowedPages: ['dashboard', 'users', 'roles', 'settings', 'buddy', 'memories', 'reminders', 'management'],
                isSystem: true,
                webAccess: true,
                mobileAccess: true
            },
            {
                name: 'user',
                description: 'Standard User',
                permissions: ['dashboard', 'buddy', 'memories', 'reminders', 'settings'],
                allowedPages: ['dashboard', 'buddy', 'memories', 'reminders', 'settings'],
                isSystem: true,
                webAccess: true,
                mobileAccess: true
            }
        ];

        for (const roleData of defaultRoles) {
            await Role.findOneAndUpdate(
                { name: roleData.name },
                roleData,
                { upsert: true, new: true }
            );
        }

        // 2. Seed Admin User
        const adminEmail = 'admin@buddy.com';
        let admin = await User.findOne({ email: adminEmail });

        if (!admin) {
            admin = await User.create({
                name: 'Administrator',
                email: adminEmail,
                password: 'admin123',
                role: 'admin'
            });
        } else {
            admin.role = 'admin';
            admin.password = 'admin123'; // Reset password for easy setup
            await admin.save();
        }

        res.json({
            success: true,
            message: 'VPS Database Initialized Successfully!',
            credentials: {
                email: adminEmail,
                password: 'admin123'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    login,
    signup,
    googleLogin,
    getMe,
    guestLogin,
    setupVPS
};
