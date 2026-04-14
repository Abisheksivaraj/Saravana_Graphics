import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

// Size presets in pixels (at 96 DPI)
export const SIZE_PRESETS = {
    'custom': { label: 'Custom Size', width: 200, height: 300, unit: 'mm', desc: 'Any size' },
};

export const useDesignStore = create((set, get) => ({
    // Current design state
    designId: null,
    title: 'Untitled Design',
    canvasWidth: 200,
    canvasHeight: 300,
    backgroundColor: '#ffffff',
    sizePreset: 'custom',
    elements: [],
    company: '',
    selectedIds: [], // Array of IDs for multi-selection
    isSaving: false,
    isDirty: false,

    // Canvas view
    zoom: 1,
    pan: { x: 0, y: 0 },
    previewData: null, // First row of Excel data for live preview

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
    setPreviewData: (data) => set({ previewData: data }),

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
        set((s) => ({ elements: [...s.elements, newElement], selectedIds: [id], isDirty: true }));
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
        const idsToDelete = Array.isArray(id) ? id : [id];
        set((s) => ({
            elements: s.elements.filter((el) => !idsToDelete.includes(el.id)),
            selectedIds: s.selectedIds.filter(sid => !idsToDelete.includes(sid)),
            isDirty: true
        }));
        get().saveHistory();
    },

    selectElement: (id, multiSelect = false) => {
        if (!id) {
            set({ selectedIds: [] });
            return;
        }
        set((s) => {
            if (multiSelect) {
                const alreadySelected = s.selectedIds.includes(id);
                const newSelection = alreadySelected 
                    ? s.selectedIds.filter(sid => sid !== id)
                    : [...s.selectedIds, id];
                return { selectedIds: newSelection };
            }
            return { selectedIds: [id] };
        });
    },

    deselectAll: () => set({ selectedIds: [] }),

    // Multi-selection operations
    matchSize: (property) => {
        const { selectedIds, elements } = get();
        if (selectedIds.length < 2) return;
        const referenceId = selectedIds[0];
        const ref = elements.find(e => e.id === referenceId);
        if (!ref) return;

        let value = ref[property];
        // Special case for radius
        if (property === 'height' && ref.type === 'circle') value = ref.radius * 2;
        if (property === 'width' && ref.type === 'circle') value = ref.radius * 2;

        set(s => ({
            elements: s.elements.map(el => {
                if (!selectedIds.slice(1).includes(el.id)) return el;
                // Handle circles differently (they use radius)
                if (el.type === 'circle') {
                    if (property === 'width' || property === 'height') {
                        return { ...el, radius: value / 2 };
                    }
                }
                return { ...el, [property]: value };
            }),
            isDirty: true
        }));
        get().saveHistory();
    },

    alignElements: (type) => {
        const { selectedIds, elements } = get();
        if (selectedIds.length < 2) return;
        const referenceId = selectedIds[0];
        const ref = elements.find(e => e.id === referenceId);
        if (!ref) return;

        const getDim = (el, dim) => {
            if (el.type === 'circle') return el.radius * 2;
            return el[dim] || 0;
        };

        set(s => ({
            elements: s.elements.map(el => {
                if (!selectedIds.slice(1).includes(el.id)) return el;
                const eW = getDim(el, 'width');
                const eH = getDim(el, 'height');
                const rW = getDim(ref, 'width');
                const rH = getDim(ref, 'height');

                switch(type) {
                    case 'top': return { ...el, y: ref.y };
                    case 'bottom': return { ...el, y: ref.y + rH - eH };
                    case 'left': return { ...el, x: ref.x };
                    case 'right': return { ...el, x: ref.x + rW - eW };
                    case 'center': return { ...el, x: ref.x + rW/2 - eW/2 };
                    case 'middle': return { ...el, y: ref.y + rH/2 - eH/2 };
                    default: return el;
                }
            }),
            isDirty: true
        }));
        get().saveHistory();
    },

    setElementDistance: (refId, targetId, axis, newDistance) => {
        const { elements } = get();
        const ref = elements.find(e => e.id === refId);
        const target = elements.find(e => e.id === targetId);
        if (!ref || !target) return;

        const getBounds = (el) => {
            const sx = el.scaleX || 1;
            const sy = el.scaleY || 1;
            let x = el.x, y = el.y, w = 0, h = 0;
            if (el.type === 'circle') {
                const r = (el.radius || 50) * Math.max(sx, sy);
                x -= r; y -= r; w = r * 2; h = r * 2;
            } else {
                w = (el.width || 100) * sx;
                h = (el.height || 100) * sy;
            }
            return { x, y, w, h };
        };

        const rB = getBounds(ref);
        const tB = getBounds(target);
        const updates = {};

        if (axis === 'x') {
            if (target.x >= ref.x) {
                updates.x = rB.x + rB.w + newDistance + (target.x - tB.x);
            } else {
                updates.x = rB.x - tB.w - newDistance + (target.x - tB.x);
            }
        } else {
            if (target.y >= ref.y) {
                updates.y = rB.y + rB.h + newDistance + (target.y - tB.y);
            } else {
                updates.y = rB.y - tB.h - newDistance + (target.y - tB.y);
            }
        }

        get().updateElementAndSave(targetId, updates);
    },

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
        set((s) => ({ elements: [...s.elements, newEl], selectedIds: [newEl.id], isDirty: true }));
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
            selectedIds: [], // Deselect individual to avoid confusion
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
    newDesign: (preset = 'custom', customWidth = null, customHeight = null) => {
        const size = SIZE_PRESETS[preset] || SIZE_PRESETS['custom'];
        const currentCompany = get().company; // Preserve the company chosen in Dashboard
        
        const width = customWidth || size.width;
        const height = customHeight || size.height;

        set({
            designId: null, title: 'Untitled Design',
            canvasWidth: width, canvasHeight: height,
            backgroundColor: '#ffffff', sizePreset: preset,
            elements: [], company: currentCompany, selectedIds: [], isDirty: false,
            history: [], historyIndex: -1, zoom: 1, pan: { x: 0, y: 0 },
        });
    },
}));

function getDefaultProps(type) {
    switch (type) {
        case 'text': return { text: 'Text', fontSize: 18, fontFamily: 'Arial', fontWeight: 'bold', fill: '#000000', stroke: 'transparent', strokeWidth: 0, width: 200, textAlign: 'left', underline: false, fontStyle: 'normal', mappingMode: 'smart' };
        case 'rect': return { width: 120, height: 80, fill: 'transparent', stroke: '#000000', strokeWidth: 2, cornerRadius: 4 };
        case 'circle': return { radius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'ellipse': return { width: 120, height: 80, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'line': return { points: [0, 0, 150, 0], stroke: '#000000', strokeWidth: 2 };
        case 'triangle': return { width: 100, height: 100, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'star': return { numPoints: 5, innerRadius: 20, outerRadius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'polygon': return { sides: 6, radius: 50, fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'placeholder': return { width: 100, height: 100, fill: 'rgba(37, 99, 235, 0.1)', stroke: '#2563eb', strokeWidth: 2, dash: [5, 5], fieldName: '' };
        case 'path': return { data: 'M 0 0 L 100 0 L 50 100 Z', fill: 'transparent', stroke: '#000000', strokeWidth: 2 };
        case 'barcode': return { barcodeValue: '8905263411803', barcodeFormat: 'CODE128', width: 200, height: 80, fill: '#000000', mappingMode: 'smart' };
        case 'qrcode': return { qrValue: 'https://saravanagraphics.com', width: 100, height: 100, mappingMode: 'smart' };
        case 'image': return { width: 150, height: 150, src: '' };
        default: return {};
    }
}
