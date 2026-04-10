import React, { useRef, useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import {
    MousePointer2, PenTool, Search, Hand, Pencil,
    Pipette, Palette, Box, Zap, Pen,
    Layers, SlidersHorizontal, Eraser, Sparkles,
    Square, Circle, Minus, Star, Hexagon, Triangle
} from 'lucide-react';
import './ToolStrip.css';

/*
  ToolStrip = horizontal bar below navbar.
  Two sections:
  1. MODE tools (pick, zoom, pan, eyedropper, eraser, freehand, fill, outline)
  2. DRAW tools (drag-to-draw: line, rect, circle, triangle, star, polygon)

  Items already in left Toolbar (click-to-add) are: Text, Rect, Circle, Triangle,
  Line, Star, Polygon, Barcode, QR, Image.
  The DRAW tools here let you DRAG to size them on canvas instead.
*/

const STRIP_TOOLS = [
    // --- Mode tools ---
    { type: 'pick',        icon: <MousePointer2 size={16} />, tooltip: 'Pick Tool — Select & Move (V)' },
    { type: 'shape-edit',  icon: <PenTool size={16} />,       tooltip: 'Shape Edit Tool' },
    { type: 'zoom-in',     icon: <Search size={16} />,        tooltip: 'Zoom In (click canvas)' },
    { type: 'pan',         icon: <Hand size={16} />,          tooltip: 'Pan / Hand Tool' },
    { type: 'sep1', sep: true },

    // --- Draw tools (drag on canvas to create & size) ---
    { type: 'draw-line',     icon: <Minus size={16} />,       tooltip: 'Draw Line (drag)' },
    { type: 'draw-rect',     icon: <Square size={16} />,      tooltip: 'Draw Rectangle (drag)' },
    { type: 'draw-circle',   icon: <Circle size={16} />,      tooltip: 'Draw Circle (drag)' },
    { type: 'draw-triangle', icon: <Triangle size={16} />,    tooltip: 'Draw Triangle (drag)' },
    { type: 'draw-star',     icon: <Star size={16} />,        tooltip: 'Draw Star (drag)' },
    { type: 'draw-polygon',  icon: <Hexagon size={16} />,     tooltip: 'Draw Polygon (drag)' },
    { type: 'sep2', sep: true },

    // --- Freehand & Curves ---
    { type: 'freehand',    icon: <Pencil size={16} />,        tooltip: 'Freehand Draw' },
    { type: 'smart-draw',  icon: <Sparkles size={16} />,      tooltip: 'Smart Draw (smooth curves)' },
    { type: 'bezier',      icon: <Zap size={16} />,           tooltip: 'Bezier Curve' },
    { type: 'pen',         icon: <Pen size={16} />,           tooltip: 'Pen Tool' },
    { type: 'sep3', sep: true },

    // --- Color & Effect tools ---
    { type: 'eyedropper',  icon: <Pipette size={16} />,       tooltip: 'Eyedropper — click element to pick color' },
    { type: 'fill',        icon: <Palette size={16} />,       tooltip: 'Fill Color — pick fill for selected element' },
    { type: 'outline',     icon: <Box size={16} />,           tooltip: 'Outline Color — pick stroke for selected element' },
    { type: 'eraser',      icon: <Eraser size={16} />,        tooltip: 'Eraser — click element to delete it' },
];

export default function ToolStrip() {
    const { elements, selectedId, updateElementAndSave, zoom, setZoom } = useDesignStore();
    const { selectedTool, setSelectedTool } = useUIStore();
    const fillInputRef = useRef(null);
    const outlineInputRef = useRef(null);
    const [showFillPicker, setShowFillPicker] = useState(false);
    const [showOutlinePicker, setShowOutlinePicker] = useState(false);

    const handleToolClick = (tool) => {
        // Fill tool — open visible color picker
        if (tool.type === 'fill') {
            if (selectedId) {
                fillInputRef.current?.click();
            }
            return;
        }

        // Outline tool — open visible color picker
        if (tool.type === 'outline') {
            if (selectedId) {
                outlineInputRef.current?.click();
            }
            return;
        }

        // Zoom — immediate action
        if (tool.type === 'zoom-in') {
            setZoom(Math.min(zoom + 0.25, 8));
            return;
        }

        // All other tools — set as active tool mode
        setSelectedTool(tool.type);
    };

    const handleFillChange = (e) => {
        if (selectedId) {
            updateElementAndSave(selectedId, { fill: e.target.value });
        }
    };

    const handleOutlineChange = (e) => {
        if (selectedId) {
            const el = elements.find(el => el.id === selectedId);
            updateElementAndSave(selectedId, {
                stroke: e.target.value,
                strokeWidth: Math.max(1, el?.strokeWidth || 2),
            });
        }
    };

    const selectedEl = selectedId ? elements.find(e => e.id === selectedId) : null;

    return (
        <div className="tool-strip">
            {STRIP_TOOLS.map((tool) =>
                tool.sep ? (
                    <div key={tool.type} className="tool-strip-sep" />
                ) : (
                    <button
                        key={tool.type}
                        className={`tool-strip-btn ${selectedTool === tool.type ? 'active' : ''}`}
                        onClick={() => handleToolClick(tool)}
                        title={tool.tooltip}
                    >
                        {tool.icon}
                    </button>
                )
            )}

            {/* Live fill/outline color swatches when element is selected */}
            {selectedEl && (
                <div className="tool-strip-colors">
                    <div className="tool-strip-sep" />
                    <label className="color-swatch-btn" title="Fill Color" style={{ background: selectedEl.fill || '#ffffff' }}>
                        <input type="color" value={selectedEl.fill || '#ffffff'} onChange={handleFillChange} />
                    </label>
                    <label className="color-swatch-btn outline-swatch" title="Stroke Color" style={{ background: selectedEl.stroke || 'transparent' }}>
                        <input type="color" value={selectedEl.stroke || '#000000'} onChange={handleOutlineChange} />
                    </label>
                </div>
            )}

            {/* Hidden refs for fill/outline tool buttons */}
            <input ref={fillInputRef} type="color" style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} onChange={handleFillChange} />
            <input ref={outlineInputRef} type="color" style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} onChange={handleOutlineChange} />
        </div>
    );
}
