import { create } from 'zustand';
import { authAPI } from '../api';

export const useAuthStore = create((set) => ({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: true,

    init: async () => {
        const token = localStorage.getItem('token');
        if (!token) { set({ isLoading: false }); return; }
        try {
            const res = await authAPI.getMe();
            set({ user: res.data.user, isLoading: false });
        } catch {
            localStorage.removeItem('token');
            set({ token: null, user: null, isLoading: false });
        }
    },

    login: async (identifier, password) => {
        const res = await authAPI.login({ identifier, password });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        set({ token, user });
        return user;
    },

    register: async (name, email, password) => {
        const res = await authAPI.register({ name, email, password });
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        set({ token, user });
        return user;
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null });
    },
}));
