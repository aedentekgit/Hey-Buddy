const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/staging_Heybuddy';

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

const PORT = process.env.PORT || 5000;
const { startReminderWorker } = require('./services/reminderWorker');
const { startSmartReminderScheduler } = require('./schedulers/smartReminderScheduler');

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Backend fully initialized at ${new Date().toISOString()}`);
    startReminderWorker();
    startSmartReminderScheduler(); // Start AI-powered reminder features
});
