const jwt = require('jsonwebtoken');
const User = require('../models/User');

// SECURITY: Validate required secrets at module load time.
// The server refuses to start if JWT_SECRET is missing rather than failing per-request.
if (!process.env.JWT_SECRET) {
    console.error('[FATAL] JWT_SECRET is not set. Set it in your .env before starting the server.');
    process.exit(1);
}

// SECURITY: Load INTERNAL_SECRET from env only — no hardcoded fallback.
// If not set, service-to-service calls are simply rejected (safe default).
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || null;
if (!INTERNAL_SECRET) {
    console.warn('[SECURITY] INTERNAL_SECRET is not set — service-to-service auth from Python AI is disabled. ' +
        'Set INTERNAL_SECRET in .env to enable it.');
}

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];

        // Handle service-to-service authentication (Python AI service → Node.js)
        // Only bypasses JWT check when INTERNAL_SECRET is explicitly configured.
        if (INTERNAL_SECRET && token === INTERNAL_SECRET) {
            return next();
        }

        // Handle "null" or "undefined" strings from mobile storage
        if (!token || token === 'null' || token === 'undefined') {
            token = null;
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                req.user = await User.findById(decoded.id).select('-password');
                if (!req.user) {
                    // User not in this DB (e.g. account is on prod, APK points to staging)
                    req.decodedUserId = decoded.id;
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
                // Log internally but return a generic message to avoid leaking info
                console.warn('[AUTH] Token verification failed:', error.message);
                res.status(401).json({ success: false, message: 'Not authorized, token failed' });
            }
        }
    }

    if (!token) {
        res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: insufficient permissions.'
            });
        }
        next();
    };
};

// Middleware that extracts user identity when present but doesn't block unauthenticated requests.
const protectOptional = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];

        // Handle "null" or "undefined" strings from mobile storage
        if (token && token !== 'null' && token !== 'undefined') {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                // Always store the decoded userId — even if user doesn't exist in this DB
                req.decodedUserId = decoded.id;
                req.user = await User.findById(decoded.id).select('-password');
            } catch (error) {
                console.warn('[AUTH] Optional token verification failed:', error.message);
            }
        }
    }
    next();
};

// Middleware that checks only the INTERNAL_SECRET — for routes exclusively
// used by the Python AI service. Returns 401 if not configured or wrong.
const protectInternal = (req, res, next) => {
    if (!INTERNAL_SECRET) {
        return res.status(503).json({ success: false, message: 'Internal service auth is not configured.' });
    }
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.split(' ')[1] : '';
    if (token !== INTERNAL_SECRET) {
        return res.status(401).json({ success: false, message: 'Unauthorized internal request.' });
    }
    next();
};

module.exports = { protect, authorize, protectOptional, protectInternal };
