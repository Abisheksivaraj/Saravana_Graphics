import React, { useRef, useState, useEffect } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import {
    Type, Square, Circle, Minus, Star, Hexagon, Triangle,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight, Underline,
    Settings, ZoomIn, ZoomOut, Grid, Maximize2, Palette, Box,
    ChevronDown, Hash, Move, Trash2, Layers, Layout
} from 'lucide-react';
import './PropertyBar.css';

export default function PropertyBar() {
    const {
        elements, selectedIds, updateElementAndSave,
        zoom, setZoom, canvasWidth, canvasHeight, setCanvasSize,
        showGrid, setShowGrid, deleteElement, backgroundColor, setBackgroundColor
    } = useDesignStore();
    
    const { measurementUnit } = useUIStore();

    const selectedEl = selectedIds.length > 0 ? elements.find(e => e.id === selectedIds[0]) : null;

    const handleUpdate = (updates) => {
        selectedIds.forEach(id => updateElementAndSave(id, updates));
    };

    // --- REUSABLE INPUT FOR FLUID EDITING ---
    const formatNum = (v) => Number(Number(v).toFixed(2));

    const PropInput = ({ value, onChange, title, type = "number", className = "prop-input", style = {} }) => {
        const [localValue, setLocalValue] = useState(value);

        useEffect(() => {
            setLocalValue(value);
        }, [value]);

        const handleChange = (e) => {
            const val = e.target.value;
            setLocalValue(val);
            if (val !== '' && !isNaN(val)) {
                onChange(Number(val));
            }
        };

        return (
            <input 
                type={type}
                value={localValue}
                onChange={handleChange}
                onBlur={() => setLocalValue(value)}
                className={className}
                style={style}
                title={title}
            />
        );
    };

    // --- SUB-COMPONENTS FOR CONTEXTS ---

    const GlobalControls = () => (
        <div className="prop-section">
            <div className="prop-group">
                <Settings size={14} className="text-muted" />
                <span className="prop-label">Dimensions:</span>
                <span className="font-bold text-xs" style={{ color: 'var(--primary)' }}>
                    {formatNum(pxToUnit(canvasWidth, measurementUnit))} × {formatNum(pxToUnit(canvasHeight, measurementUnit))} {measurementUnit}
                </span>
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
                    <option value="Calibri">Calibri</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Impact">Impact</option>
                </select>
                <PropInput 
                    value={formatNum(pxToUnit(el.fontSize || 16, 'pt'))} 
                    onChange={v => handleUpdate({ fontSize: unitToPx(v, 'pt') })} 
                    style={{ width: 50 }}
                    title="Font Size (pt)"
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
                <PropInput 
                    value={formatNum(pxToUnit(el.strokeWidth || 0, measurementUnit))} 
                    onChange={v => handleUpdate({ strokeWidth: unitToPx(v, measurementUnit) })} 
                    style={{ width: 45 }}
                    title={`Stroke (${measurementUnit})`}
                />
            </div>
            {(['rect', 'ellipse', 'triangle', 'star', 'polygon', 'line', 'barcode', 'qrcode', 'image', 'placeholder'].includes(el.type)) && (
                <>
                    <div className="prop-sep" />
                    <div className="prop-group">
                        <Maximize2 size={14} className="text-muted" />
                        <span className="prop-label">W</span>
                        <PropInput 
                            value={formatNum(pxToUnit(el.width || (el.radius ? el.radius * 2 : (el.outerRadius ? el.outerRadius * 2 : 0)), measurementUnit))} 
                            onChange={val => {
                                const pxVal = unitToPx(val, measurementUnit);
                                if (el.type === 'circle' || el.type === 'polygon') handleUpdate({ radius: pxVal / 2 });
                                else if (el.type === 'star') handleUpdate({ outerRadius: pxVal / 2, innerRadius: pxVal / 5 });
                                else handleUpdate({ width: pxVal });
                            }} 
                            style={{ width: 45 }}
                            title={`Width (${measurementUnit})`}
                        />
                        <span className="prop-label">H</span>
                        <PropInput 
                            value={formatNum(pxToUnit(el.height || (el.radius ? el.radius * 2 : (el.outerRadius ? el.outerRadius * 2 : 0)), measurementUnit))} 
                            onChange={val => {
                                const pxVal = unitToPx(val, measurementUnit);
                                if (el.type === 'circle' || el.type === 'polygon') handleUpdate({ radius: pxVal / 2 });
                                else if (el.type === 'star') handleUpdate({ outerRadius: pxVal / 2, innerRadius: pxVal / 5 });
                                else handleUpdate({ height: pxVal });
                            }} 
                            style={{ width: 45 }}
                            title={`Height (${measurementUnit})`}
                        />
                    </div>
                </>
            )}
            {(el.type === 'rect' || el.type === 'circle' || el.type === 'star' || el.type === 'polygon') && (
                <>
                    <div className="prop-sep" />
                    <div className="prop-group">
                        <Square size={14} className="text-muted" />
                        <span className="prop-label">Radius</span>
                        <PropInput 
                            value={formatNum(pxToUnit(el.cornerRadius || el.radius || el.outerRadius || 0, measurementUnit))} 
                            onChange={val => {
                                const pxVal = unitToPx(val, measurementUnit);
                                if (el.type === 'rect') handleUpdate({ cornerRadius: pxVal });
                                else if (el.type === 'circle' || el.type === 'polygon') handleUpdate({ radius: pxVal });
                                else if (el.type === 'star') handleUpdate({ outerRadius: pxVal, innerRadius: pxVal / 2.5 });
                            }} 
                            style={{ width: 45 }}
                            title={`Corner/Shape Radius (${measurementUnit})`}
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

    const PlaceholderControls = ({ el }) => (
        <div className="prop-section">
            <div className="prop-group">
                <Layout size={14} className="text-muted" />
                <span className="prop-label">Excel Field</span>
                <input 
                    type="text" 
                    value={el.fieldName || ''} 
                    onChange={e => handleUpdate({ fieldName: e.target.value })} 
                    className="prop-input" 
                    style={{ width: 150 }}
                    placeholder="e.g. SKU, Price"
                />
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
                        {selectedEl.type === 'placeholder' && <PlaceholderControls el={selectedEl} />}
                        
                        <div className="prop-push" />
                        <div className="prop-group">
                            <button className="prop-btn danger" onClick={() => deleteElement(selectedIds)} title="Delete Selection">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
