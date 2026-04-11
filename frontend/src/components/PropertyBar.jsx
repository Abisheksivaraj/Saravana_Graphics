import React, { useRef } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import {
    Type, Square, Circle, Minus, Star, Hexagon, Triangle,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight, Underline,
    Settings, ZoomIn, ZoomOut, Grid, Maximize2, Palette, Box,
    ChevronDown, Hash, Move, Trash2, Layers
} from 'lucide-react';
import './PropertyBar.css';

export default function PropertyBar() {
    const {
        elements, selectedId, updateElementAndSave,
        zoom, setZoom, canvasWidth, canvasHeight, setCanvasSize,
        showGrid, setShowGrid, deleteElement, backgroundColor, setBackgroundColor
    } = useDesignStore();
    
    const selectedEl = selectedId ? elements.find(e => e.id === selectedId) : null;

    const handleUpdate = (updates) => {
        if (selectedId) updateElementAndSave(selectedId, updates);
    };

    // --- SUB-COMPONENTS FOR CONTEXTS ---

    const GlobalControls = () => (
        <div className="prop-section">
            <div className="prop-group">
                <Settings size={14} className="text-muted" />
                <span className="prop-label">Canvas</span>
                <input type="number" value={canvasWidth} onChange={e => setCanvasSize(Number(e.target.value), canvasHeight)} className="prop-input" title="Width" />
                <span className="text-muted">×</span>
                <input type="number" value={canvasHeight} onChange={e => setCanvasSize(canvasWidth, Number(e.target.value))} className="prop-input" title="Height" />
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <Palette size={14} className="text-muted" />
                <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="prop-color-picker" title="Page Background" />
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <button className="prop-btn" onClick={() => setZoom(zoom - 0.1)} title="Zoom Out"><ZoomOut size={16} /></button>
                <span className="prop-value" style={{ width: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <button className="prop-btn" onClick={() => setZoom(zoom + 0.1)} title="Zoom In"><ZoomIn size={16} /></button>
            </div>
        </div>
    );

    const TextControls = ({ el }) => (
        <div className="prop-section">
            <div className="prop-group">
                <select 
                    className="prop-select" 
                    value={el.fontFamily || 'Arial'} 
                    onChange={e => handleUpdate({ fontFamily: e.target.value })}
                >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Impact">Impact</option>
                </select>
                <input 
                    type="number" 
                    value={el.fontSize || 16} 
                    onChange={e => handleUpdate({ fontSize: Number(e.target.value) })} 
                    className="prop-input" 
                    style={{ width: 50 }}
                />
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <button className={`prop-btn ${el.fontWeight === 'bold' ? 'active' : ''}`} onClick={() => handleUpdate({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}><Bold size={16} /></button>
                <button className={`prop-btn ${el.fontStyle === 'italic' ? 'active' : ''}`} onClick={() => handleUpdate({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic size={16} /></button>
                <button className={`prop-btn ${el.underline ? 'active' : ''}`} onClick={() => handleUpdate({ underline: !el.underline })}><Underline size={16} /></button>
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <button className={`prop-btn ${el.textAlign === 'left' ? 'active' : ''}`} onClick={() => handleUpdate({ textAlign: 'left' })}><AlignLeft size={16} /></button>
                <button className={`prop-btn ${el.textAlign === 'center' ? 'active' : ''}`} onClick={() => handleUpdate({ textAlign: 'center' })}><AlignCenter size={16} /></button>
                <button className={`prop-btn ${el.textAlign === 'right' ? 'active' : ''}`} onClick={() => handleUpdate({ textAlign: 'right' })}><AlignRight size={16} /></button>
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <Palette size={14} className="text-muted" />
                <input type="color" value={el.fill || '#000000'} onChange={e => handleUpdate({ fill: e.target.value })} className="prop-color-picker" />
            </div>
        </div>
    );

    const ShapeControls = ({ el }) => (
        <div className="prop-section">
            <div className="prop-group">
                <Palette size={14} className="text-muted" />
                <span className="prop-label">Fill</span>
                <input type="color" value={el.fill || '#transparent'} onChange={e => handleUpdate({ fill: e.target.value })} className="prop-color-picker" />
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <Box size={14} className="text-muted" />
                <span className="prop-label">Stroke</span>
                <input type="color" value={el.stroke || '#000000'} onChange={e => handleUpdate({ stroke: e.target.value })} className="prop-color-picker" />
                <input 
                    type="number" 
                    value={el.strokeWidth || 0} 
                    onChange={e => handleUpdate({ strokeWidth: Number(e.target.value) })} 
                    className="prop-input" 
                    style={{ width: 45 }}
                />
            </div>
            {el.type === 'rect' && (
                <>
                    <div className="prop-sep" />
                    <div className="prop-group">
                        <Square size={14} className="text-muted" />
                        <span className="prop-label">Radius</span>
                        <input 
                            type="number" 
                            value={el.cornerRadius || 0} 
                            onChange={e => handleUpdate({ cornerRadius: Number(e.target.value) })} 
                            className="prop-input" 
                            style={{ width: 45 }}
                        />
                    </div>
                </>
            )}
        </div>
    );

    const BarcodeControls = ({ el }) => (
        <div className="prop-section">
            <div className="prop-group">
                <Hash size={14} className="text-muted" />
                <span className="prop-label">Data</span>
                <input 
                    type="text" 
                    value={el.barcodeValue || el.qrValue || ''} 
                    onChange={e => handleUpdate(el.type === 'barcode' ? { barcodeValue: e.target.value } : { qrValue: e.target.value })} 
                    className="prop-input" 
                    style={{ width: 150 }}
                />
            </div>
            <div className="prop-sep" />
            <div className="prop-group">
                <Palette size={14} className="text-muted" />
                <input type="color" value={el.fill || '#000000'} onChange={e => handleUpdate({ fill: e.target.value })} className="prop-color-picker" />
            </div>
        </div>
    );

    return (
        <div className="property-bar">
            <div className="property-bar-content">
                {!selectedEl ? (
                    <GlobalControls />
                ) : (
                    <>
                        <div className="prop-context-label">
                            {selectedEl.type.toUpperCase()}
                        </div>
                        <div className="prop-sep" />
                        {selectedEl.type === 'text' && <TextControls el={selectedEl} />}
                        {(['rect', 'circle', 'triangle', 'star', 'polygon', 'line'].includes(selectedEl.type)) && <ShapeControls el={selectedEl} />}
                        {(['barcode', 'qrcode'].includes(selectedEl.type)) && <BarcodeControls el={selectedEl} />}
                        
                        <div className="prop-push" />
                        <div className="prop-group">
                            <button className="prop-btn danger" onClick={() => deleteElement(selectedId)} title="Delete Object">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
