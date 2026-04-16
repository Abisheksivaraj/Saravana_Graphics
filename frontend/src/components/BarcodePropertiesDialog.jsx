import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx, hexToCmyk, cmykToHex } from '../store/uiStore';
import './BarcodePropertiesDialog.css';

const CATEGORIES = [
    { id: 'symbology', label: 'Symbology and Size', icon: '📊' },
    { id: 'readable', label: 'Human Readable', icon: '123' },
    { id: 'font', label: 'Font', icon: 'A' },
    { id: 'sources', label: 'Enter Value', icon: '💾' }
];

const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Inter', 'Outfit'];
const BARCODE_FORMATS = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14'];

export default function BarcodePropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('symbology');

    if (!el) return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog barcode-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">Barcode Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>📦 Barcode 1</span>
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
                                <legend>Symbology Settings</legend>
                                <div className="bt-field-row">
                                    <label>Symbology:</label>
                                    <select 
                                        value={el.barcodeFormat || 'CODE128'} 
                                        onChange={e => update({ barcodeFormat: e.target.value })}
                                    >
                                        {BARCODE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="bt-field-divider" />
                                <div className="bt-field-group">
                                    <div className="bt-field-row">
                                        <label>Width:</label>
                                        <input 
                                            type="number" 
                                            value={Number(pxToUnit(el.width || 100, measurementUnit).toFixed(2))}
                                            onChange={e => update({ width: unitToPx(Number(e.target.value), measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Height:</label>
                                        <input 
                                            type="number" 
                                            value={Number(pxToUnit(el.height || 50, measurementUnit).toFixed(2))}
                                            onChange={e => update({ height: unitToPx(Number(e.target.value), measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                </div>
                                <div className="bt-field-row mt-4" style={{ alignItems: 'flex-start' }}>
                                    <label>Bar Color:</label>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="color" 
                                                style={{ width: 40, height: 24, padding: 0 }}
                                                value={el.fill || '#000000'}
                                                onChange={e => update({ fill: e.target.value.toUpperCase() })}
                                            />
                                            <input 
                                                className="bt-win-input"
                                                style={{ width: 80, fontSize: 11, fontFamily: 'monospace' }}
                                                value={el.fill?.toUpperCase() || '#000000'}
                                                onChange={e => update({ fill: e.target.value.toUpperCase() })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-4 gap-1">
                                            {(() => {
                                                const cmyk = hexToCmyk(el.fill || '#000000');
                                                const handleCmyk = (k, v) => {
                                                    const nc = { ...cmyk, [k]: Number(v) };
                                                    update({ fill: cmykToHex(nc.c, nc.m, nc.y, nc.k) });
                                                };
                                                return ['c', 'm', 'y', 'k'].map(k => (
                                                    <div key={k} className="flex flex-col items-center">
                                                        <span className="text-[9px] font-bold uppercase">{k}</span>
                                                        <input 
                                                            type="number" 
                                                            className="bt-win-input" 
                                                            style={{ width: 35, height: 18, textAlign: 'center', fontSize: 10, padding: 0 }}
                                                            value={cmyk[k]} 
                                                            min="0" max="100"
                                                            onChange={e => handleCmyk(k, e.target.value)}
                                                        />
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </fieldset>
                        )}

                        {activeTab === 'readable' && (
                            <fieldset className="bt-fieldset">
                                <legend>Human Readable</legend>
                                <div className="bt-field-row">
                                    <label>Visibility:</label>
                                    <select defaultValue="auto">
                                        <option value="auto">Auto</option>
                                        <option value="none">None</option>
                                    </select>
                                </div>
                                <div className="bt-field-row">
                                    <label>Placement:</label>
                                    <select defaultValue="bottom">
                                        <option value="bottom">Bottom</option>
                                        <option value="top">Top</option>
                                    </select>
                                </div>
                            </fieldset>
                        )}

                        {activeTab === 'font' && (
                            <fieldset className="bt-fieldset">
                                <legend>Number Font</legend>
                                <div className="bt-field-row">
                                    <label>Family:</label>
                                    <select 
                                        value={el.fontFamily || 'Arial'} 
                                        onChange={e => update({ fontFamily: e.target.value })}
                                    >
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="bt-field-row">
                                    <label>Size:</label>
                                    <input 
                                        type="number" 
                                        value={Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(1))}
                                        onChange={e => update({ fontSize: unitToPx(Number(e.target.value), 'pt') })}
                                    />
                                    <span className="unit">pt</span>
                                </div>
                                <div className="bt-style-grid mt-4">
                                    <button 
                                        className={`bt-win-btn ${el.fontWeight === 'bold' ? 'active' : ''}`}
                                        onClick={() => update({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}
                                    >Bold</button>
                                    <button 
                                        className={`bt-win-btn ${el.fontStyle === 'italic' ? 'active' : ''}`}
                                        onClick={() => update({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                    >Italic</button>
                                </div>
                            </fieldset>
                        )}

                        {activeTab === 'sources' && (
                            <fieldset className="bt-fieldset">
                                <legend>Data Source</legend>
                                <div className="bt-field-row">
                                    <label>Value:</label>
                                    <input 
                                        className="bt-win-input w-full"
                                        value={el.barcodeValue || ''} 
                                        onChange={e => update({ barcodeValue: e.target.value })}
                                    />
                                </div>
                                <div className="bt-info-box mt-4">
                                    <span className="bt-info-icon">ℹ️</span>
                                    <p>To use Excel data, enter the column name (e.g. "SKU") and set mode to Auto.</p>
                                </div>
                            </fieldset>
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
