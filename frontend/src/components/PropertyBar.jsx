import React, { useState, useEffect } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import {
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Underline, Type, Zap, Paintbrush, Pipette, MousePointer2,
  Lock, Unlock, Eye, EyeOff, Trash2,
  Maximize, Minimize, Copy, Move,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd
} from 'lucide-react';
import './PropertyBar.css';

const FONTS = [
  'Arial', 'Calibri', 'Times New Roman', 'Courier New',
  'Georgia', 'Verdana', 'Impact', 'Trebuchet MS',
  'ZEBRA Swiss Unicode', 'Comic Sans MS', 'Inter', 'Outfit',
  'Rupee Forbidan',
];

const SIZES = [6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

function PropInput({ value, onChange, style = {}, title, min, max }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => setLocal(String(value)), [value]);

  return (
    <input
      type="number"
      className="bt-prop-input"
      value={local}
      min={min}
      max={max}
      title={title}
      style={style}
      onChange={(e) => {
        setLocal(e.target.value);
        const n = parseFloat(e.target.value);
        if (!isNaN(n)) onChange(n);
      }}
      onBlur={() => setLocal(String(value))}
    />
  );
}

function ColorBtn({ icon, color, onChange, title }) {
  return (
    <div className="bt-color-btn-wrap" title={title}>
      <input
        type="color"
        value={color && color !== 'transparent' ? color : '#000000'}
        onChange={e => onChange(e.target.value)}
        className="bt-color-input"
      />
      <span className="bt-color-preview-icon">{icon}</span>
      <div className="bt-color-underline" style={{ backgroundColor: color || '#000' }} />
    </div>
  );
}

export default function PropertyBar() {
  const {
    elements, selectedIds, updateElementAndSave,
    canvasWidth, canvasHeight, backgroundColor, setBackgroundColor,
    matchSize, alignElements, duplicateElement, deleteElement
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
        <select
          className="bt-font-select"
          value={selectedEl?.fontFamily || 'Arial'}
          onChange={e => update({ fontFamily: e.target.value })}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
        >
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          className="bt-prop-input"
          style={{ width: 48, marginLeft: 2 }}
          value={selectedEl ? Math.round(pxToUnit(selectedEl.fontSize || 16, 'pt')) : 12}
          onChange={e => update({ fontSize: unitToPx(Number(e.target.value), 'pt') })}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
        >
          {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
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
          <Bold size={14} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.fontStyle === 'italic' ? ' active' : ''}`}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
          onClick={() => update({ fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })}
          title="Italic"
        >
          <Italic size={14} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.underline ? ' active' : ''}`}
          disabled={!selectedEl || (selectedEl.type !== 'text' && selectedEl.type !== 'barcode')}
          onClick={() => update({ underline: !selectedEl.underline })}
          title="Underline"
        >
          <Underline size={14} />
        </button>
        <button className="bt-prop-btn" title="Word Processor" disabled={!selectedEl}>
          <span style={{ fontSize: 13, fontWeight: 900, fontFamily: 'serif' }}>W</span>
        </button>
      </div>

      {/* Group 3: Color & Tools */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        {selectedEl?.type === 'barcode' ? (
          <select
            className="bt-font-select"
            style={{ minWidth: 100 }}
            value={selectedEl.barcodeFormat || 'CODE128'}
            onChange={e => update({ barcodeFormat: e.target.value })}
            title="Barcode Type"
          >
            <option value="CODE128">Code 128</option>
            <option value="EAN13">EAN-13</option>
            <option value="EAN8">EAN-8</option>
            <option value="CODE39">Code 39</option>
            <option value="CODE93">Code 93</option>
            <option value="UPC">UPC</option>
            <option value="ITF">ITF</option>
          </select>
        ) : (
          <>
            <ColorBtn icon="A" color={selectedEl?.fill || '#000000'} onChange={v => update({ fill: v })} title="Text Color" />
            <ColorBtn icon={<span style={{ transform: 'rotate(-45deg)', display: 'inline-block' }}>✎</span>} color="transparent" onChange={() => {}} title="Highlight" />
            <button className="bt-prop-btn" title="Format Painter">
              <Paintbrush size={14} color="#0078d7" />
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
          <AlignLeft size={14} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'center' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'center' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignCenter size={14} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'right' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'right' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignRight size={14} />
        </button>
        <button
          className={`bt-prop-btn${selectedEl?.textAlign === 'justify' ? ' active' : ''}`}
          onClick={() => update({ textAlign: 'justify' })}
          disabled={!selectedEl || selectedEl.type !== 'text'}
        >
          <AlignJustify size={14} />
        </button>
        <button className="bt-prop-btn" title="Distributed" disabled>
          <span style={{ transform: 'rotate(90deg)' }}><AlignJustify size={14} /></span>
        </button>
        <button className="bt-prop-btn" title="Arc Text" disabled>
          <span style={{ fontSize: 10 }}>ABC</span>
        </button>
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

      {/* Group 7: Content & Actions */}
      {selectedIds.length === 1 && selectedEl && (
        <div className="bt-toolbar-group">
          <div className="bt-toolbar-handle" />
          {selectedEl.type === 'text' && (
            <input
              className="bt-prop-input"
              style={{ width: 120, textAlign: 'left' }}
              value={selectedEl.text || ''}
              onChange={e => update({ text: e.target.value })}
              placeholder="Text content..."
              title="Text Content"
            />
          )}
          {selectedEl.type === 'barcode' && (
            <input
              className="bt-prop-input"
              style={{ width: 120, textAlign: 'left' }}
              value={selectedEl.barcodeValue || ''}
              onChange={e => update({ barcodeValue: e.target.value })}
              placeholder="Barcode value..."
              title="Barcode Value"
            />
          )}
          <div className="bt-prop-sep" />
          <button className={`bt-prop-btn${selectedEl.locked ? ' active' : ''}`} onClick={() => update({ locked: !selectedEl.locked })} title="Lock">
            {selectedEl.locked ? <Lock size={13} color="#e59324" /> : <Unlock size={13} />}
          </button>
          <button className="bt-prop-btn" onClick={() => updateElementAndSave(selectedEl.id, { visible: !selectedEl.visible })} title="Visibility">
            {selectedEl.visible !== false ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button className="bt-prop-btn" onClick={() => duplicateElement(selectedEl.id)} title="Duplicate">
            <Copy size={13} />
          </button>
          <button className="bt-prop-btn danger" onClick={() => deleteElement(selectedEl.id)} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      )}

      {/* Group 8: Multi-selection Tools */}
      {selectedIds.length > 1 && (
        <div className="bt-toolbar-group">
          <div className="bt-toolbar-handle" />
          <button className="bt-prop-btn" onClick={() => matchSize('width')} title="Match Width"><Maximize size={13} /></button>
          <button className="bt-prop-btn" onClick={() => matchSize('height')} title="Match Height"><Maximize size={13} style={{ transform: 'rotate(90deg)' }} /></button>
          <div className="bt-prop-sep" />
          <button className="bt-prop-btn" onClick={() => alignElements('left')} title="Align Left"><AlignLeft size={13} /></button>
          <button className="bt-prop-btn" onClick={() => alignElements('center')} title="Align Horizontal Center"><AlignCenter size={13} /></button>
          <button className="bt-prop-btn" onClick={() => alignElements('right')} title="Align Right"><AlignRight size={13} /></button>
          <div className="bt-prop-sep" />
          <button className="bt-prop-btn" onClick={() => alignElements('top')} title="Align Top"><AlignVerticalJustifyStart size={13} /></button>
          <button className="bt-prop-btn" onClick={() => alignElements('middle')} title="Align Vertical Middle"><AlignVerticalJustifyCenter size={13} /></button>
          <button className="bt-prop-btn" onClick={() => alignElements('bottom')} title="Align Bottom"><AlignVerticalJustifyEnd size={13} /></button>
          <div className="bt-prop-sep" />
          <button className="bt-prop-btn danger" onClick={() => deleteElement(selectedIds)} title="Delete Selected">
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
