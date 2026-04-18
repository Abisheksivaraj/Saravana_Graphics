import React, { useState, useEffect } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Underline, Type, Zap, Paintbrush, Pipette, MousePointer2,
  Lock, Unlock, Eye, EyeOff, Trash2,
  Maximize, Minimize, Copy, Move,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown
} from 'lucide-react';
import './PropertyBar.css';
import CmykColorPicker from './CmykColorPicker';
import NumericInput from './NumericInput';

const FONTS = [
  'Arial', 'Calibri', 'Times New Roman', 'Courier New',
  'Georgia', 'Verdana', 'Impact', 'Trebuchet MS',
  'ZEBRA Swiss Unicode', 'Comic Sans MS', 'Inter', 'Outfit',
  'Rupee Forbidan', 'OCR-A', 'OCR-B', 'OCR A Extended', 'OCR-B 10 BT'
];

const SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

function PropInput({ value, onChange, style = {}, title, min, max }) {
  return (
    <NumericInput
      value={value}
      onChange={onChange}
      style={style}
      title={title}
      min={min}
      max={max}
      className="bt-prop-input"
    />
  );
}

function TypeableSelect({ value, options, onChange, style = {}, className, fallback = '', type = 'text', width }) {
  const [local, setLocal] = useState(String(value || fallback));
  const [open, setOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    setLocal(String(value || fallback));
    setIsFiltering(false);
  }, [value, fallback]);

  useEffect(() => {
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
    <div ref={ref} style={{ position: 'relative', display: 'flex', width: width || 'auto' }}>
      <input
        type={type === 'number' ? 'text' : type}
        className={className}
        style={{ ...style, flex: 1, margin: 0, width: '100%' }}
        value={local}
        onFocus={(e) => { e.target.select(); setOpen(true); setIsFiltering(false); }}
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
           // We timeout the blur so click on dropdown item fires first.
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

function ColorBtn({ icon, color, onChange, title }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bt-color-btn-wrap" title={title} style={{ position: 'relative' }}>
      <button 
        className="bt-color-btn" 
        onClick={() => setOpen(!open)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          cursor: 'pointer', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          padding: '2px 4px'
        }}
      >
        <span className="bt-color-preview-icon">{icon}</span>
        <div className="bt-color-underline" style={{ 
          backgroundColor: color && color !== 'transparent' ? color : '#000', 
          width: '12px', 
          height: '3px', 
          marginTop: '2px' 
        }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000 }}>
          <CmykColorPicker
            color={color}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function PropertyBar() {
  const {
    elements, selectedIds, updateElementAndSave,
    canvasWidth, canvasHeight, backgroundColor, setBackgroundColor,
    matchSize, alignElements, duplicateElement, deleteElement,
    bringToFront, sendToBack, bringForward, sendBackward, distributeElements
  } = useDesignStore();
  const { measurementUnit } = useUIStore();

  const selectedEl = selectedIds.length > 0 ? elements.find(e => e.id === selectedIds[0]) : null;
  const update = (updates) => selectedIds.forEach(id => updateElementAndSave(id, updates));
  const fmt = (v) => Number(Number(v).toFixed(2));

  return (
    <div className="bt-prop-bar">
      {/* Group 1: Font & Size */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <TypeableSelect
          options={FONTS}
          className="bt-font-select"
          style={{ cursor: 'text' }}
          width={140}
          value={selectedEl?.fontFamily}
          fallback="Arial"
          onChange={v => update({ fontFamily: v })}
        />

        <TypeableSelect
          options={SIZES}
          type="number"
          className="bt-prop-input"
          style={{ cursor: 'text', marginLeft: 2 }}
          width={50}
          value={selectedEl ? Number(pxToUnit(selectedEl.fontSize || 16, 'pt').toFixed(2)) : 12}
          fallback={12}
          onChange={v => update({ fontSize: unitToPx(v, 'pt') })}
        />
        <span className="bt-prop-label" style={{ marginLeft: 4 }}>pt</span>
      </div>

      {/* Group 2: Styles (B, I, U, W) */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <button
          className={`bt-prop-btn${selectedEl?.fontWeight === 'bold' ? ' active' : ''}`}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
          onClick={() => update({ fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' })}
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.fontStyle === 'italic' ? ' active' : ''}`}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
          onClick={() => update({ fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })}
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.underline ? ' active' : ''}`}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
          onClick={() => update({ underline: !selectedEl.underline })}
          title="Underline"
        >
          <Underline size={18} />
        </button>
      </div>

      {/* Group 3: Color & Tools */}
      <div className="bt-toolbar-group">
        {selectedEl?.type === 'barcode' ? (
          <BarcodeFormatSelect 
            value={selectedEl.barcodeFormat || 'CODE128'} 
            onChange={v => update({ barcodeFormat: v })} 
          />
        ) : (
          <>
            <ColorBtn icon={<span style={{ fontWeight: 'bold' }}>A</span>} color={selectedEl?.fill || '#000000'} onChange={v => update({ fill: v })} title="Text Color" />
            <button className="bt-prop-btn" title="Format Painter">
              <Paintbrush size={18} color="#0078d7" />
            </button>
          </>
        )}
      </div>

      {/* Group 4: Alignment */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'left' || !selectedEl?.textAlign ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'left' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignLeft size={18} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'center' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'center' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignCenter size={18} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'right' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'right' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignRight size={18} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'justify' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'justify' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignJustify size={18} />
        </button>

        {selectedEl?.type === 'text' && (
          <>
            <div className="bt-prop-sep" style={{ height: 20 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: '#555', fontFamily: 'Segoe UI' }} title="Letter Spacing (Tighten/Widen)">↔️</span>
              <NumericInput 
                className="bt-prop-input" 
                style={{ width: 44, fontSize: 11 }}
                value={selectedEl.letterSpacing || 0} 
                onChange={v => update({ letterSpacing: v })}
                min={-50} max={100}
                title="Letter Spacing"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4 }}>
              <span style={{ fontSize: 11, color: '#555', fontFamily: 'Segoe UI' }} title="Line Height">↕️</span>
              <NumericInput 
                className="bt-prop-input" 
                style={{ width: 44, fontSize: 11 }}
                value={selectedEl.lineHeight || 1.2} 
                onChange={v => update({ lineHeight: v })}
                min={0.5} max={5}
                title="Line Height"
              />
            </div>
          </>
        )}
      </div>

      {/* Group 5: Fill & Line */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ColorBtn icon="🪣" color={selectedEl?.fill || 'transparent'} onChange={v => update({ fill: v })} title="Fill Color" />
        <ColorBtn icon="🖋️" color={selectedEl?.stroke || '#000000'} onChange={v => update({ stroke: v })} title="Stroke Color" />
        <select
          className="bt-prop-input"
          style={{ width: 44, marginLeft: 2 }}
          value={Math.round(pxToUnit(selectedEl?.strokeWidth || 0, 'pt'))}
          onChange={e => update({ strokeWidth: unitToPx(Number(e.target.value), 'pt') })}
          disabled={!selectedEl}
        >
          {[0, 0.5, 1, 1.5, 2, 3, 4, 6, 8].map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <span className="bt-prop-label">pt</span>
        <select
          className="bt-prop-input"
          style={{ width: 55, marginLeft: 2 }}
          value={selectedEl?.dash?.length > 0 ? (selectedEl.dash[0] > 5 ? 'dashed' : 'dotted') : 'solid'}
          onChange={e => {
            const val = e.target.value;
            if (val === 'solid') update({ dash: [] });
            else if (val === 'dashed') update({ dash: [10, 5] });
            else if (val === 'dotted') update({ dash: [2, 2] });
          }}
          disabled={!selectedEl}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
        <div className="bt-prop-sep" />
        <span className="bt-prop-label">Op:</span>
        <input
          type="number"
          className="bt-prop-input"
          style={{ width: 40 }}
          value={Math.round((selectedEl?.opacity || 1) * 100)}
          min={0}
          max={100}
          onChange={e => update({ opacity: Number(e.target.value) / 100 })}
          disabled={!selectedEl}
          title="Opacity %"
        />
      </div>

      {/* Group 6: Position & Size */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        {selectedEl ? (
          <>
            <span className="bt-prop-label">X:</span>
            <PropInput
              value={fmt(pxToUnit(selectedEl.x || 0, measurementUnit))}
              onChange={v => update({ x: unitToPx(v, measurementUnit) })}
              style={{ width: 45 }}
            />
            <span className="bt-prop-label">Y:</span>
            <PropInput
              value={fmt(pxToUnit(selectedEl.y || 0, measurementUnit))}
              onChange={v => update({ y: unitToPx(v, measurementUnit) })}
              style={{ width: 45 }}
            />
            <span className="bt-prop-label">W:</span>
            <PropInput
              value={fmt(pxToUnit(selectedEl.width || 0, measurementUnit))}
              onChange={v => update({ width: unitToPx(v, measurementUnit) })}
              style={{ width: 45 }}
              disabled={selectedEl.type === 'line'}
            />
            <span className="bt-prop-label">H:</span>
            <PropInput
              value={fmt(pxToUnit(selectedEl.height || 0, measurementUnit))}
              onChange={v => update({ height: unitToPx(v, measurementUnit) })}
              style={{ width: 45 }}
              disabled={selectedEl.type === 'line'}
            />
            <span className="bt-prop-label">R:</span>
            <PropInput
              value={fmt(selectedEl.rotation || 0)}
              onChange={v => update({ rotation: v })}
              style={{ width: 40 }}
              min={-360}
              max={360}
            />
          </>
        ) : (
          <>
            <span className="bt-prop-label">Canvas:</span>
            <span className="bt-prop-value">{Math.round(canvasWidth)} × {Math.round(canvasHeight)} px</span>
          </>
        )}
      </div>

      {/* Group 9: Arrange Layering */}
      {selectedIds.length > 0 && (
        <div className="bt-toolbar-group">
          <div className="bt-toolbar-handle" />
          <button className="bt-prop-btn" onClick={() => selectedIds.forEach(id => bringToFront(id))} title="Bring to Front">
            <ChevronsUp size={18} />
          </button>
          <button className="bt-prop-btn" onClick={() => selectedIds.forEach(id => bringForward(id))} title="Bring Forward">
            <ChevronUp size={18} />
          </button>
          <button className="bt-prop-btn" onClick={() => selectedIds.forEach(id => sendBackward(id))} title="Send Backward">
            <ChevronDown size={18} />
          </button>
          <button className="bt-prop-btn" onClick={() => selectedIds.forEach(id => sendToBack(id))} title="Send to Back">
            <ChevronsDown size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function BarcodeFormatSelect({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const IconBarcode1D = () => (
     <svg width="16" height="12" viewBox="0 0 16 12" fill="none" style={{ marginRight: 6 }}>
        <rect x="0" y="0" width="2" height="12" fill="#333" />
        <rect x="3" y="0" width="1" height="12" fill="#333" />
        <rect x="5" y="0" width="3" height="12" fill="#333" />
        <rect x="9" y="0" width="1" height="12" fill="#333" />
        <rect x="11" y="0" width="2" height="12" fill="#333" />
        <rect x="14" y="0" width="2" height="12" fill="#333" />
     </svg>
  );

  const IconBarcode2D = () => (
     <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 10, marginLeft: 2 }}>
        <rect x="0" y="0" width="5" height="5" fill="#333" />
        <rect x="7" y="0" width="5" height="5" fill="#333" />
        <rect x="0" y="7" width="5" height="5" fill="#333" />
        <rect x="7" y="7" width="2" height="2" fill="#333" />
        <rect x="10" y="7" width="2" height="2" fill="#333" />
        <rect x="7" y="10" width="2" height="2" fill="#333" />
        <rect x="10" y="10" width="2" height="2" fill="#333" />
        <rect x="1" y="1" width="3" height="3" fill="#fff" />
        <rect x="8" y="1" width="3" height="3" fill="#fff" />
        <rect x="1" y="8" width="3" height="3" fill="#fff" />
        <rect x="2" y="2" width="1" height="1" fill="#333" />
        <rect x="9" y="2" width="1" height="1" fill="#333" />
        <rect x="2" y="9" width="1" height="1" fill="#333" />
     </svg>
  );

  const formats1D = [
     { id: 'CODE128', label: 'Code 128' },
     { id: 'EAN13', label: 'EAN-13' },
     { id: 'UPC', label: 'UPC-A' },
     { id: 'CODE39', label: 'Code 39' },
     { id: 'EAN8', label: 'EAN-8' },
     { id: 'CODE93', label: 'Code 93' },
     { id: 'ITF', label: 'ITF' }
  ];

  const currentLabel = formats1D.find(f => f.id === value)?.label || value;

  return (
    <div ref={ref} style={{ position: 'relative', width: 140 }}>
      <button 
         className="bt-font-select" 
         style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px', height: 24, cursor: 'pointer', textAlign: 'left', background: '#fff' }}
         onClick={() => setOpen(!open)}
      >
         <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
             <IconBarcode1D />
             <span style={{ fontSize: 12, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{currentLabel}</span>
         </div>
         <svg width="8" height="6" viewBox="0 0 10 5" fill="none"><path d="M0 0L5 5L10 0H0Z" fill="#333"/></svg>
      </button>
      
      {open && (
         <div style={{
            position: 'absolute', top: '100%', left: 0, width: 220,
            background: '#f9f9f9', border: '1px solid #ccc', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999, maxHeight: 400, overflowY: 'auto', paddingTop: 4, paddingBottom: 4
         }}>
             <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 'bold', color: '#666', background: '#e1e1e1' }}>General Purpose Barcodes</div>
             {formats1D.map(f => (
                 <div 
                    key={f.id}
                    style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, background: value === f.id ? '#e1f0fa' : 'transparent', justifyContent: 'space-between' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddefe9'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = value === f.id ? '#e1f0fa' : 'transparent'}
                    onClick={() => { onChange(f.id); setOpen(false); }}
                 >
                     <div style={{ display: 'flex', alignItems: 'center' }}>
                         <IconBarcode1D />
                     </div>
                     <div style={{ flex: 1, textAlign: 'right', paddingRight: 4, fontFamily: 'Segoe UI, Arial' }}>
                         {f.label}
                     </div>
                 </div>
             ))}
             
             <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 'bold', color: '#666', background: '#e1e1e1', marginTop: 4 }}>2D Symbologies</div>
             {/* Read only 2D Symbologies to match UI screenshot exactly, warns users to use Toolbar */}
             <div 
                 style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, justifyContent: 'space-between' }}
                 onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddefe9'}
                 onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                 onClick={() => { setOpen(false); alert('To add a QR Code, please use the QR Code tool from the left toolbar.'); }}
             >
                 <div style={{ display: 'flex', alignItems: 'center' }}>
                     <IconBarcode2D />
                 </div>
                 <div style={{ flex: 1, textAlign: 'right', paddingRight: 4, fontFamily: 'Segoe UI, Arial' }}>
                     QR Code
                 </div>
             </div>
             <div 
                 style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, justifyContent: 'space-between' }}
                 onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddefe9'}
                 onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                 onClick={() => { setOpen(false); alert('Data Matrix is not currently supported in this version.'); }}
             >
                 <div style={{ display: 'flex', alignItems: 'center' }}>
                     <IconBarcode2D />
                 </div>
                 <div style={{ flex: 1, textAlign: 'right', paddingRight: 4, fontFamily: 'Segoe UI, Arial' }}>
                     Data Matrix
                 </div>
             </div>
             <div 
                 style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, justifyContent: 'space-between' }}
                 onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddefe9'}
                 onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                 onClick={() => { setOpen(false); alert('PDF417 is not currently supported in this version.'); }}
             >
                 <div style={{ display: 'flex', alignItems: 'center' }}>
                     <IconBarcode2D />
                 </div>
                 <div style={{ flex: 1, textAlign: 'right', paddingRight: 4, fontFamily: 'Segoe UI, Arial' }}>
                     PDF417
                 </div>
             </div>
         </div>
      )}
    </div>
  );
}
