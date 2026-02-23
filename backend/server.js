const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const config = require('./config/env');

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('--- [Server Diagnostic] ---');
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET Status:', process.env.JWT_SECRET ? 'LOADED' : 'MISSING');
console.log('OPENAI_API_KEY Status:', process.env.OPENAI_API_KEY ? 'LOADED' : 'MISSING');
console.log('MONGODB_URI Status:', process.env.MONGODB_URI ? 'LOADED' : 'MISSING');

const app = express();

// Middleware
app.use(cors({
    origin: [config.FRONTEND_URL, config.FRONTEND_URL_ALT, 'http://localhost:3000', 'http://localhost:5173'].filter(Boolean),
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
}, express.static(path.join(__dirname, 'uploads')));

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

// Routes placeholders
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Admin API' });
});
app.get('/api', (req, res) => {
    res.json({ message: 'Welcome to the Admin API' });
});
app.get('/api/', (req, res) => {
    res.json({ message: 'Welcome to the Admin API' });
});

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://82.29.167.22:27017/staging_Heybuddy';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [config.FRONTEND_URL, config.FRONTEND_URL_ALT, 'http://localhost:3000', 'http://localhost:5173'].filter(Boolean),
        credentials: true
    }
});

// Initialize Socket.io Voice Handler
const voiceHandler = require('./sockets/voiceHandler');
voiceHandler(io);

const PORT = config.PORT;
const { startReminderWorker } = require('./services/reminderWorker');
const { startSmartReminderScheduler } = require('./schedulers/smartReminderScheduler');

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Backend fully initialized at ${new Date().toISOString()}`);
    startReminderWorker();
    startSmartReminderScheduler(); // Start AI-powered reminder features
});
