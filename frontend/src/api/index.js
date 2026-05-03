import axios from 'axios';

export const BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://saravana-graphics.onrender.com';

const api = axios.create({
    // Use full URL in production because frontend and   backend are on different domains
    baseURL: window.location.hostname === 'localhost' ? '/api' : `${BASE_URL}/api`,
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
    uploadRevisedArtwork: (id, formData) => api.post(`/vendors/revised-artwork/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadPerformaInvoice: (id, formData) => api.post(`/vendors/performa-invoice/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    updateStatus: (id, data) => api.patch(`/vendors/status/${id}`, data),
    updateDates: (id, data) => api.patch(`/vendors/dates/${id}`, data),
    submitPayment: (id, formData) => api.post(`/vendors/payment/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    createAccount: (data) => api.post('/vendors/account', data),
    getAccounts: () => api.get('/vendors/accounts'),
    getMessages: (orderId) => api.get(`/vendors/chat/${orderId}`),
    sendMessage: (orderId, text) => api.post(`/vendors/chat/${orderId}`, { text }),
    getActiveChats: () => api.get('/vendors/active-chats'),
    markAsRead: (orderId) => api.patch(`/vendors/chat/${orderId}/read`),
    approvePerforma: (id) => api.patch(`/vendors/approve-performa/${id}`),
    uploadDeliveryProof: (id, formData) => api.post(`/vendors/delivery-proof/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    deleteOrder: (id) => api.delete(`/vendors/order/${id}`),
    uploadRevisedArtwork: (id, formData) => api.post(`/vendors/revised-artwork/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

// Strip Colors
export const stripColorsAPI = {
    getAll: () => api.get('/strip-colors'),
    create: (data) => api.post('/strip-colors', data),
    update: (id, data) => api.put(`/strip-colors/${id}`, data),
    delete: (id) => api.delete(`/strip-colors/${id}`),
};



// Buyers
export const buyerAPI = {
    createAccount: (data) => api.post('/buyers/account', data),
    getAccounts: () => api.get('/buyers/accounts'),
    getVendors: () => api.get('/buyers/vendors'),
    getVendorHistory: (vendorId) => api.get(`/buyers/vendor-history/${vendorId}`),
};

// Files
export const filesAPI = {
    upload: (formData) => api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getAll: () => api.get('/files'),
    delete: (id) => api.delete(`/files/${id}`),
};

export default api;
