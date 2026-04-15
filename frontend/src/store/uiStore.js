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

export const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const rgbToCmyk = (r, g, b) => {
    let r1 = r / 255;
    let g1 = g / 255;
    let b1 = b / 255;
    let k = 1 - Math.max(r1, g1, b1);
    let c = k === 1 ? 0 : (1 - r1 - k) / (1 - k);
    let m = k === 1 ? 0 : (1 - g1 - k) / (1 - k);
    let y = k === 1 ? 0 : (1 - b1 - k) / (1 - k);
    return {
        c: Math.round(c * 100),
        m: Math.round(m * 100),
        y: Math.round(y * 100),
        k: Math.round(k * 100)
    };
};

export const cmykToHex = (c, m, y, k) => {
    c /= 100; m /= 100; y /= 100; k /= 100;
    let r = Math.round(255 * (1 - c) * (1 - k));
    let g = Math.round(255 * (1 - m) * (1 - k));
    let b = Math.round(255 * (1 - y) * (1 - k));
    return rgbToHex(r, g, b);
};

export const hexToCmyk = (hex) => {
    const rgb = hexToRgb(hex);
    return rgbToCmyk(rgb.r, rgb.g, rgb.b);
};
