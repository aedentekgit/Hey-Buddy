import axios from 'axios';
import { config } from '../config/env';

const API_URL = config.API_URL;

const knowledgeService = {
    uploadDocument: async (file) => {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('document', file);

        const response = await axios.post(`${API_URL}/knowledge/upload`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    getDocuments: async () => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/knowledge/documents`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    queryKnowledge: async (question) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/knowledge/query`, { question }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};

export default knowledgeService;
