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
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import VirtualShapeSelector from './VirtualShapeSelector';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './StandardToolbar.css';

const Sep = () => <div className="bt-tb-sep" />;

const ToolBtn = ({ icon, label, active, disabled, onClick, title }) => (
  <button
    className={`bt-tb-btn${active ? ' active' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={title || label}
  >
    {icon}
  </button>
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
    addElement, elements, selectedIds
  } = useDesignStore();
  const { selectedTool, setSelectedTool } = useUIStore();
  const [showShapeSelector, setShowShapeSelector] = React.useState(false);
  const excelRef = useRef();
  const imageRef = useRef();

  const isActive = (tool) => selectedTool === tool;

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
    <div className="bt-standard-toolbar">
      {/* File Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn icon={<FilePlus size={16} color="#0078d7" />} onClick={() => onAction?.('new')} title="New (Ctrl+N)" />
        <ToolBtn icon={<FolderOpen size={16} color="#e8b01a" />} onClick={() => onAction?.('open')} title="Open (Ctrl+O)" />
        <ToolBtn icon={<Save size={16} color="#2a5a9b" />} onClick={() => onAction?.('save')} title="Save (Ctrl+S)" />
        <ToolBtn icon={<FileSpreadsheet size={16} color="#217346" />} onClick={() => excelRef.current?.click()} title="Import Data" />
        <ToolBtn icon={<Printer size={16} color="#444" />} onClick={() => onAction?.('print')} title="Print (Ctrl+P)" />
        <ToolBtn icon={<Eye size={16} color="#555" />} onClick={() => onAction?.('fit')} title="Print Preview" />
        <ToolBtn icon={<Maximize2 size={16} color="#555" />} onClick={() => onAction?.('fit')} title="Zoom to Fit" />
      </div>

      {/* Edit Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn icon={<Scissors size={16} color="#c00" />} onClick={() => onAction?.('cut')} title="Cut (Ctrl+X)" />
        <ToolBtn icon={<Copy size={16} color="#555" />} onClick={() => onAction?.('copy')} title="Copy (Ctrl+C)" />
        <ToolBtn icon={<Clipboard size={16} color="#855" />} onClick={() => onAction?.('paste')} title="Paste (Ctrl+V)" />
      </div>

      {/* History Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<Undo2 size={16} color="#333" />}
          onClick={undo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        />
        <ToolBtn
          icon={<Redo2 size={16} color="#333" />}
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Y)"
        />
      </div>

      {/* Creation Tools Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<MousePointer2 size={16} color="#ff9900" />}
          active={isActive('pick')}
          onClick={() => setSelectedTool('pick')}
          title="Select (V)"
        />
        <ToolBtn
          icon={<Type size={16} color="#000" />}
          active={isActive('text')}
          onClick={() => setSelectedTool('text')}
          title="Text (T)"
        />
        {/* Barcode Menu */}
        <div className="bt-tb-dropdown-wrap">
          <ToolBtn
            icon={<BarChart2 size={16} color="#000" />}
            active={isActive('barcode')}
            onClick={() => setSelectedTool('barcode')}
            title="Barcode (B)"
          />
          <select 
            className="bt-tb-mini-select"
            onChange={(e) => {
              setSelectedTool('barcode');
            }}
            value="CODE128"
          >
            <option value="CODE128">Standard Barcode</option>
            <option value="CODE128">Code 128</option>
            <option value="EAN13">EAN-13</option>
            <option value="EAN8">EAN-8</option>
            <option value="CODE39">Code 39</option>
            <option value="CODE93">Code 93</option>
          </select>
        </div>
        <ToolBtn icon={<Zap size={16} color="#000" />} onClick={() => {}} title="RFID / Signal" />
        <ToolBtn
          icon={<Minus size={16} color="#000" />}
          active={isActive('draw-line')}
          onClick={() => setSelectedTool('draw-line')}
          title="Line"
        />

        {/* Virtual Shapes Menu */}
        <div className="bt-tb-dropdown-wrap" style={{ position: 'relative' }}>
          <ToolBtn
            icon={<CustomShapesIcon size={18} />}
            active={['draw-rect', 'draw-circle', 'draw-star', 'draw-triangle', 'draw-diamond', 'draw-hexagon', 'draw-octagon', 'draw-arrow-right', 'draw-arrow-bidir'].some(t => isActive(t))}
            onClick={() => {
              if (selectedTool.startsWith('draw-')) {
                setShowShapeSelector(!showShapeSelector);
              } else {
                setSelectedTool('draw-rect');
              }
            }}
            title="Shapes"
          />
          <button 
            className="bt-tb-mini-btn" 
            onClick={() => setShowShapeSelector(!showShapeSelector)}
          >
            <ChevronDown size={10} />
          </button>
          
          {showShapeSelector && (
            <div style={{ position: 'absolute', top: 28, left: 0, zIndex: 2000 }}>
              <VirtualShapeSelector 
                onSelect={setSelectedTool} 
                onClose={() => setShowShapeSelector(false)} 
              />
            </div>
          )}
        </div>

        <ToolBtn
          icon={<ImageIcon size={16} color="#c44" />}
          onClick={() => imageRef.current?.click()}
          title="Insert Picture"
        />
        <ToolBtn
          icon={<QrCode size={16} color="#000" />}
          active={isActive('qrcode')}
          onClick={() => setSelectedTool('qrcode')}
          title="QR Code"
        />
        <ToolBtn icon={<Box size={16} color="#555" />} onClick={() => {}} title="Layout" />
        <ToolBtn icon={<Camera size={16} color="#555" />} onClick={() => {}} title="Scan / Camera" />
      </div>

      {/* View/Zoom Group */}
      <div className="bt-toolbar-group">
        <div className="bt-toolbar-handle" />
        <ToolBtn
          icon={<ZoomIn size={16} color="#333" />}
          onClick={() => setZoom(Math.min(8, zoom + 0.25))}
          title="Zoom In (Ctrl++)"
        />
        <ToolBtn
          icon={<ZoomOut size={16} color="#333" />}
          onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
          title="Zoom Out (Ctrl+-)"
        />
        <ToolBtn
          icon={<Grid size={16} color="#0078d7" />}
          active={showGrid}
          onClick={() => onAction?.('grid')}
          title="Toggle Grid"
        />
      </div>

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
