import { create } from 'zustand';
import { companiesAPI } from '../api';
import toast from 'react-hot-toast';

export const useCompanyStore = create((set, get) => ({
    companies: [],
    loading: false,
    currentFolder: null, // The folder/company we are currently "inside"

    fetchCompanies: async () => {
        set({ loading: true });
        try {
            const res = await companiesAPI.getAll();
            set({ companies: res.data.companies });
        } catch (err) {
            toast.error('Failed to fetch folders');
        } finally {
            set({ loading: false });
        }
    },

    createCompany: async (name) => {
        try {
            const res = await companiesAPI.create({ name });
            set((state) => ({ companies: [...state.companies, res.data.company] }));
            toast.success('Folder created successfully');
            return res.data.company;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create folder');
            return null;
        }
    },

    deleteCompany: async (id) => {
        try {
            await companiesAPI.delete(id);
            set((state) => ({ companies: state.companies.filter(c => c._id !== id) }));
            toast.success('Folder deleted');
            if (get().currentFolder?._id === id) {
                set({ currentFolder: null });
            }
        } catch (err) {
            toast.error('Failed to delete folder');
        }
    },

    setCurrentFolder: (folder) => set({ currentFolder: folder }),
}));
