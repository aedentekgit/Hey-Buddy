import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const voiceService = {
    parseVoice: async (text, language = 'en-US', history = [], conversationId = null) => {
        const token = localStorage.getItem('token');

        // Get user's local timezone
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const clientTimestamp = Date.now();

        const response = await axios.post(`${API_URL}/voice/parse`, {
            text,
            language,
            history,
            conversationId,
            timeZone,
            clientTimestamp
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    saveReminder: async (reminderData, saveTo) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/voice/save`, { reminderData, saveTo }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getReminders: async (page = 1, limit = 10, search = '') => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice?page=${page}&limit=${limit}&search=${search}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response;
    },

    deleteReminder: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/voice/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    batchDeleteReminders: async (ids) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/reminders/batch-delete`, { ids }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    updateReminder: async (id, data) => {
        const token = localStorage.getItem('token');
        const response = await axios.put(`${API_URL}/voice/${id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getGoogleAuthUrl: async () => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice/google/auth`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getAllMemoriesAndRecords: async (page = 1, limit = 10, search = '') => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice/memories/mix?page=${page}&limit=${limit}&search=${search}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response;
    },

    getMemories: async (page = 1, limit = 10, search = '') => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice/memories?page=${page}&limit=${limit}&search=${search}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response;
    },

    createMemory: async (content, category = 'general') => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/voice/memories`, { content, category }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    deleteMemory: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/voice/memories/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    updateMemory: async (id, data) => {
        const token = localStorage.getItem('token');
        const response = await axios.put(`${API_URL}/voice/memories/${id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    uploadPrescription: async (file, language) => {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('document', file);
        formData.append('language', language);

        const response = await axios.post(`${API_URL}/voice/upload-prescription`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },

    confirmMedicalReminders: async (prescriptionId, confirmationData) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/voice/confirm-medical-reminders`, {
            prescriptionId,
            confirmationData
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    getPrescriptions: async (page = 1, limit = 10, search = '') => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice/prescriptions?page=${page}&limit=${limit}&search=${search}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response;
    },

    getPrescriptionById: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/voice/prescriptions/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    updatePrescription: async (id, data) => {
        const token = localStorage.getItem('token');
        const response = await axios.put(`${API_URL}/voice/prescriptions/${id}`, data, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    deletePrescription: async (id) => {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/voice/prescriptions/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    },

    shareReminder: async (id, email, permissions) => {
        const token = localStorage.getItem('token');
        const response = await axios.post(`${API_URL}/reminders/${id}/share`, { email, permissions }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    }
};

export default voiceService;
