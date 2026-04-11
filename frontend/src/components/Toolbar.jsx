import React from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import {
    MousePointer2, Type, Square, Circle, Minus, 
    Triangle, BarChart2, QrCode, Image as ImageIcon, 
    Star, Hexagon, Fingerprint
} from 'lucide-react';
import './Toolbar.css';

const TOOLS = [
    { type: 'pick', label: 'Select', icon: <MousePointer2 size={18} />, shortcut: 'V', mode: true },
    { type: 'sep1', sep: true },
    { type: 'text', label: 'Text', icon: <Type size={18} />, shortcut: 'T' },
    { type: 'barcode', label: 'Barcode', icon: <BarChart2 size={18} />, shortcut: 'B' },
    { type: 'qrcode', label: 'QR Code', icon: <QrCode size={18} /> },
    { type: 'sep2', sep: true },
    { type: 'draw-rect', label: 'Box', icon: <Square size={18} />, drag: true },
    { type: 'draw-circle', label: 'Circle', icon: <Circle size={18} />, drag: true },
    { type: 'draw-line', label: 'Line', icon: <Minus size={18} />, drag: true },
    { type: 'draw-star', label: 'Star', icon: <Star size={18} />, drag: true },
    { type: 'draw-polygon', label: 'Polygon', icon: <Hexagon size={18} />, drag: true },
    { type: 'sep3', sep: true },
    { type: 'image', label: 'Picture', icon: <ImageIcon size={18} /> },
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

        // Standard add-on-click for text/barcode etc.
        addElement(tool.type);
        setSelectedTool('pick'); // Revert to select tool after adding
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
        </aside>
    );
}
