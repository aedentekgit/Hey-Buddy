import { config } from '../config/env';

export const getImageUrl = (path) => {
    if (!path) return null;

    // If it's already a full URL (http/https), a data URL, or a blob URL, return it as is
    if (path.startsWith('http') || path.startsWith('blob') || path.startsWith('data:')) {
        return path;
    }

    // Standardize base URL from environment variables
    const backendUrl = config.BACKEND_URL || config.API_URL.replace('/api', '');

    // Ensure no trailing slash on base URL
    const cleanRoot = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

    // Ensure leading slash on path
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanRoot}${cleanPath}`;
};
