import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import './ShapePropertiesDialog.css'; // Reuse shape styles
import NumericInput from './NumericInput';

const ANCHORS = [
    'Top Left', 'Top Center', 'Top Right',
    'Middle Left', 'Middle Center', 'Middle Right',
    'Bottom Left', 'Bottom Center', 'Bottom Right'
];

export default function ImagePropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('image'); // 'image' or 'position'

    if (!el) return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog shape-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">Image Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>🖼️ Image 1</span>
                            </div>
                            <div 
                                className={`bt-tree-item indent ${activeTab === 'image' ? 'active' : ''}`}
                                onClick={() => setActiveTab('image')}
                            >
                                <span className="bt-tree-icon">🖼️</span>
                                <span>Image</span>
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
                        {activeTab === 'image' && (
                            <div className="bt-scroll-area">
                                {/* Preview */}
                                <fieldset className="bt-fieldset">
                                    <legend>Image Source</legend>
                                    <div className="flex gap-4 items-start">
                                        <div style={{ width: 80, height: 80, border: '1px solid #ccc', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            <img src={el.src} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        </div>
                                        <div className="flex-1 text-xs text-gray-600 truncate">
                                            <p>Type: Image</p>
                                            <p style={{ marginTop: 4 }}>URL/Data: {el.src?.substring(0, 50)}...</p>
                                        </div>
                                    </div>
                                </fieldset>

                                {/* Size */}
                                <fieldset className="bt-fieldset">
                                    <legend>Size</legend>
                                    <div className="bt-field-group">
                                        <div className="bt-field-row" style={{ flex: 1, marginBottom: 0 }}>
                                            <label style={{ width: 60 }}>Width:</label>
                                            <NumericInput 
                                                style={{ width: 65 }}
                                                value={pxToUnit(el.width || 100, measurementUnit)}
                                                onChange={v => update({ width: unitToPx(v, measurementUnit) })}
                                            />
                                            <span className="unit">{measurementUnit}</span>
                                        </div>
                                        <div className="bt-field-row" style={{ flex: 1, marginBottom: 0 }}>
                                            <label style={{ width: 60 }}>Height:</label>
                                            <NumericInput 
                                                style={{ width: 65 }}
                                                value={pxToUnit(el.height || 100, measurementUnit)}
                                                onChange={v => update({ height: unitToPx(v, measurementUnit) })}
                                            />
                                            <span className="unit">{measurementUnit}</span>
                                        </div>
                                    </div>
                                    <div className="bt-field-row mt-3" style={{ marginLeft: 60 }}>
                                        <input type="checkbox" id="lock-ratio" style={{ width: 'auto', margin: 0 }} defaultChecked />
                                        <label htmlFor="lock-ratio" style={{ width: 'auto', marginLeft: 8 }}>Lock Aspect Ratio</label>
                                    </div>
                                </fieldset>

                                {/* Appearance */}
                                <fieldset className="bt-fieldset">
                                    <legend>Appearance</legend>
                                    <div className="bt-field-row">
                                        <label>Transparency:</label>
                                        <input 
                                            type="range" 
                                            min="0" max="100" 
                                            style={{ width: 100 }}
                                            value={Math.round((1 - (el.opacity !== undefined ? el.opacity : 1)) * 100)} 
                                            onChange={e => update({ opacity: 1 - Number(e.target.value) / 100 })}
                                        />
                                        <span className="unit ml-2">{Math.round((1 - (el.opacity !== undefined ? el.opacity : 1)) * 100)}%</span>
                                    </div>
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
