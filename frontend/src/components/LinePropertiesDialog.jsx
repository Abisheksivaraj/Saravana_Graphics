import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx, hexToCmyk, cmykToHex } from '../store/uiStore';
import './LinePropertiesDialog.css';

const DASH_STYLES = [
    { id: 'solid', label: '━━━━━━━━', dash: [] },
    { id: 'dashed', label: '--------', dash: [10, 5] },
    { id: 'dotted', label: '.........', dash: [2, 2] },
    { id: 'dash-dot', label: '--- . ---', dash: [10, 2, 2, 2] },
];

const CAP_STYLES = [
    { id: 'butt', label: 'None' },
    { id: 'square', label: 'Square' },
    { id: 'round', label: 'Round' },
];

export default function LinePropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('line'); // 'line', 'position'

    if (!el || el.type !== 'line') return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

    // Konva Line uses [x1, y1, x2, y2] relative to the element's x,y position
    // Usually we keep x,y as the top-left of the bounding box and points as relative
    const points = el.points || [0, 0, 100, 0];
    const x1 = points[0], y1 = points[1], x2 = points[2], y2 = points[3];
    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    const renderColorInput = (label, colorKey, opacityKey) => {
        const color = el[colorKey] || '#000000';
        const opacity = el[opacityKey] !== undefined ? el[opacityKey] : 1;
        const cmyk = hexToCmyk(color);

        const handleCmyk = (k, v) => {
            const nc = { ...cmyk, [k]: Number(v) };
            update({ [colorKey]: cmykToHex(nc.c, nc.m, nc.y, nc.k) });
        };

        return (
            <div className="bt-field-row" style={{ alignItems: 'flex-start' }}>
                <label>{label}:</label>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <input 
                            type="color" 
                            style={{ width: 40, height: 20, padding: 0, border: '1px solid #999' }}
                            value={color === 'transparent' ? '#ffffff' : color}
                            onChange={e => update({ [colorKey]: e.target.value.toUpperCase() })}
                        />
                        <select 
                            className="bt-win-input" 
                            style={{ width: 80 }}
                            value={color === 'transparent' ? 'transparent' : color}
                            onChange={e => update({ [colorKey]: e.target.value })}
                        >
                            <option value="transparent">None</option>
                            <option value={color === 'transparent' ? '#000000' : color}>{color === 'transparent' ? 'Color' : color}</option>
                        </select>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog line-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">Line Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>⚡ Line 1</span>
                            </div>
                            <div 
                                className={`bt-tree-item indent ${activeTab === 'line' ? 'active' : ''}`}
                                onClick={() => setActiveTab('line')}
                            >
                                <span className="bt-tree-icon">📏</span>
                                <span>Line</span>
                            </div>
                            <div 
                                className={`bt-tree-item indent ${activeTab === 'position' ? 'active' : ''}`}
                                onClick={() => setActiveTab('position')}
                            >
                                <span className="bt-tree-icon">📍</span>
                                <span>Position</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="bt-dialog-content">
                        {activeTab === 'line' && (
                            <div className="bt-scroll-area">
                                <fieldset className="bt-fieldset">
                                    <legend>Line Properties</legend>
                                    <div className="bt-field-row">
                                        <label>Length:</label>
                                        <input 
                                            type="number" 
                                            disabled
                                            value={Number(pxToUnit(length, measurementUnit).toFixed(3))}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Thickness:</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                className="bt-win-input"
                                                style={{ width: 80 }}
                                                value={Number(pxToUnit(el.strokeWidth || 1, 'pt').toFixed(1))}
                                                onChange={e => update({ strokeWidth: unitToPx(Number(e.target.value), 'pt') })}
                                            />
                                            <span className="unit">pt</span>
                                        </div>
                                    </div>
                                    {renderColorInput('Color', 'stroke', 'opacity')}
                                    
                                    <div className="bt-field-row mt-2">
                                        <label>Transparency:</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="range" 
                                                min="0" max="100" 
                                                style={{ width: 120 }}
                                                value={Math.round((1 - (el.opacity ?? 1)) * 100)} 
                                                onChange={e => {
                                                    const val = 1 - (Number(e.target.value) / 100);
                                                    update({ opacity: val });
                                                }}
                                            />
                                            <span className="unit" style={{ width: 35 }}>{Math.round((1 - (el.opacity ?? 1)) * 100)}%</span>
                                        </div>
                                    </div>

                                    <div className="bt-field-row mt-2">
                                        <label>Dash style:</label>
                                        <select 
                                            className="bt-win-input"
                                            style={{ width: 160 }}
                                            value={el.dash?.length > 0 ? (el.dash[0] > 5 ? 'dashed' : 'dotted') : 'solid'}
                                            onChange={e => update({ dash: DASH_STYLES.find(d => d.id === e.target.value).dash })}
                                        >
                                            {DASH_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </fieldset>

                                <div className="flex gap-4">
                                    <fieldset className="bt-fieldset flex-1">
                                        <legend>End Point 1</legend>
                                        <div className="bt-field-row">
                                            <label style={{ width: 20 }}>X:</label>
                                            <input 
                                                type="number" 
                                                className="bt-win-input" 
                                                value={Number(pxToUnit(el.x + x1, measurementUnit).toFixed(3))} 
                                                onChange={e => {
                                                    const newX = unitToPx(Number(e.target.value), measurementUnit);
                                                    const diff = newX - (el.x + x1);
                                                    update({ x: el.x + diff, points: [points[0], points[1], points[2] - diff, points[3]] });
                                                }}
                                            />
                                        </div>
                                        <div className="bt-field-row">
                                            <label style={{ width: 20 }}>Y:</label>
                                            <input 
                                                type="number" 
                                                className="bt-win-input" 
                                                value={Number(pxToUnit(el.y + y1, measurementUnit).toFixed(3))} 
                                                onChange={e => {
                                                    const newY = unitToPx(Number(e.target.value), measurementUnit);
                                                    const diff = newY - (el.y + y1);
                                                    update({ y: el.y + diff, points: [points[0], points[1], points[2], points[3] - diff] });
                                                }}
                                            />
                                        </div>
                                        <div className="bt-field-row">
                                            <label style={{ width: 30 }}>Cap:</label>
                                            <select 
                                                className="bt-win-input" 
                                                style={{ width: 100 }}
                                                value={el.lineCap || 'butt'} 
                                                onChange={e => update({ lineCap: e.target.value })}
                                            >
                                                {CAP_STYLES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </fieldset>

                                    <fieldset className="bt-fieldset flex-1">
                                        <legend>End Point 2</legend>
                                        <div className="bt-field-row">
                                            <label style={{ width: 20 }}>X:</label>
                                            <input 
                                                type="number" 
                                                className="bt-win-input" 
                                                value={Number(pxToUnit(el.x + x2, measurementUnit).toFixed(3))} 
                                                onChange={e => {
                                                    const newX = unitToPx(Number(e.target.value), measurementUnit);
                                                    const diff = newX - (el.x + x2);
                                                    update({ points: [points[0], points[1], points[2] + diff, points[3]] });
                                                }}
                                            />
                                        </div>
                                        <div className="bt-field-row">
                                            <label style={{ width: 20 }}>Y:</label>
                                            <input 
                                                type="number" 
                                                className="bt-win-input" 
                                                value={Number(pxToUnit(el.y + y2, measurementUnit).toFixed(3))} 
                                                onChange={e => {
                                                    const newY = unitToPx(Number(e.target.value), measurementUnit);
                                                    const diff = newY - (el.y + y2);
                                                    update({ points: [points[0], points[1], points[2], points[3] + diff] });
                                                }}
                                            />
                                        </div>
                                        <div className="bt-field-row">
                                            <label style={{ width: 30 }}>Cap:</label>
                                            <select 
                                                className="bt-win-input" 
                                                style={{ width: 100 }}
                                                value={el.lineCap || 'butt'} 
                                                onChange={e => update({ lineCap: e.target.value })}
                                            >
                                                {CAP_STYLES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        </div>
                                    </fieldset>
                                </div>
                            </div>
                        )}

                        {activeTab === 'position' && (
                            <div className="bt-scroll-area">
                                <fieldset className="bt-fieldset">
                                    <legend>Position</legend>
                                    <div className="bt-field-row">
                                        <label>X:</label>
                                        <input 
                                            type="number" 
                                            value={Number(pxToUnit(el.x || 0, measurementUnit).toFixed(3))}
                                            onChange={e => update({ x: unitToPx(Number(e.target.value), measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Y:</label>
                                        <input 
                                            type="number" 
                                            value={Number(pxToUnit(el.y || 0, measurementUnit).toFixed(3))}
                                            onChange={e => update({ y: unitToPx(Number(e.target.value), measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                </fieldset>

                                <fieldset className="bt-fieldset">
                                    <legend>Rotation</legend>
                                    <div className="bt-field-row">
                                        <label>Angle:</label>
                                        <input 
                                            type="number" 
                                            value={Math.round(el.rotation || 0)}
                                            onChange={e => update({ rotation: Number(e.target.value) })}
                                        />
                                        <span className="unit">°</span>
                                    </div>
                                </fieldset>

                                <fieldset className="bt-fieldset">
                                    <legend>Object Locking</legend>
                                    <div className="bt-field-row">
                                        <input type="checkbox" id="lock-line" checked={el.locked} onChange={e => update({ locked: e.target.checked })} />
                                        <label htmlFor="lock-line" style={{ width: 'auto', marginLeft: 8 }}>Lock Object</label>
                                    </div>
                                </fieldset>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bt-dialog-footer">
                    <button className="bt-win-btn primary" onClick={onClose}>Close</button>
                    <button className="bt-win-btn" disabled>Help</button>
                </div>
            </div>
        </div>
    );
}
