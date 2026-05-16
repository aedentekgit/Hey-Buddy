const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // SECURITY: used for cryptographically secure OTP generation
const User = require('../models/User');
const Role = require('../models/Role');
const Settings = require('../models/Settings');
const { OAuth2Client } = require('google-auth-library');
const { resolveVoiceConfig } = require('../utils/personality');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

const hashOtp = (email, otp) => {
    return crypto
        .createHash('sha256')
        .update(`${String(email).toLowerCase()}:${otp}:${process.env.JWT_SECRET}`)
        .digest('hex');
};

const validateResetOtp = async (user, email, otp) => {
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) return false;
    if ((user.resetPasswordAttempts || 0) >= 5) return false;
    const isValid = user.resetPasswordOtp === hashOtp(email, otp);
    if (!isValid) {
        user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
        await user.save();
    }
    return isValid;
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
            const resolvedVoiceConfig = resolveVoiceConfig(prefs, platform);

            res.json({
                success: true,
                data: {
                    _id: user._id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    profilePicture: user.profilePicture,
                    voicePreferences: user.voicePreferences,
                    resolvedVoiceConfig,
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
    const { idToken, serverAuthCode } = req.body;

    if (!idToken && !serverAuthCode) {
        return res.status(400).json({ success: false, message: 'Google ID Token or Server Auth Code is missing' });
    }

    try {
        // Fetch dynamic settings from database including secret for OAuth exchange
        const settings = await Settings.findOne().select('+googleAuth.webClientSecret');
        if (!settings || !settings.googleAuth?.enabled) {
            return res.status(400).json({ success: false, message: 'Google authentication is currently disabled' });
        }

        const { webClientId, androidClientId, iosClientId, webClientSecret } = settings.googleAuth;
        const audiences = [webClientId, androidClientId, iosClientId].filter(Boolean);
        const clientSecret = webClientSecret;

        if (audiences.length === 0) {
            return res.status(400).json({ success: false, message: 'Google Client IDs not configured' });
        }

        let payload;
        let refresh_token;

        // Step 1: Handle Server Auth Code (Preferential for fresh refresh tokens)
        if (serverAuthCode && clientSecret) {
            try {
                console.log('[Auth] Exchanging Server Auth Code for tokens...');
                const oAuth2Client = new OAuth2Client(webClientId, clientSecret, 'postmessage');
                const { tokens } = await oAuth2Client.getToken(serverAuthCode);

                if (tokens.id_token) {
                    const ticket = await oAuth2Client.verifyIdToken({
                        idToken: tokens.id_token,
                        audience: audiences
                    });
                    payload = ticket.getPayload();
                }

                if (tokens.refresh_token) {
                    refresh_token = tokens.refresh_token;
                    console.log('[Auth] New Refresh Token obtained from code exchange.');
                }
            } catch (authError) {
                console.warn('[Auth] Code exchange failed:', authError.message);
                if (!idToken) throw authError; // Fail if this was our only source
            }
        }

        // Step 2: Handle fallback to direct idToken verification if needed
        if (!payload && idToken) {
            console.log('[Auth] Verifying direct ID Token...');
            const client = new OAuth2Client(webClientId);
            const ticket = await client.verifyIdToken({
                idToken,
                audience: audiences
            });
            payload = ticket.getPayload();
        }

        if (!payload) {
            throw new Error('Could not verify Google identity from provided credentials');
        }

        const { name, sub } = payload;
        const email = payload.email.toLowerCase();

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

        if (refresh_token) {
            user.googleRefreshToken = refresh_token;
            console.log('[Auth] New Refresh Token obtained for user:', email);
        } else {
            // Google only returns a refresh_token on first auth OR when prompt=consent is forced.
            // If we didn't get one, keep the EXISTING stored token (if any) — don't overwrite it.
            console.log('[Auth] No new refresh token returned. Using existing stored token (if any) for:', email);
        }

        // Always store the Google email for identification
        user.googleEmail = email;

        // Only mark calendar as connected if we actually have a refresh token stored
        // This is accurate — if no token exists, calendar sync won't work
        user.googleCalendarConnected = !!(user.googleRefreshToken);

        console.log(`[Auth] Calendar connected status for ${email}:`, user.googleCalendarConnected);

        // Save changes to the user
        await user.save();

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
        const resolvedVoiceConfig = resolveVoiceConfig(prefs, platform);

        res.json({
            success: true,
            data: {
                _id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                profilePicture: user.profilePicture,
                voicePreferences: user.voicePreferences,
                resolvedVoiceConfig,
                permissions: role ? role.permissions : [],
                allowedPages: role ? role.allowedPages : [],
                webAccess: role ? role.webAccess : true,
                mobileAccess: role ? role.mobileAccess : true,
                dateFormat: user.dateFormat || 'DD/MM/YYYY',
                timeFormat: user.timeFormat || '12',
                googleEmail: user.googleEmail || null,
                googleCalendarConnected: user.googleCalendarConnected || false,
                googleRefreshToken: user.googleRefreshToken ? 'connected' : null, // Don't expose real token
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
                resolvedVoiceConfig: resolveVoiceConfig({ gender: 'female', tone: 'soft' }, platform),
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
        const platform = req.headers['x-platform'] || 'web';
        userData.resolvedVoiceConfig = resolveVoiceConfig(prefs, platform);

        // Sanitize: expose only presence of refresh token, not its value
        userData.googleRefreshToken = userData.googleRefreshToken ? 'connected' : null;
        // Ensure calendar fields are always present
        userData.googleEmail = userData.googleEmail || null;
        userData.googleCalendarConnected = userData.googleCalendarConnected || false;

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

        // SECURITY: Generate a random one-time password instead of using a hardcoded default.
        // The generated password is returned ONCE in the response and never stored in plaintext.
        const tempPassword = crypto.randomBytes(12).toString('base64url');

        if (!admin) {
            admin = await User.create({
                name: 'Administrator',
                email: adminEmail,
                password: tempPassword,
                role: 'admin'
            });
        } else {
            admin.role = 'admin';
            admin.password = tempPassword;
            await admin.save();
        }

        res.json({
            success: true,
            message: 'VPS Database Initialized Successfully! Change this password immediately after first login.',
            credentials: {
                email: adminEmail,
                password: tempPassword
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const user = await User.findOne({ email });
        if (!user) return res.json({ success: true, message: 'If the email exists, an OTP will be sent.' });

        // SECURITY: Use cryptographically secure random OTP instead of Math.random().
        // Math.random() is not suitable for security-sensitive values.
        const otp = crypto.randomInt(100000, 1000000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await User.updateOne(
            { _id: user._id },
            { $set: { resetPasswordOtp: hashOtp(user.email, otp), resetPasswordExpires: expires, resetPasswordAttempts: 0 } }
        );

        const { sendEmail } = require('../services/emailService');
        await sendEmail(
            user.email,
            'Password Reset OTP',
            `Your OTP to reset your password is: ${otp}\nIt is valid for 10 minutes.`,
            `<h3>Password Reset</h3><p>Your OTP to reset your password is: <b>${otp}</b></p><p>It is valid for 10 minutes.</p>`
        );

        res.json({ success: true, message: 'If the email exists, an OTP will be sent.' });
    } catch (error) {
        console.error('[Forgot Password Error]:', error);

        let errorMessage = 'Internal Server Error';
        if (error.message && error.message.includes('SMTP')) {
            errorMessage = 'Email system not configured. Please contact support or check admin settings.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        res.status(500).json({ success: false, message: errorMessage });
    }
};

const verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

        if (!(await validateResetOtp(user, email, otp))) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        if (!email || !otp || !newPassword) return res.status(400).json({ success: false, message: 'Missing fields' });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

        if (!(await validateResetOtp(user, email, otp))) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await User.updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword }, $unset: { resetPasswordOtp: "", resetPasswordExpires: "", resetPasswordAttempts: "" } }
        );

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        const user = await User.findById(req.user._id).select('+password');
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Incorrect current password' });
        }

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: 'Password updated successfully' });
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
    setupVPS,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    changePassword
};
