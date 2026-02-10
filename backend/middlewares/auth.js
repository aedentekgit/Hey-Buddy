const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            if (!process.env.JWT_SECRET) {
                console.error('JWT_SECRET is not defined in environment variables');
                return res.status(500).json({ success: false, message: 'Server configuration error' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            console.error(`Auth Error: ${error.message}`);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Token expired, please login again' });
            }
            return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route`
            });
        }
        next();
    };
};

// Check specific permission in Role
const checkPermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, message: 'Not authorized' });
            }

            const Role = require('../models/Role');
            const role = await Role.findOne({ name: req.user.role });

            if (!role || !role.permissions.includes(permission)) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to perform this action"
                });
            }

            next();
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    };
};

module.exports = { protect, authorize, checkPermission };
