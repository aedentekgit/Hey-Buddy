const hostname = window.location.hostname;
const protocol = window.location.protocol;

// If we're on localhost but want to allow external mobile access,
// we default to the discovered local IP if we're on a development machine.
// Otherwise, we use the current hostname.
const isLocalhost = hostname === 'localhost';
const apiPort = isLocalhost ? ':5001' : '';
const frontendPort = isLocalhost ? ':3000' : '';

export const config = {
    // API and Backend URLs
    API_URL: import.meta.env.VITE_API_URL || `${protocol}//${hostname}${apiPort}/api`,
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || `${protocol}//${hostname}${apiPort}`,
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || `${protocol}//${hostname}${frontendPort}`
};

export default config;
