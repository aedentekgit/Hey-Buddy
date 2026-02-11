import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
