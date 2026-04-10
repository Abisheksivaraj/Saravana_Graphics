import { create } from 'zustand';

export const useUIStore = create((set) => ({
    isSidebarCollapsed: false,
    selectedTool: 'pick',
    activeFlyout: null,
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
    setSelectedTool: (tool) => set({ selectedTool: tool }),
    setActiveFlyout: (type) => set({ activeFlyout: type }),
}));
