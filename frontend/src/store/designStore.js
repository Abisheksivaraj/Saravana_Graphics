import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

// Size presets in pixels (at 96 DPI)
export const SIZE_PRESETS = {
    'price-tag': { label: 'Price Tag', width: 200, height: 300, unit: 'mm', desc: '5cm × 7.5cm' },
    'clothing-tag': { label: 'Clothing Tag', width: 180, height: 350, unit: 'mm', desc: '4.5cm × 9cm' },
    'business-card': { label: 'Business Card', width: 350, height: 200, unit: 'mm', desc: '8.9cm × 5.1cm' },
    'label-small': { label: 'Small Label', width: 250, height: 150, unit: 'mm', desc: '6.4cm × 3.8cm' },
    'label-large': { label: 'Large Label', width: 400, height: 250, unit: 'mm', desc: '10cm × 6.4cm' },
    'shipping-label': { label: 'Shipping Label', width: 400, height: 300, unit: 'mm', desc: '10cm × 7.5cm' },
    'barcode-label': { label: 'Barcode Label', width: 300, height: 150, unit: 'mm', desc: '7.5cm × 3.8cm' },
    'id-card': { label: 'ID Card', width: 340, height: 216, unit: 'mm', desc: '8.56cm × 5.4cm' },
    'a4': { label: 'A4 Page', width: 794, height: 1123, unit: 'mm', desc: '21cm × 29.7cm' },
    'custom': { label: 'Custom Size', width: 400, height: 400, unit: 'px', desc: 'Any size' },
};

export const useDesignStore = create((set, get) => ({
    // Current design state
    designId: null,
    title: 'Untitled Design',
    canvasWidth: 200,
    canvasHeight: 300,
    backgroundColor: '#ffffff',
    sizePreset: 'price-tag',
    elements: [],
    company: '',
    selectedId: null,
    isSaving: false,
    isDirty: false,

    // Canvas view
    zoom: 1,
    pan: { x: 0, y: 0 },

    // History (undo/redo)
    history: [],
    historyIndex: -1,

    // Actions
    setTitle: (title) => set({ title, isDirty: true }),
    setCompany: (company) => set({ company, isDirty: true }),
    setCanvasSize: (width, height, preset = 'custom') => {
        set({ canvasWidth: width, canvasHeight: height, sizePreset: preset, isDirty: true });
        get().saveHistory();
    },
    setBackgroundColor: (color) => set({ backgroundColor: color, isDirty: true }),
    setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(8, zoom)) }),
    setPan: (pan) => set({ pan }),
    setDesignId: (id) => set({ designId: id }),
    setIsSaving: (saving) => set({ isSaving: saving }),
    setDirty: (dirty) => set({ isDirty: dirty }),

    // Load design from server
    loadDesign: (design) => {
        set({
            designId: design._id,
            title: design.title,
            canvasWidth: design.canvasWidth,
            canvasHeight: design.canvasHeight,
            backgroundColor: design.backgroundColor || '#ffffff',
            sizePreset: design.sizePreset || 'custom',
            elements: design.elements || [],
            company: design.company || '',
            isDirty: false,
            history: [],
            historyIndex: -1,
        });
    },

    // Element operations
    addElement: (type, extraProps = {}) => {
        const id = uuid();
        const newElement = {
            id,
            type,
            x: 50, y: 50,
            rotation: 0, scaleX: 1, scaleY: 1,
            opacity: 1, zIndex: get().elements.length,
            locked: false, visible: true,
            name: `${type}_${id.slice(0, 4)}`,
            ...getDefaultProps(type),
            ...extraProps,
        };
        set((s) => ({ elements: [...s.elements, newElement], selectedId: id, isDirty: true }));
        get().saveHistory();
        return newElement;
    },

    updateElement: (id, updates) => {
        set((s) => ({
            elements: s.elements.map((el) => el.id === id ? { ...el, ...updates } : el),
            isDirty: true,
        }));
    },

    updateElementAndSave: (id, updates) => {
        get().updateElement(id, updates);
        get().saveHistory();
    },

    deleteElement: (id) => {
        set((s) => ({ elements: s.elements.filter((el) => el.id !== id), selectedId: null, isDirty: true }));
        get().saveHistory();
    },

    selectElement: (id) => set({ selectedId: id }),
    deselectAll: () => set({ selectedId: null }),

    bringForward: (id) => {
        const els = [...get().elements];
        const idx = els.findIndex(e => e.id === id);
        if (idx < els.length - 1) {
            [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]];
            set({ elements: els.map((e, i) => ({ ...e, zIndex: i })), isDirty: true });
        }
    },

    sendBackward: (id) => {
        const els = [...get().elements];
        const idx = els.findIndex(e => e.id === id);
        if (idx > 0) {
            [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]];
            set({ elements: els.map((e, i) => ({ ...e, zIndex: i })), isDirty: true });
        }
    },

    bringToFront: (id) => {
        const els = get().elements.filter(e => e.id !== id);
        const el = get().elements.find(e => e.id === id);
        if (el) set({ elements: [...els, { ...el, zIndex: els.length }], isDirty: true });
    },

    sendToBack: (id) => {
        const els = get().elements.filter(e => e.id !== id);
        const el = get().elements.find(e => e.id === id);
        if (el) set({ elements: [{ ...el, zIndex: 0 }, ...els.map((e, i) => ({ ...e, zIndex: i + 1 }))], isDirty: true });
    },

    duplicateElement: (id) => {
        const el = get().elements.find(e => e.id === id);
        if (!el) return;
        const newEl = { ...el, id: uuid(), x: el.x + 20, y: el.y + 20, zIndex: get().elements.length };
        set((s) => ({ elements: [...s.elements, newEl], selectedId: newEl.id, isDirty: true }));
        get().saveHistory();
    },

    duplicateAllElements: () => {
        const { elements, canvasWidth } = get();
        if (elements.length === 0) return;

        // Find current bounds
        const minX = Math.min(...elements.map(e => e.x));
        const maxX = Math.max(...elements.map(e => {
            const w = e.type === 'circle' ? (e.radius || 50) * 2 : (e.width || 100);
            return e.x + (w * (e.scaleX || 1));
        }));

        const designWidth = maxX - minX;

        // Find the leftmost rect to determine the actual border start
        const rects = elements.filter(e => e.type === 'rect');
        const borderX = rects.length > 0 ? Math.min(...rects.map(r => r.x)) : 0;

        // Subtract borderX from offset to make borders touch perfectly
        const offset = Math.max(0, designWidth - borderX);

        // Find current max z-index
        const maxZ = Math.max(...elements.map(e => e.zIndex || 0), 0);

        const newElements = elements.map((el, i) => ({
            ...el,
            id: uuid(),
            x: el.x + offset,
            zIndex: maxZ + 1 + i,
            name: `${el.name}_copy`
        }));

        set((s) => ({
            elements: [...s.elements, ...newElements],
            canvasWidth: Math.max(canvasWidth, maxX + offset + 5),
            selectedId: null, // Deselect individual to avoid confusion
            isDirty: true,
        }));
        get().saveHistory();
    },

    toggleLock: (id) => {
        set((s) => ({ elements: s.elements.map(el => el.id === id ? { ...el, locked: !el.locked } : el) }));
    },

    toggleVisibility: (id) => {
        set((s) => ({ elements: s.elements.map(el => el.id === id ? { ...el, visible: !el.visible } : el) }));
    },

    // History
    saveHistory: () => {
        const { elements, historyIndex, history } = get();
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(elements)));
        set({ history: newHistory.slice(-50), historyIndex: newHistory.length - 1 > 49 ? 49 : newHistory.length - 1 });
    },

    undo: () => {
        const { historyIndex, history } = get();
        if (historyIndex > 0) {
            set({ elements: JSON.parse(JSON.stringify(history[historyIndex - 1])), historyIndex: historyIndex - 1, isDirty: true });
        }
    },

    redo: () => {
        const { historyIndex, history } = get();
        if (historyIndex < history.length - 1) {
            set({ elements: JSON.parse(JSON.stringify(history[historyIndex + 1])), historyIndex: historyIndex + 1, isDirty: true });
        }
    },

    // Initialize fresh design
    newDesign: (preset = 'price-tag', customWidth = null, customHeight = null) => {
        const size = SIZE_PRESETS[preset] || SIZE_PRESETS['custom'];
        const currentCompany = get().company; // Preserve the company chosen in Dashboard
        
        const width = customWidth || size.width;
        const height = customHeight || size.height;

        set({
            designId: null, title: 'Untitled Design',
            canvasWidth: width, canvasHeight: height,
            backgroundColor: '#ffffff', sizePreset: preset,
            elements: [], company: currentCompany, selectedId: null, isDirty: false,
            history: [], historyIndex: -1, zoom: 1, pan: { x: 0, y: 0 },
        });
    },
}));

function getDefaultProps(type) {
    switch (type) {
        case 'text': return { text: 'Double click to edit', fontSize: 18, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000000', stroke: 'transparent', strokeWidth: 0, width: 200, textAlign: 'left', underline: false, fontStyle: 'normal' };
        case 'rect': return { width: 120, height: 80, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 4 };
        case 'circle': return { radius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'ellipse': return { width: 120, height: 80, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'line': return { points: [0, 0, 150, 0], stroke: '#000000', strokeWidth: 2 };
        case 'triangle': return { width: 100, height: 100, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'star': return { numPoints: 5, innerRadius: 20, outerRadius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'polygon': return { sides: 6, radius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'path': return { data: 'M 0 0 L 100 0 L 50 100 Z', fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'barcode': return { barcodeValue: '8905263411803', barcodeFormat: 'CODE128', width: 200, height: 80, fill: '#000000' };
        case 'qrcode': return { qrValue: 'https://saravanagraphics.com', width: 100, height: 100 };
        case 'image': return { width: 150, height: 150, src: '' };
        default: return {};
    }
}
