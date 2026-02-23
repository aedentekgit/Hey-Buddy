export const config = {
    // API and Backend URLs
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api',
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001',
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000'
};

export default config;
