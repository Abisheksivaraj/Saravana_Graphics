import React from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import {
    MousePointer2, Type, Square, Circle, Minus, 
    Triangle, BarChart2, QrCode, Image as ImageIcon, 
    Star, Hexagon, Fingerprint, FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import './Toolbar.css';

const TOOLS = [
    { type: 'pick', label: 'Select', icon: <MousePointer2 size={18} />, shortcut: 'V', mode: true },
    { type: 'sep1', sep: true },
    { type: 'text', label: 'Text', icon: <Type size={18} />, shortcut: 'T', drag: true },
    { type: 'barcode', label: 'Barcode', icon: <BarChart2 size={18} />, shortcut: 'B', drag: true },
    { type: 'qrcode', label: 'QR Code', icon: <QrCode size={18} />, drag: true },
    { type: 'sep2', sep: true },
    { type: 'draw-rect', label: 'Box', icon: <Square size={18} />, drag: true },
    { type: 'draw-circle', label: 'Circle', icon: <Circle size={18} />, drag: true },
    { type: 'draw-line', label: 'Line', icon: <Minus size={18} />, drag: true },
    { type: 'star', label: 'Star', icon: <Star size={18} />, drag: true },
    { type: 'sep3', sep: true },
    { type: 'image', label: 'Picture', icon: <ImageIcon size={18} /> },
    { type: 'excel', label: 'Import Data', icon: <FileSpreadsheet size={18} /> },
];

export default function Toolbar({ onImageUpload }) {
    const { addElement } = useDesignStore();
    const { selectedTool, setSelectedTool } = useUIStore();

    const handleAction = (tool) => {
        if (tool.mode || tool.drag) {
            setSelectedTool(tool.type);
            return;
        }

        if (tool.type === 'image') {
            document.getElementById('toolbar-image-upload').click();
            return;
        }

        if (tool.type === 'excel') {
            document.getElementById('toolbar-excel-upload').click();
            return;
        }

        // Standard add-on-click for text/barcode etc.
        addElement(tool.type);
        setSelectedTool('pick'); // Revert to select tool after adding
    };

    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);
                
                if (data && data.length > 0) {
                    useDesignStore.getState().setPreviewData(data[0]);
                    toast.success(`Data Loaded: ${Object.keys(data[0]).length} columns found`);
                } else {
                    toast.error('No data found in file');
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to parse Excel file');
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <aside className="vertical-toolbox">
            <div className="toolbox-content">
                {TOOLS.map((tool, idx) => (
                    tool.sep ? (
                        <div key={`sep-${idx}`} className="toolbox-sep" />
                    ) : (
                        <button
                            key={tool.type}
                            className={`toolbox-btn ${selectedTool === tool.type ? 'active' : ''}`}
                            onClick={() => handleAction(tool)}
                            title={`${tool.label} ${tool.shortcut ? `(${tool.shortcut})` : ''}`}
                        >
                            <div className="toolbox-icon">{tool.icon}</div>
                            <span className="toolbox-label">{tool.label}</span>
                        </button>
                    )
                ))}
            </div>
            
            <input 
                id="toolbar-image-upload" 
                type="file" 
                accept="image/*" 
                style={{ display: 'none' }} 
                onChange={onImageUpload} 
            />
            <input 
                id="toolbar-excel-upload" 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                style={{ display: 'none' }} 
                onChange={handleExcelUpload} 
            />
        </aside>
    );
}
