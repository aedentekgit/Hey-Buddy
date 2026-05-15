import api from './api';

const locationReminderService = {
    getAll: async (page = 1, limit = 10, search = '') => {
        const response = await api.get(`/location-reminders?page=${page}&limit=${limit}&search=${search}`);
        return response.data;
    },

    getOne: async (id) => {
        const response = await api.get(`/location-reminders/${id}`);
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/location-reminders', data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await api.put(`/location-reminders/${id}`, data);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/location-reminders/${id}`);
        return response.data;
    },

    setEarlyWarning: async (id, data) => {
        const response = await api.post(`/location-reminders/${id}/early-warning`, data);
        return response.data;
    },

    setFamilyBackup: async (id) => {
        const response = await api.post(`/location-reminders/${id}/family-backup`);
        return response.data;
    }
};

export default locationReminderService;
