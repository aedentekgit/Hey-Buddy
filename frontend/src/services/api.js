import axios from 'axios';
import { config as envConfig } from '../config/env';

const api = axios.create({
    baseURL: envConfig.API_URL,
});

// Add request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Identify as Web platform
        config.headers['x-platform'] = 'web';
        return config;
    },
    (error) => Promise.reject(error)
);

// Add response interceptor to handle token expiry or platform restriction
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 403) {
            // Platform restricted or forbidden - Force Logout
            localStorage.clear();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
