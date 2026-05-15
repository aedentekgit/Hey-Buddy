import axios from 'axios';
import { config } from '../config/env';

const API_URL = config.API_URL;

const automationService = {
    getWebhooks: async () => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/automations`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    createWebhook: async (name, targetAction) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/automations`, { name, targetAction }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    deleteWebhook: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/automations/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};

export default automationService;
