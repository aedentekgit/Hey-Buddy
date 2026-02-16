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

    try {
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            const role = await Role.findOne({ name: user.role });

            res.json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    profilePicture: user.profilePicture,
                    permissions: role ? role.permissions : [],
                    allowedPages: role ? role.allowedPages : [],
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

        res.json({
            success: true,
            data: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                profilePicture: user.profilePicture,
                permissions: role ? role.permissions : [],
                allowedPages: role ? role.allowedPages : [],
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

const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        const role = await Role.findOne({ name: user.role });

        const userData = user.toObject();
        userData.permissions = role ? role.permissions : [];
        userData.allowedPages = role ? role.allowedPages : [];

        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    login,
    signup,
    googleLogin,
    getMe
};
