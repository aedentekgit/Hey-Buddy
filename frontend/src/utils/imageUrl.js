export const getImageUrl = (path) => {
    if (!path) return null;

    // If it's already a full URL (http/https), a data URL, or a blob URL, return it as is
    if (path.startsWith('http') || path.startsWith('blob') || path.startsWith('data:')) {
        return path;
    }

    // Standardize base URL from environment variables
    // Preference: VITE_BACKEND_URL, then derived from VITE_API_URL, then fallback to localhost:5001
    const backendUrl = import.meta.env.VITE_BACKEND_URL ||
        (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5001');

    // Ensure no trailing slash on base URL
    const cleanRoot = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    // Ensure leading slash on path
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanRoot}${cleanPath}`;
};
