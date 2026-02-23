const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    // Port
    PORT: process.env.PORT || 5001,

    // Core URLs
    BACKEND_URL: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5001}`,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    FRONTEND_URL_ALT: process.env.FRONTEND_URL_ALT || 'http://localhost:5173',

    // Services
    API_URL: process.env.API_URL || `http://localhost:${process.env.PORT || 5001}/api`,

    // Third Party
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `http://localhost:${process.env.PORT || 5001}/api/voice/google/callback`
};

module.exports = config;
