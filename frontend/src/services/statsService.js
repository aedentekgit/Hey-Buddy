import axios from 'axios';

const API_URL = '/api/stats';

const statsService = {
    getDashboardStats: async () => {
        const token = localStorage.getItem('token');
        const response = await axios.get(API_URL, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};

export default statsService;
