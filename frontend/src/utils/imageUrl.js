import { config } from '../config/env';

export const getImageUrl = (path) => {
    if (!path) return null;

    // If it's already a full URL (http/https), a data URL, or a blob URL, return it as is
    if (path.startsWith('http') || path.startsWith('blob') || path.startsWith('data:')) {
        return path;
    }

    // Standardize base URL from environment variables
    const rawRoot = config.BACKEND_URL || config.API_URL?.replace('/api', '') || '';

    // Ensure no trailing slash on root
    const root = rawRoot.replace(/\/$/, '');

    // Ensure leading slash on path
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    // Join them ensuring no double slashes at the join point
    return `${root}${cleanPath}`;
};
