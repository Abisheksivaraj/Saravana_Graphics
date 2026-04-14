import { create } from 'zustand';

export const useUIStore = create((set) => ({
    isSidebarCollapsed: false,
    selectedTool: 'pick',
    activeFlyout: null,
    measurementUnit: 'mm', // 'mm', 'cm', 'pt', 'px'
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
    setSelectedTool: (tool) => set({ selectedTool: tool }),
    setActiveFlyout: (type) => set({ activeFlyout: type }),
    setMeasurementUnit: (unit) => set({ measurementUnit: unit }),
}));

export const pxToUnit = (px, unit) => {
    if (px === undefined || px === null) return 0;
    switch(unit) {
        case 'pt': return px * 0.75;
        case 'mm': return px * (25.4 / 96);
        case 'cm': return px * (2.54 / 96);
        default: return px;
    }
};

export const unitToPx = (val, unit) => {
    if (val === undefined || val === null) return 0;
    switch(unit) {
        case 'pt': return val / 0.75;
        case 'mm': return val / (25.4 / 96);
        case 'cm': return val / (2.54 / 96);
        default: return val;
    }
};
