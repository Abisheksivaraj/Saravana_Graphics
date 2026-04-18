import React, { useRef } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import {
  MousePointer2, Type, Square, Circle, Minus,
  BarChart2, QrCode, Image as ImageIcon, FileSpreadsheet,
  FilePlus, FolderOpen, Save, Printer, Eye,
  Scissors, Copy, Clipboard, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize2, Grid, Star, Pen, Eraser,
  Search, Monitor, Camera, Box, Zap,
  ChevronLeft, ChevronRight, ChevronDown,
  Lock, Unlock, EyeOff, Trash2, Maximize,
  AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd
} from 'lucide-react';
import VirtualShapeSelector from './VirtualShapeSelector';
import TextObjectSelector from './TextObjectSelector';
import BarcodeObjectSelector from './BarcodeObjectSelector';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './StandardToolbar.css';

const Sep = () => <div className="bt-tb-sep" />;

const ToolBtn = ({ icon, label, active, disabled, onClick, title, hasArrow }) => (
  <button
    className={`bt-tb-btn${active ? ' active' : ''}${hasArrow ? ' has-arrow' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title || label}
  >
    {icon}
    {hasArrow && <ChevronDown size={8} className="bt-tb-btn-arrow" />}
  </button>
);

const PremiumBarcodeIcon = ({ size = 20 }) => (
  <svg width={size} height={size + 8} viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Barcode Stripes */}
    <rect x="2" y="2" width="2" height="18" fill="black" />
    <rect x="5" y="2" width="1" height="18" fill="black" />
    <rect x="7" y="2" width="3" height="18" fill="black" />
    <rect x="11" y="2" width="1" height="18" fill="black" />
    <rect x="13" y="2" width="2" height="18" fill="black" />
    <rect x="16" y="2" width="1" height="18" fill="black" />
    <rect x="18" y="2" width="3" height="18" fill="black" />
    
    {/* "123" Text underneath */}
    <text x="50%" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill="indigo" fontFamily="Arial, sans-serif">123</text>
  </svg>
);

const PremiumTextIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 22H7.5L9.2 17H14.8L16.5 22H20L12 2ZM10.2 14L12 8.5L13.8 14H10.2Z" fill="black" />
  </svg>
);

const CustomShapesIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="9" cy="8" rx="7" ry="5" fill="#f0f0f0" stroke="#555" strokeWidth="1" />
    <path d="M4 20L9 11L14 20H4Z" fill="#e0e0e0" stroke="#555" strokeWidth="1" />
    <rect x="10" y="10" width="10" height="10" fill="#fff" stroke="#555" strokeWidth="1" />
  </svg>
);

export default function StandardToolbar({ onAction, onImageUpload, showGrid }) {
  const {
    undo, redo, historyIndex, history, zoom, setZoom,
    addElement, elements, selectedIds,
    updateElementAndSave, duplicateElement, deleteElement, matchSize, alignElements, distributeElements, straightenElements
  } = useDesignStore();
  const selectedEl = selectedIds.length > 0 ? elements.find(e => e.id === selectedIds[0]) : null;
  const { selectedTool, setSelectedTool } = useUIStore();
  const [showShapeSelector, setShowShapeSelector] = React.useState(false);
  const [showTextSelector, setShowTextSelector] = React.useState(false);
  const [showBarcodeSelector, setShowBarcodeSelector] = React.useState(false);
  const excelRef = useRef();
  const imageRef = useRef();
  const toolbarRef = useRef();

  // Click-outside logic to auto-close dropdowns
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setShowShapeSelector(false);
        setShowTextSelector(false);
        setShowBarcodeSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (tool) => selectedTool === tool;

  const toggleTextSelector = () => {
    setShowTextSelector(!showTextSelector);
    setShowShapeSelector(false);
    setShowBarcodeSelector(false);
  };

  const toggleShapeSelector = () => {
    setShowShapeSelector(!showShapeSelector);
    setShowTextSelector(false);
    setShowBarcodeSelector(false);
  };

  const toggleBarcodeSelector = () => {
    setShowBarcodeSelector(!showBarcodeSelector);
    setShowTextSelector(false);
    setShowShapeSelector(false);
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        if (data?.[0]) {
          useDesignStore.getState().setPreviewData(data[0]);
          toast.success(`Data Loaded: ${Object.keys(data[0]).length} columns`);
        } else {
          toast.error('No data found');
        }
      } catch { toast.error('Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  return (
    <div className="bt-standard-toolbar" ref={toolbarRef}>
      {/* File Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn icon={<FilePlus size={20} color="#0078d7" />} onClick={() => onAction?.('new')} title="New" />
        <ToolBtn icon={<Printer size={20} color="#444" />} onClick={() => onAction?.('print')} title="Print" />
      </div>

      {/* Edit Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn icon={<Scissors size={20} color="#c00" />} onClick={() => onAction?.('cut')} title="Cut" />
        <ToolBtn icon={<Copy size={20} color="#555" />} onClick={() => onAction?.('copy')} title="Copy" />
        <ToolBtn icon={<Clipboard size={20} color="#855" />} onClick={() => onAction?.('paste')} title="Paste" />
      </div>

      {/* History Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<Undo2 size={20} color="#333" />}
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo"
        />
        <ToolBtn
          icon={<Redo2 size={20} color="#333" />}
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo"
        />
      </div>

      {/* Creation Tools Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<MousePointer2 size={20} color="#ff9900" />}
          active={isActive('pick')}
          onClick={() => setSelectedTool('pick')}
          title="Selection Tool"
        />
        <div className="bt-tb-dropdown-wrap" style={{ position: 'relative' }}>
          <ToolBtn
            icon={<PremiumTextIcon size={26} />}
            active={isActive('text')}
            onClick={() => setSelectedTool('text')}
            title="Text Tool"
            hasArrow={true}
          />
          <div className="bt-tb-btn-dropdown-trigger" onClick={() => toggleTextSelector()} />
          {showTextSelector && (
            <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 2000 }}>
              <TextObjectSelector onSelect={setSelectedTool} onClose={() => setShowTextSelector(false)} />
            </div>
          )}
        </div>
        
        <div className="bt-tb-dropdown-wrap" style={{ position: 'relative' }}>
          <ToolBtn
            icon={<PremiumBarcodeIcon size={24} />}
            active={selectedTool && selectedTool.startsWith('barcode')}
            onClick={() => setSelectedTool('barcode')}
            title="Barcode Tool"
            hasArrow={true}
          />
          <div className="bt-tb-btn-dropdown-trigger" onClick={() => toggleBarcodeSelector()} />
          {showBarcodeSelector && (
            <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 2000 }}>
              <BarcodeObjectSelector 
                onSelect={(tool) => { setSelectedTool(tool); setShowBarcodeSelector(false); }} 
                onClose={() => setShowBarcodeSelector(false)} 
              />
            </div>
          )}
        </div>

        <div className="bt-tb-dropdown-wrap" style={{ position: 'relative' }}>
          <ToolBtn
            icon={<CustomShapesIcon size={24} />}
            active={['draw-rect', 'draw-rect-rounded', 'draw-circle', 'draw-star', 'draw-triangle'].some(t => isActive(t))}
            onClick={() => setSelectedTool('draw-rect')}
            title="Shape Tools"
          />
          <button className="bt-tb-mini-btn" onClick={() => toggleShapeSelector()}><ChevronDown size={10} /></button>
          {showShapeSelector && (
             <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 2000 }}>
               <VirtualShapeSelector onSelect={setSelectedTool} onClose={() => setShowShapeSelector(false)} />
             </div>
          )}
        </div>

        <ToolBtn
          icon={<Minus size={22} color="#000" />}
          active={isActive('draw-line')}
          onClick={() => setSelectedTool('draw-line')}
          title="Line Tool"
        />
        <ToolBtn
          icon={<ImageIcon size={22} color="#c44" />}
          onClick={() => imageRef.current?.click()}
          title="Insert Image"
        />
      </div>

      {/* View/Zoom Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<ZoomIn size={20} color="#333" />}
          onClick={() => setZoom(Math.min(8, zoom + 0.25))}
          title="Zoom In"
        />
        <ToolBtn
          icon={<ZoomOut size={20} color="#333" />}
          onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
          title="Zoom Out"
        />
        <ToolBtn
          icon={<Grid size={20} color="#0078d7" />}
          active={showGrid}
          onClick={() => onAction?.('grid')}
          title="Show Grid"
        />
      </div>

      {/* Alignment & Actions Group */}
      {selectedIds.length > 0 && (
        <div className="bt-toolbar-group">
          <div className="bt-toolbar-handle" />
          
          {/* Action Buttons */}
          <ToolBtn 
            icon={selectedIds.length === 1 && selectedEl?.locked ? <Lock size={18} color="#e59324" /> : <Unlock size={18} />}
            active={selectedIds.length === 1 && selectedEl?.locked}
            onClick={() => { if (selectedIds.length === 1 && selectedEl) updateElementAndSave(selectedEl.id, { locked: !selectedEl.locked }); }}
            title="Lock"
          />
          <ToolBtn
            icon={selectedIds.length === 1 && selectedEl?.visible === false ? <EyeOff size={18} /> : <Eye size={18} />}
            onClick={() => { if (selectedIds.length === 1 && selectedEl) updateElementAndSave(selectedEl.id, { visible: !selectedEl.visible }); }}
            title="Visibility"
          />
          <ToolBtn
            icon={<Copy size={18} />}
            onClick={() => { if (selectedIds.length === 1 && selectedEl) duplicateElement(selectedEl.id); }}
            title="Duplicate"
          />
          <ToolBtn
            icon={<Trash2 size={18} color="#c00" />}
            onClick={() => { if (selectedIds.length > 0) deleteElement(selectedIds); }}
            title="Delete"
          />

          <Sep />

          {/* Alignment Tools */}
          {selectedIds.length > 1 && (
            <>
              <ToolBtn icon={<Maximize size={18} />} onClick={() => matchSize('width')} title="Match Width" />
              <ToolBtn icon={<Maximize size={18} style={{ transform: 'rotate(90deg)' }} />} onClick={() => matchSize('height')} title="Match Height" />
              <Sep />
            </>
          )}

          <ToolBtn icon={<AlignLeft size={18} />} onClick={() => alignElements('left')} title="Align Left" />
          <ToolBtn icon={<AlignCenter size={18} />} onClick={() => alignElements('center')} title="Align Horizontal Center" />
          <ToolBtn icon={<AlignRight size={18} />} onClick={() => alignElements('right')} title="Align Right" />
          <Sep />
          <ToolBtn icon={<AlignVerticalJustifyStart size={18} />} onClick={() => alignElements('top')} title="Align Top" />
          <ToolBtn icon={<AlignVerticalJustifyCenter size={18} />} onClick={() => alignElements('middle')} title="Align Vertical Middle" />
          <ToolBtn icon={<AlignVerticalJustifyEnd size={18} />} onClick={() => alignElements('bottom')} title="Align Bottom" />
          
          {selectedIds.length > 1 && (
            <>
              <Sep />
              <ToolBtn
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><rect x="4" y="6" width="6" height="4" rx="1" fill="currentColor" opacity="0.3"/><rect x="14" y="6" width="6" height="4" rx="1" fill="currentColor" opacity="0.3"/></svg>}
                onClick={() => straightenElements()}
                title="Straight — Align selected elements to the same line as the first selected"
              />
            </>
          )}
          
          {selectedIds.length >= 3 && (
            <>
              <Sep />
              <ToolBtn
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V2m16 20V2M8 12h8m-8-4v8m8-8v8"/></svg>}
                onClick={() => distributeElements('x')}
                title="Distribute Horizontally"
              />
              <ToolBtn
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4H2m20 16H2M12 8v8m-4-8h8m-8 8h8"/></svg>}
                onClick={() => distributeElements('y')}
                title="Distribute Vertically"
              />
            </>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { onImageUpload?.(e); e.target.value = ''; }}
      />
      <input
        ref={excelRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleExcelUpload}
      />
    </div>
  );
}
