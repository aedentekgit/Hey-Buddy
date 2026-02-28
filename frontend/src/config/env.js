const hostname = window.location.hostname;
const protocol = window.location.protocol;

// If we're on localhost but want to allow external mobile access,
// we default to the discovered local IP if we're on a development machine.
// Otherwise, we use the current hostname.
const apiHost = hostname === 'localhost' ? 'localhost' : hostname;

export const config = {
    // API and Backend URLs
    API_URL: import.meta.env.VITE_API_URL || `${protocol}//${apiHost}:5001/api`,
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || `${protocol}//${apiHost}:5001`,
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || `${protocol}//${hostname}:3000`
};

export default config;
