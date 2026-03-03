const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    console.log(`[AUTH] Checking token for ${req.method} ${req.url}`);

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];

        // Handle "null" or "undefined" strings from mobile storage
        if (!token || token === 'null' || token === 'undefined') {
            token = null;
        }

        if (token) {
            try {
                if (!process.env.JWT_SECRET) {
                    console.error('[AUTH] JWT_SECRET is not defined');
                    return res.status(500).json({ success: false, message: 'Server configuration error' });
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                req.user = await User.findById(decoded.id).select('-password');
                if (!req.user) {
                    console.warn(`[AUTH] User not found in database for ID: ${decoded.id}`);
                    return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
                }

                // Platform Access Enforcement
                const Role = require('../models/Role');
                const role = await Role.findOne({ name: req.user.role });
                const platform = req.headers['x-platform'] || 'web'; // Default to web for security

                if (role) {
                    if (platform === 'web' && !role.webAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Web platform restricted for this role.'
                        });
                    }
                    if (platform === 'mobile' && !role.mobileAccess) {
                        return res.status(403).json({
                            success: false,
                            message: 'Access denied: Mobile platform restricted for this role.'
                        });
                    }
                }

                next();
            } catch (error) {
                console.warn('[AUTH] Token verification failed:', error.message);
                res.status(401).json({ success: false, message: 'Not authorized, token failed' });
            }
        }
    }

    if (!token) {
        console.warn('[AUTH] No token found in headers');
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user ? req.user.role : 'guest'} is not authorized to access this route`
            });
        }
        next();
    };
};

const protectOptional = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];

        // Handle "null" or "undefined" strings from mobile storage
        if (token && token !== 'null' && token !== 'undefined') {
            try {
                if (process.env.JWT_SECRET) {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    req.user = await User.findById(decoded.id).select('-password');
                }
            } catch (error) {
                console.warn('[AUTH] Optional token verification failed:', error.message);
            }
        }
    }
    next();
};

module.exports = { protect, authorize, protectOptional };
