import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const visionService = {
    analyzeImage: async (imageFile) => {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await axios.post(`${API_URL}/vision/analyze`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    saveReminders: async (items) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/vision/save`, { items }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};

export default visionService;
