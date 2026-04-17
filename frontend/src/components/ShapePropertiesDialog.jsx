import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx, hexToCmyk, cmykToHex } from '../store/uiStore';
import './ShapePropertiesDialog.css';
import CmykColorPicker from './CmykColorPicker';
import NumericInput from './NumericInput';

const CORNER_TYPES = [
    { id: 'none', label: 'None' },
    { id: 'rectangular', label: 'Rectangular' },
    { id: 'rounded', label: 'Rounded' },
    { id: 'beveled', label: 'Beveled' },
    { id: 'concave', label: 'Concave' },
    { id: 'inverted', label: 'Inverted' },
];

const DASH_STYLES = [
    { id: 'solid', label: 'Solid', dash: [] },
    { id: 'dashed', label: 'Dashed', dash: [10, 5] },
    { id: 'dotted', label: 'Dotted', dash: [2, 2] },
    { id: 'dash-dot', label: 'Dash-Dot', dash: [10, 2, 2, 2] },
];

const ANCHORS = [
    'Top Left', 'Top Center', 'Top Right',
    'Middle Left', 'Middle Center', 'Middle Right',
    'Bottom Left', 'Bottom Center', 'Bottom Right'
];

export default function ShapePropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('shape'); // 'shape' or 'position'
    const [activePicker, setActivePicker] = useState(null);

    if (!el) return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

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
                    <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                        <button 
                            style={{ width: 40, height: 20, padding: 0, backgroundColor: color === 'transparent' ? '#ffffff' : color, border: '1px solid #999', cursor: 'pointer' }}
                            onClick={() => setActivePicker(activePicker === colorKey ? null : colorKey)}
                        />
                        {activePicker === colorKey && (
                            <CmykColorPicker 
                                color={color} 
                                onChange={newColor => update({ [colorKey]: newColor.toUpperCase() })} 
                                onClose={() => setActivePicker(null)} 
                            />
                        )}
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

                    <div className="bt-field-row mt-1" style={{ gap: 8 }}>
                        <label style={{ width: 'auto', minWidth: 0 }}>Transparency:</label>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            style={{ width: 60 }}
                            value={Math.round((1 - opacity) * 100)} 
                            onChange={e => update({ [opacityKey]: 1 - Number(e.target.value) / 100 })}
                        />
                        <span className="unit" style={{ width: 25 }}>{Math.round((1 - opacity) * 100)}%</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog shape-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">{el.type.charAt(0).toUpperCase() + el.type.slice(1)} Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>⚡ {el.type.charAt(0).toUpperCase() + el.type.slice(1)} 1</span>
                            </div>
                            <div 
                                className={`bt-tree-item indent ${activeTab === 'shape' ? 'active' : ''}`}
                                onClick={() => setActiveTab('shape')}
                            >
                                <span className="bt-tree-icon">⬜</span>
                                <span>{el.type.charAt(0).toUpperCase() + el.type.slice(1)}</span>
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
                        {activeTab === 'shape' && (
                            <div className="bt-scroll-area">
                                {/* Size */}
                                <fieldset className="bt-fieldset">
                                    <legend>Box Size</legend>
                                    <div className="bt-field-group">
                                        <div className="bt-field-row" style={{ flex: 1, marginBottom: 0 }}>
                                            <label style={{ width: 60 }}>Width:</label>
                                            <NumericInput 
                                                style={{ width: 65 }}
                                                value={pxToUnit(el.width || (el.radius ? el.radius * 2 : 100), measurementUnit)}
                                                onChange={v => {
                                                    const val = unitToPx(v, measurementUnit);
                                                    const updates = { width: val };
                                                    if (el.type === 'circle') {
                                                        updates.radius = val / 2;
                                                        updates.height = val;
                                                    } else if (el.radius) {
                                                        updates.radius = val / 2;
                                                    }
                                                    update(updates);
                                                }}
                                            />
                                            <span className="unit">{measurementUnit}</span>
                                        </div>
                                        <div className="bt-field-row" style={{ flex: 1, marginBottom: 0 }}>
                                            <label style={{ width: 60 }}>Height:</label>
                                            <NumericInput 
                                                style={{ width: 65 }}
                                                value={pxToUnit(el.height || (el.radius ? el.radius * 2 : 100), measurementUnit)}
                                                onChange={v => {
                                                    const val = unitToPx(v, measurementUnit);
                                                    const updates = { height: val };
                                                    if (el.type === 'circle') {
                                                        updates.radius = val / 2;
                                                        updates.width = val;
                                                    } else if (el.radius) {
                                                        updates.radius = val / 2;
                                                    }
                                                    update(updates);
                                                }}
                                            />
                                            <span className="unit">{measurementUnit}</span>
                                        </div>
                                    </div>
                                    <div className="bt-field-row mt-3" style={{ marginLeft: 60 }}>
                                        <input type="checkbox" id="lock-ratio" style={{ width: 'auto', margin: 0 }} />
                                        <label htmlFor="lock-ratio" style={{ width: 'auto', marginLeft: 8 }}>Lock Aspect Ratio</label>
                                    </div>
                                </fieldset>

                                {/* Options */}
                                <fieldset className="bt-fieldset">
                                    <legend>Box Options</legend>
                                    <div className="bt-field-row">
                                        <label>Corner type:</label>
                                        <select 
                                            className="bt-win-input"
                                            value={el.cornerType || (el.cornerRadius > 0 ? 'rounded' : 'rectangular')}
                                            onChange={e => {
                                                const type = e.target.value;
                                                const updates = { cornerType: type };
                                                if (type === 'rectangular' || type === 'none') {
                                                    updates.cornerRadius = 0;
                                                } else if (el.cornerRadius === 0 || !el.cornerRadius) {
                                                    updates.cornerRadius = 10;
                                                }
                                                update(updates);
                                            }}
                                        >
                                            {CORNER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Corner size:</label>
                                        <NumericInput 
                                            style={{ width: 65 }}
                                            value={pxToUnit(el.cornerRadius || 0, measurementUnit)}
                                            onChange={v => update({ cornerRadius: unitToPx(v, measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Sides:</label>
                                        <select className="bt-win-input" defaultValue="all">
                                            <option value="all">All</option>
                                            <option value="top">Top Only</option>
                                            <option value="bottom">Bottom Only</option>
                                        </select>
                                    </div>
                                </fieldset>

                                {/* Line Properties */}
                                <fieldset className="bt-fieldset">
                                    <legend>Line Properties</legend>
                                    <div className="bt-field-row">
                                        <label>Thickness:</label>
                                        <NumericInput 
                                            style={{ width: 65 }}
                                            value={pxToUnit(el.strokeWidth || 1, 'pt')}
                                            onChange={v => update({ strokeWidth: unitToPx(v, 'pt') })}
                                        />
                                        <span className="unit">pt</span>
                                    </div>
                                    {renderColorInput('Color', 'stroke', 'strokeOpacity')}
                                    <div className="bt-field-row">
                                        <label>Dash style:</label>
                                        <select 
                                            value={el.dash?.length > 0 ? (el.dash[0] > 5 ? 'dashed' : 'dotted') : 'solid'}
                                            onChange={e => update({ dash: DASH_STYLES.find(d => d.id === e.target.value).dash })}
                                        >
                                            {DASH_STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Compound style:</label>
                                        <select defaultValue="single">
                                            <option value="single">━━━━━━━━</option>
                                            <option value="double">════════</option>
                                            <option value="triple">≡≡≡≡≡≡≡≡</option>
                                        </select>
                                    </div>
                                </fieldset>

                                {/* Fill Properties */}
                                <fieldset className="bt-fieldset">
                                    <legend>Fill Properties</legend>
                                    {renderColorInput('Color', 'fill', 'opacity')}
                                </fieldset>
                            </div>
                        )}

                        {activeTab === 'position' && (
                            <div className="bt-scroll-area">
                                <fieldset className="bt-fieldset">
                                    <legend>Position</legend>
                                    <div className="bt-field-row">
                                        <label>Anchor:</label>
                                        <select defaultValue="Top Left">
                                            {ANCHORS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>X:</label>
                                        <NumericInput 
                                            style={{ width: 65 }}
                                            value={pxToUnit(el.x, measurementUnit)}
                                            onChange={v => update({ x: unitToPx(v, measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Y:</label>
                                        <NumericInput 
                                            style={{ width: 65 }}
                                            value={pxToUnit(el.y, measurementUnit)}
                                            onChange={v => update({ y: unitToPx(v, measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                </fieldset>

                                <fieldset className="bt-fieldset">
                                    <legend>Rotation</legend>
                                    <div className="bt-field-row">
                                        <label>Angle:</label>
                                        <NumericInput 
                                            style={{ width: 65 }}
                                            value={el.rotation || 0}
                                            onChange={v => update({ rotation: v })}
                                            min={-360}
                                            max={360}
                                        />
                                        <select 
                                            className="bt-win-input"
                                            style={{ width: 80, flex: 'none' }}
                                            value={`${el.rotation || 0}°`}
                                            onChange={e => update({ rotation: Number(e.target.value.replace('°', '')) })}
                                        >
                                            {[0, 90, 180, 270].map(deg => <option key={deg} value={`${deg}°`}>{deg}°</option>)}
                                        </select>
                                        <span className="unit">°</span>
                                    </div>
                                </fieldset>

                                <fieldset className="bt-fieldset">
                                    <legend>Layer</legend>
                                    <div className="bt-field-row">
                                        <label>Layer:</label>
                                        <select disabled>
                                            <option>Layer 1</option>
                                        </select>
                                    </div>
                                    <div className="bt-field-row mt-2" style={{ marginLeft: 110 }}>
                                        <input type="checkbox" id="lock-obj" style={{ width: 'auto', margin: 0 }} checked={el.locked} onChange={e => update({ locked: e.target.checked })} />
                                        <label htmlFor="lock-obj" style={{ width: 'auto', marginLeft: 8, cursor: 'pointer' }}>Lock object</label>
                                    </div>
                                </fieldset>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bt-dialog-footer">
                    <button className="bt-win-btn primary" onClick={onClose}>Apply</button>
                    <button className="bt-win-btn" onClick={onClose}>Close</button>
                    <button className="bt-win-btn" disabled>Help</button>
                </div>
            </div>
        </div>
    );
}
