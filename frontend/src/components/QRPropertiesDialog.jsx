import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import './BarcodePropertiesDialog.css'; // Reuse barcode dialog styles
import CmykColorPicker from './CmykColorPicker';

const CATEGORIES = [
    { id: 'symbology', label: 'Size', icon: '📊' },
    { id: 'sources', label: 'Enter Value', icon: '💾' }
];

export default function QRPropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('symbology');
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    if (!el) return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog barcode-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">QR Code Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>📱 QR Code 1</span>
                            </div>
                            {CATEGORIES.map(cat => (
                                <div 
                                    key={cat.id} 
                                    className={`bt-tree-item indent ${activeTab === cat.id ? 'active' : ''}`}
                                    onClick={() => setActiveTab(cat.id)}
                                >
                                    <span className="bt-tree-icon">{cat.icon}</span>
                                    <span>{cat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="bt-dialog-content">
                        {activeTab === 'symbology' && (
                            <fieldset className="bt-fieldset">
                                <legend>QR Settings</legend>
                                <div className="bt-field-row">
                                    <label>Size:</label>
                                    <input 
                                        type="number" 
                                        value={Number(pxToUnit(el.width || 100, measurementUnit).toFixed(2))}
                                        onChange={e => {
                                            const val = unitToPx(Number(e.target.value), measurementUnit);
                                            update({ width: val, height: val }); // QR is always square
                                        }}
                                    />
                                    <span className="unit">{measurementUnit}</span>
                                </div>
                                <div className="bt-field-row mt-4" style={{ alignItems: 'flex-start' }}>
                                    <label>Color:</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                                            <button 
                                                style={{ width: 40, height: 24, padding: 0, backgroundColor: el.fill || '#000000', border: '1px solid #999', cursor: 'pointer' }}
                                                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                                            />
                                            {colorPickerOpen && (
                                                <CmykColorPicker 
                                                    color={el.fill} 
                                                    onChange={newColor => update({ fill: newColor.toUpperCase() })} 
                                                    onClose={() => setColorPickerOpen(false)} 
                                                />
                                            )}
                                            <input 
                                                className="bt-win-input"
                                                style={{ width: 80, fontSize: 11, fontFamily: 'monospace' }}
                                                value={el.fill?.toUpperCase() || '#000000'}
                                                onChange={e => update({ fill: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                        )}

                        {activeTab === 'sources' && (
                            <fieldset className="bt-fieldset">
                                <legend>Data Source</legend>
                                <div className="bt-field-row">
                                    <label>Value:</label>
                                    <textarea 
                                        className="bt-win-input w-full"
                                        style={{ height: 100, resize: 'none' }}
                                        value={el.qrValue || ''} 
                                        onChange={e => update({ qrValue: e.target.value })}
                                    />
                                </div>
                                <div className="bt-info-box mt-4">
                                    <span className="bt-info-icon">ℹ️</span>
                                    <p>To use Excel data, enter the column name (e.g. "EAN") and set mode to Auto.</p>
                                </div>
                            </fieldset>
                        )}
                    </div>
                </div>

                <div className="bt-dialog-footer">
                    <button className="bt-win-btn primary" onClick={onClose}>Apply</button>
                    <button className="bt-win-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
