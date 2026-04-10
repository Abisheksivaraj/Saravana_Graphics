import React from 'react';
import { useDesignStore } from '../store/designStore';
import {
    Type, Square, Circle, Minus, Triangle,
    BarChart2, QrCode, Image as ImageIcon, Star, Hexagon
} from 'lucide-react';
import './Toolbar.css';

const TOOLS = [
    { type: 'text', label: 'Text', icon: <Type size={20} />, tooltip: 'Add Text (T)' },
    { type: 'rect', label: 'Rectangle', icon: <Square size={20} />, tooltip: 'Add Rectangle' },
    { type: 'circle', label: 'Circle', icon: <Circle size={20} />, tooltip: 'Add Circle' },
    { type: 'triangle', label: 'Triangle', icon: <Triangle size={20} />, tooltip: 'Add Triangle' },
    { type: 'line', label: 'Line', icon: <Minus size={20} />, tooltip: 'Add Line' },
    { type: 'star', label: 'Star', icon: <Star size={20} />, tooltip: 'Add Star' },
    { type: 'polygon', label: 'Polygon', icon: <Hexagon size={20} />, tooltip: 'Add Polygon' },
    { type: 'barcode', label: 'Barcode', icon: <BarChart2 size={20} />, tooltip: 'Add Barcode' },
    { type: 'qrcode', label: 'QR Code', icon: <QrCode size={20} />, tooltip: 'Add QR Code' },
];

export default function Toolbar({ onImageUpload }) {
    const { addElement } = useDesignStore();

    return (
        <aside className="editor-toolbar">
            <div className="toolbar-section-label">Elements</div>
            {TOOLS.map((tool) => (
                <button
                    key={tool.type}
                    className="toolbar-btn"
                    data-tooltip={tool.tooltip}
                    onClick={() => addElement(tool.type)}
                >
                    {tool.icon}
                    <span>{tool.label}</span>
                </button>
            ))}
            <div className="toolbar-sep"></div>
            <div className="toolbar-section-label">Media</div>
            <label className="toolbar-btn" data-tooltip="Upload Image">
                <ImageIcon size={20} />
                <span>Image</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageUpload} />
            </label>
        </aside>
    );
}
