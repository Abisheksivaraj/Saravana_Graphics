import axios from 'axios';

// export const BASE_URL = 'http://localhost:5000';

export const BASE_URL = 'https://saravana-graphics.onrender.com';


const api = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle auth errors
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

// Auth
export const authAPI = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
};

// Designs
export const designsAPI = {
    getAll: (params) => api.get('/designs', { params }),
    getById: (id) => api.get(`/designs/${id}`),
    create: (data) => api.post('/designs', data),
    update: (id, data) => api.put(`/designs/${id}`, data),
    duplicate: (id) => api.post(`/designs/${id}/duplicate`),
    delete: (id) => api.delete(`/designs/${id}`),
    getNextTitle: (company) => api.get(`/designs/next-title/${company}`),
};

// Templates  
export const templatesAPI = {
    getAll: (params) => api.get('/templates', { params }),
    getById: (id) => api.get(`/templates/${id}`),
    create: (data) => api.post('/templates', data),
    seed: () => api.post('/templates/seed'),
};

// Companies / Folders
export const companiesAPI = {
    getAll: () => api.get('/companies'),
    create: (data) => api.post('/companies', data),
    delete: (id) => api.delete(`/companies/${id}`),
};

// Vendors
export const vendorAPI = {
    getStats: () => api.get('/vendors/stats'),
    getOrders: () => api.get('/vendors/orders'),
    upload: (formData) => api.post('/vendors/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadLayout: (id, formData) => api.post(`/vendors/layout/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateStatus: (id, data) => api.patch(`/vendors/status/${id}`, data),
    updateDates: (id, data) => api.patch(`/vendors/dates/${id}`, data),
    submitPayment: (id, formData) => api.post(`/vendors/payment/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    createAccount: (data) => api.post('/vendors/account', data),
    getAccounts: () => api.get('/vendors/accounts'),
};

export default api;
