import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx, hexToCmyk, cmykToHex } from '../store/uiStore';
import './BarcodePropertiesDialog.css';
import CmykColorPicker from './CmykColorPicker';

const CATEGORIES = [
    { id: 'symbology', label: 'Symbology and Size', icon: '📊' },
    { id: 'readable', label: 'Human Readable', icon: '123' },
    { id: 'font', label: 'Font', icon: 'A' },
    { id: 'sources', label: 'Enter Value', icon: '💾' }
];

const FONTS = ['Arial', 'Calibri', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Inter', 'Outfit', 'OCR-A', 'OCR-B', 'OCR A Extended', 'OCR-B 10 BT'];
const BARCODE_FORMATS = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14'];

function TypeableSelect({ value, options, onChange, style = {}, className, fallback = '', type = 'text', width }) {
  const [local, setLocal] = useState(String(value || fallback));
  const [open, setOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    setLocal(String(value || fallback));
    setIsFiltering(false);
  }, [value, fallback]);

  React.useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const commit = (val) => {
    setLocal(String(val));
    setOpen(false);
    if (type === 'number') {
      const n = parseFloat(val);
      if (!isNaN(n)) onChange(n);
    } else {
      onChange(val);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', width: width || '100%' }}>
      <input
        type={type === 'number' ? 'text' : type}
        className={className}
        style={{ ...style, flex: 1, margin: 0, width: '100%' }}
        value={local}
        onFocus={() => { setOpen(true); setIsFiltering(false); }}
        onClick={() => { setOpen(true); setIsFiltering(false); }}
        onChange={(e) => {
          setLocal(e.target.value);
          setOpen(true);
          setIsFiltering(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(local);
          }
        }}
        onBlur={() => {
           setTimeout(() => {
             if (local.trim() === '' || (type==='number' && isNaN(parseFloat(local)))) {
                setLocal(String(value || fallback));
                onChange(value || fallback);
             } else {
                commit(local);
             }
           }, 150);
        }}
      />
      <button 
        style={{ width: 16, border: '1px solid #a0b8d8', borderLeft: 'none', background: '#e1f0fa', cursor: 'pointer', padding: 0 }}
        onClick={() => { setOpen(!open); setIsFiltering(false); }}
        tabIndex={-1}
      >
        <svg width="8" height="6" viewBox="0 0 10 5" fill="none" style={{ margin: 'auto' }}>
          <path d="M0 0L5 5L10 0H0Z" fill="#333" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: '100%', 
          maxHeight: 200, overflowY: 'auto', background: '#fff', border: '1px solid #a0b8d8', 
          zIndex: 9999, boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          {options.filter(o => !isFiltering || String(o).toLowerCase().includes(local.toLowerCase())).map(opt => (
            <div 
              key={opt}
              style={{ padding: '2px 6px', fontSize: 12, cursor: 'pointer', fontFamily: type==='text' ? opt : 'inherit' }}
              onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0078d7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BarcodePropertiesDialog({ elementId, onClose }) {
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
                                    <TypeableSelect
                                        options={FONTS}
                                        className="bt-win-input"
                                        style={{ width: '100%' }}
                                        value={el.fontFamily} 
                                        fallback="Arial"
                                        onChange={v => update({ fontFamily: v })}
                                    />
                                </div>
                                <div className="bt-field-row">
                                    <label>Size:</label>
                                    <TypeableSelect 
                                        options={[6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72]}
                                        type="number"
                                        className="bt-win-input"
                                        style={{ width: '100%' }}
                                        width={60}
                                        value={Number(pxToUnit(el.fontSize || 16, 'pt').toFixed(1))}
                                        fallback={12}
                                        onChange={v => update({ fontSize: unitToPx(v, 'pt') })}
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
                                        onChange={e => {
                                            const val = e.target.value;
                                            const updates = { barcodeValue: val };
                                            if (val.length === 13) updates.barcodeFormat = 'EAN13';
                                            else if (val.length === 8) updates.barcodeFormat = 'EAN8';
                                            update(updates);
                                        }}
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
                    <button className="bt-win-btn primary" onClick={onClose}>Apply</button>
                    <button className="bt-win-btn" onClick={onClose}>Close</button>
                    <button className="bt-win-btn" disabled>Help</button>
                </div>
            </div>
        </div>
    );
}
