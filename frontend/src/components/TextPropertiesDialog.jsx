import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx, hexToCmyk, cmykToHex } from '../store/uiStore';
import './TextPropertiesDialog.css';
import CmykColorPicker from './CmykColorPicker';
import NumericInput from './NumericInput';

import { FONTS, FONT_STYLES, POINT_SIZES } from '../constants/fonts';

export default function TextPropertiesDialog({ elementId, onClose }) {
    const { elements, updateElementAndSave } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const el = elements.find(e => e.id === elementId);
    const [activeTab, setActiveTab] = useState('font');
    const [fontSearch, setFontSearch] = useState(el.fontFamily || 'Arial');
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    if (!el) return null;

    const update = (updates) => updateElementAndSave(el.id, updates);

    const renderColorInput = (label, colorKey, opacityKey) => {
        const color = el[colorKey] || '#000000';
        const opacity = el[opacityKey] !== undefined ? el[opacityKey] : 1;
        const cmyk = hexToCmyk(color === 'transparent' ? '#ffffff' : color);

        const handleCmyk = (k, v) => {
            const nc = { ...cmyk, [k]: Number(v) };
            update({ [colorKey]: cmykToHex(nc.c, nc.m, nc.y, nc.k) });
        };

        return (
            <div className="bt-field-row" style={{ alignItems: 'flex-start' }}>
                <label style={{ width: 100 }}>{label}:</label>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                        <button 
                            style={{ width: 40, height: 20, padding: 0, backgroundColor: color === 'transparent' ? '#ffffff' : color, border: '1px solid #999', cursor: 'pointer' }}
                            onClick={() => setColorPickerOpen(!colorPickerOpen)}
                        />
                        {colorPickerOpen && (
                            <CmykColorPicker 
                                color={color} 
                                onChange={newColor => update({ [colorKey]: newColor.toUpperCase() })} 
                                onClose={() => setColorPickerOpen(false)} 
                            />
                        )}
                        <select 
                            className="bt-toolbar-select font-family-select"
                            value={el.fontFamily || 'Arial'}
                            onChange={(e) => update({ fontFamily: e.target.value })}
                        >
                            {FONTS.map(f => (
                                <option key={f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>
                        <select 
                            className="bt-toolbar-select font-size-select"
                            value={Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(2))}
                            onChange={(e) => update({ fontSize: unitToPx(Number(e.target.value), 'pt') })}
                        >
                            <option value={Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(2))} style={{ display: 'none' }}>
                                {Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(2))}
                            </option>
                            {POINT_SIZES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bt-field-row mt-1" style={{ gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#666' }}>Transparency:</span>
                        <input 
                            type="range" 
                            min="0" max="100" 
                            style={{ width: 60 }}
                            value={Math.round((1 - opacity) * 100)} 
                            onChange={e => update({ [opacityKey]: 1 - Number(e.target.value) / 100 })}
                        />
                        <span className="unit" style={{ width: 25, fontSize: 10 }}>{Math.round((1 - opacity) * 100)}%</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bt-dialog-overlay" onClick={onClose}>
            <div className="bt-dialog text-props" onClick={e => e.stopPropagation()}>
                <div className="bt-dialog-header">
                    <span className="bt-dialog-title">Text Properties</span>
                    <button className="bt-dialog-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="bt-dialog-body">
                    {/* Sidebar */}
                    <div className="bt-dialog-sidebar">
                        <div className="bt-sidebar-tree">
                            <div className="bt-tree-item root">
                                <span>A Text 1</span>
                            </div>
                            <div className={`bt-tree-item indent ${activeTab === 'font' ? 'active' : ''}`} onClick={() => setActiveTab('font')}>
                                <span className="bt-tree-icon">🔡</span> <span>Font</span>
                            </div>
                            <div className={`bt-tree-item indent ${activeTab === 'format' ? 'active' : ''}`} onClick={() => setActiveTab('format')}>
                                <span className="bt-tree-icon">📄</span> <span>Text Format</span>
                            </div>
                            <div className={`bt-tree-item indent ${activeTab === 'border' ? 'active' : ''}`} onClick={() => setActiveTab('border')}>
                                <span className="bt-tree-icon">⬜</span> <span>Border</span>
                            </div>
                            <div className={`bt-tree-item indent ${activeTab === 'position' ? 'active' : ''}`} onClick={() => setActiveTab('position')}>
                                <span className="bt-tree-icon">📍</span> <span>Position</span>
                            </div>
                            <div className={`bt-tree-item indent ${activeTab === 'source' ? 'active' : ''}`} onClick={() => setActiveTab('source')}>
                                <span className="bt-tree-icon">💾</span> <span>Enter Text</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="bt-dialog-content">
                        {activeTab === 'font' && (
                            <div className="bt-scroll-area">
                                <div className="bt-font-grid">
                                    <div className="bt-font-col" style={{ width: 220 }}>
                                        <label className="bt-label-sm">Typeface:</label>
                                        <input 
                                            type="text" 
                                            className="bt-win-input w-full mb-1" 
                                            value={fontSearch} 
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFontSearch(val);
                                                // auto-select if exact match
                                                const match = FONTS.find(f => f.name.toLowerCase() === val.toLowerCase());
                                                if (match) update({ fontFamily: match.name });
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="Search fonts..."
                                        />
                                        <div className="bt-list-box" style={{ height: 200 }}>
                                            {FONTS.filter(f => !fontSearch || f.name.toLowerCase().includes(fontSearch.toLowerCase())).map(f => (
                                                <div key={f.name} className={`bt-list-item bt-font-item ${el.fontFamily === f.name ? 'active' : ''}`} onClick={() => { update({ fontFamily: f.name }); setFontSearch(f.name); }}>
                                                    <span className="bt-font-icon">{f.type}</span>
                                                    <span className="bt-font-name" style={{ fontFamily: f.name }}>{f.name}</span>
                                                    {f.sub && <span className="bt-font-sub">{f.sub}</span>}
                                                    {f.sample && <span className="bt-font-preview" style={{ fontFamily: f.name }}>{f.sample}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bt-font-col w-32">
                                        <label className="bt-label-sm">Font Style:</label>
                                        <input type="text" className="bt-win-input w-full mb-1" value={el.fontWeight === 'bold' ? (el.fontStyle === 'italic' ? 'Bold Italic' : 'Bold') : (el.fontStyle === 'italic' ? 'Italic' : 'Regular')} readOnly />
                                        <div className="bt-list-box" style={{ height: 200 }}>
                                            {FONT_STYLES.map(s => (
                                                <div key={s} className={`bt-list-item ${ (el.fontWeight === 'bold' && s.includes('Bold')) || (el.fontStyle === 'italic' && s.includes('Italic')) || (el.fontWeight !== 'bold' && el.fontStyle !== 'italic' && s === 'Regular') ? 'active' : '' }`}
                                                    onClick={() => update({ fontWeight: s.includes('Bold') ? 'bold' : 'normal', fontStyle: s.includes('Italic') ? 'italic' : 'normal' })}>
                                                    {s}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bt-font-col w-20">
                                        <label className="bt-label-sm">Point Size:</label>
                                        <NumericInput 
                                            className="bt-win-input w-full mb-1" 
                                            value={pxToUnit(el.fontSize || 16, 'pt')} 
                                            onChange={v => update({ fontSize: unitToPx(v, 'pt') })}
                                            min={0}
                                            max={1000}
                                        />
                                        <div className="bt-list-box" style={{ height: 200 }}>
                                            {POINT_SIZES.map(s => (
                                                <div key={s} className={`bt-list-item ${Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(2)) === s ? 'active' : ''}`} onClick={() => update({ fontSize: unitToPx(s, 'pt') })}>
                                                    {s}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                <fieldset className="bt-fieldset mt-4">
                                    <legend>Style</legend>
                                    <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="underline" checked={el.underline} onChange={e => update({ underline: e.target.checked })} />
                                            <label htmlFor="underline" className="bt-label-sm">Underline</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id="strike" checked={el.strikethrough} onChange={e => update({ strikethrough: e.target.checked })} />
                                            <label htmlFor="strike" className="bt-label-sm">Strikethrough</label>
                                        </div>
                                    </div>
                                    {renderColorInput('Foreground', 'fill', 'opacity')}
                                </fieldset>
                            </div>
                        )}

                        {activeTab === 'format' && (
                            <div className="bt-scroll-area">
                                <div className="flex flex-col gap-4">
                                    <div className="bt-sub-tabs mb-3">
                                        {['Style', 'Underline', 'Strikethrough', 'Outline', 'Width', 'Advanced'].map(tab => (
                                            <div key={tab} className={`bt-sub-tab ${tab === 'Style' ? 'active' : ''}`}>{tab}</div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="bt-field-row">
                                                <input type="checkbox" id="white-black" style={{ width: 'auto', margin: 0 }} />
                                                <label htmlFor="white-black" style={{ width: 'auto', marginLeft: 8 }}>White on black</label>
                                            </div>
                                            <div className="bt-field-row">
                                                <label style={{ width: 110 }}>Foreground color:</label>
                                                <div className="bt-win-input flex items-center gap-1" style={{ width: 100 }}>
                                                    <div style={{ width: 14, height: 14, background: el.fill || '#000' }} />
                                                    <select 
                                                        style={{ border: 'none', background: 'transparent', width: '100%', fontSize: 10 }}
                                                        value={el.fill}
                                                        onChange={e => update({ fill: e.target.value })}
                                                    >
                                                        <option value="#000000">Black</option>
                                                        <option value="#ffffff">White</option>
                                                        <option value="#ff0000">Red</option>
                                                        <option value="#0000ff">Blue</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="bt-field-row">
                                                <label style={{ width: 110 }}>Background color:</label>
                                                <select className="bt-win-input" style={{ width: 100 }} defaultValue="none">
                                                    <option value="none">None</option>
                                                    <option value="#ffffff">White</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="bt-field-row">
                                                <input type="checkbox" id="subscript" style={{ width: 'auto', margin: 0 }} />
                                                <label htmlFor="subscript" style={{ width: 'auto', marginLeft: 8 }}>Subscript</label>
                                            </div>
                                            <div className="bt-field-row">
                                                <input type="checkbox" id="superscript" style={{ width: 'auto', margin: 0 }} />
                                                <label htmlFor="superscript" style={{ width: 'auto', marginLeft: 8 }}>Superscript</label>
                                            </div>
                                            <div className="bt-field-row">
                                                <input type="checkbox" id="small-caps" style={{ width: 'auto', margin: 0 }} />
                                                <label htmlFor="small-caps" style={{ width: 'auto', marginLeft: 8 }}>Small caps</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-6 text-[10.5px] text-[#666] italic border-t pt-4">
                                        This is an OpenType font. This same font will be used on both your printer and your screen.
                                    </div>
                                    <div className="bt-preview-box mt-4">
                                        <div className="bt-label-sm mb-2">Sample</div>
                                        <div className="bt-sample-text" style={{ 
                                            fontFamily: el.fontFamily, 
                                            fontSize: 24, 
                                            textAlign: el.textAlign,
                                            color: el.fill,
                                            fontWeight: el.fontWeight,
                                            fontStyle: el.fontStyle,
                                            textDecoration: el.underline ? 'underline' : 'none'
                                        }}>
                                            Sample Text
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'position' && (
                            <div className="bt-scroll-area">
                                <fieldset className="bt-fieldset">
                                    <legend>Position</legend>
                                    <div className="bt-field-row">
                                        <label>X:</label>
                                        <NumericInput 
                                            value={pxToUnit(el.x || 0, measurementUnit)}
                                            onChange={v => update({ x: unitToPx(v, measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Y:</label>
                                        <NumericInput 
                                            value={pxToUnit(el.y || 0, measurementUnit)}
                                            onChange={v => update({ y: unitToPx(v, measurementUnit) })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                    <div className="bt-field-row">
                                        <label>Width:</label>
                                        <NumericInput 
                                            value={pxToUnit(el.width || 200, measurementUnit)}
                                            onChange={v => update({ width: unitToPx(v, measurementUnit), scaleX: 1 })}
                                        />
                                        <span className="unit">{measurementUnit}</span>
                                    </div>
                                </fieldset>
                                <fieldset className="bt-fieldset">
                                    <legend>Rotation</legend>
                                    <div className="bt-field-row">
                                        <label>Angle:</label>
                                        <NumericInput 
                                            style={{ width: 60 }}
                                            value={el.rotation || 0}
                                            onChange={v => update({ rotation: v })}
                                            min={-360}
                                            max={360}
                                        />
                                        <span className="unit">°</span>
                                    </div>
                                </fieldset>
                                <div className="bt-field-row mt-4" style={{ marginLeft: 110 }}>
                                    <input type="checkbox" id="lock-obj" checked={el.locked} onChange={e => update({ locked: e.target.checked })} />
                                    <label htmlFor="lock-obj" className="bt-label-sm ml-2">Lock object</label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'source' && (
                            <div className="bt-scroll-area">
                                <fieldset className="bt-fieldset">
                                    <legend>Enter Text</legend>
                                    <div className="bt-field-row" style={{ alignItems: 'flex-start' }}>
                                        <label>Text Value:</label>
                                        <textarea 
                                            className="bt-win-input w-full" 
                                            style={{ height: 100, padding: 8 }}
                                            value={el.text || ''}
                                            onChange={e => update({ text: e.target.value })}
                                        />
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
