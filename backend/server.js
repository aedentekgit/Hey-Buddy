const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const config = require('./config/env');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const xssLib = require('xss');
const morgan = require('morgan');
const logger = require('./utils/logger');

dotenv.config({ path: path.join(__dirname, '.env') });

if (process.env.NODE_ENV === 'development') {
    console.log('--- [Server Diagnostic] ---');
    console.log('PORT:', process.env.PORT);
    console.log('JWT_SECRET Status:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING');
    console.log('MONGODB_URI Status:', process.env.MONGODB_URI ? 'LOADED' : 'MISSING');
}

// Rate Limiters Configuration
// General API rate limit
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 2000 : 1000, // Increased from 100 to 1000 for production
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

// OTP limiter - very strict
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many OTP requests, please try again in an hour.' }
});

const app = express();
const http = require('http');
const { Server } = require('socket.io');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(o => o.trim());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});

// Initialize Socket.io Handlers
const voiceHandler = require('./sockets/voiceHandler');
const chatHandler = require('./sockets/chatHandler');
voiceHandler(io);
chatHandler(io);

// Expose io instance to controllers
app.set('io', io);

// Security & Performance Middleware (FIRST)
app.use(helmet({
    crossOriginEmbedderPolicy: false, // needed for some media types
    crossOriginResourcePolicy: false, // allow images to be loaded by other origins
    contentSecurityPolicy: false      // configure separately if needed
}));
app.use(compression());

// HTTP request logging with Morgan
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
    skip: (req) => req.url === '/health' // skip health check spam
}));

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-platform']
}));
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.FORM_BODY_LIMIT || '5mb' }));
// Express 5-compatible XSS sanitization middleware
// xss-clean is broken on Express 5 because it tries to overwrite req.query which is now read-only.
// We use the 'xss' library and sanitize req.body + req.params only (query strings shouldn't contain HTML).
const xssSanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
            obj[key] = xssLib(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            xssSanitize(obj[key]);
        }
    }
    return obj;
};
app.use((req, _res, next) => {
    if (req.body) xssSanitize(req.body);
    if (req.params) xssSanitize(req.params);
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Fallback: if file doesn't exist locally, redirect to VPS Staging
if (process.env.NODE_ENV === 'development') {
    app.use('/uploads', (req, res) => {
        const subPath = req.url;
        const vpsUrl = `https://staging.ayuskart.com/uploads${subPath}`;
        console.log(`[Upload-Fallback] File not found locally: /uploads${subPath} -> Redirecting to staging VPS`);
        res.redirect(vpsUrl);
    });
}

// Routes
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const statsRoutes = require('./routes/statsRoutes');
const reminderRoutes = require('./routes/reminderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const visionRoutes = require('./routes/visionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const ragRoutes = require('./routes/ragRoutes');
const aiRoutes = require('./routes/ai/aiRoutes');
const locationReminderRoutes = require('./routes/locationReminderRoutes');
const familyRoutes = require('./routes/familyRoutes');
const chatRoutes = require('./routes/chatRoutes');

// Apply Rate Limiting
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', otpLimiter);
app.use('/api/auth/verify-reset-otp', otpLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/automations', webhookRoutes);
app.use('/api/knowledge', ragRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/location-reminders', locationReminderRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/chat', chatRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'Buddy API'
    });
});

// Routes placeholders
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Admin API' });
});
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        if (req.url.startsWith('/api')) {
            console.log(`[API-DEBUG] Unmatched Route: ${req.method} ${req.url}`);
        }
        next();
    });
} else {
    app.use((req, res, next) => {
        next();
    });
}

// Global Error Handler (must be registered BEFORE startServer to catch async route errors)
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Database connection & Server Startup
const startServer = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.error('[FATAL] MONGODB_URI environment variable is not set. Refusing to start.');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        mongoose.set('bufferCommands', false);
        const mongoOptions = {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        };
        // Enable TLS for non-development environments
        if (process.env.MONGODB_TLS === 'true') {
            mongoOptions.tls = true;
            mongoOptions.tlsAllowInvalidCertificates = process.env.NODE_ENV === 'development';
            mongoOptions.tlsAllowInvalidHostnames = process.env.NODE_ENV === 'development';
        }
        await mongoose.connect(MONGODB_URI, mongoOptions);
        console.log('✅ Connected to MongoDB');

        // Start listening after successful DB connection
        const PORT = config.PORT;
        const { startReminderWorker } = require('./services/reminderWorker');
        const { startSmartReminderScheduler } = require('./schedulers/smartReminderScheduler');

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`Backend fully initialized at ${new Date().toISOString()}`);

            // Initialize workers & schedulers
            startReminderWorker(io);
            startSmartReminderScheduler(io);
        });

    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
        if (err.message.includes('ETIMEDOUT') || err.message.includes('connectTimeoutMS')) {
            console.error('TIP: Port 27017 might be blocked or the remote server is down.');
            console.error('If developing locally, try starting your local MongoDB:');
            console.error('  brew services start mongodb-community');
            console.error('And update your MONGODB_URI in .env to: mongodb://localhost:27017/staging_Heybuddy');
        }
        process.exit(1);
    }
};

startServer();

// Uncaught exception handler
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

// Graceful shutdown on SIGINT
process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});
