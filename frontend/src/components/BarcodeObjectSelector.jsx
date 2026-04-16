import React from 'react';
import './VirtualShapeSelector.css';

const BARCODE_GROUPS = [
    {
        title: 'General Purpose Barcodes',
        items: [
            { id: 'CODE128', label: 'Code 128', desc: 'Standard alphanumeric barcode' },
            { id: 'EAN13', label: 'EAN-13', desc: 'Standard retail barcode' },
            { id: 'UPCA', label: 'UPC-A', desc: 'North American retail barcode' },
            { id: 'CODE39', label: 'Code 39', desc: 'Common industrial barcode' },
        ]
    },
    {
        title: '2D Symbologies',
        items: [
            { id: 'QRCODE', label: 'QR Code', desc: 'Quick Response 2D matrix' },
            { id: 'DATAMATRIX', label: 'Data Matrix', desc: 'High-density 2D barcode' },
            { id: 'PDF417', label: 'PDF417', desc: 'Stacked linear 2D barcode' },
        ]
    }
];

export default function BarcodeObjectSelector({ onSelect, onClose }) {
    return (
        <div className="bt-shape-selector barcode-selector-exact" onClick={(e) => e.stopPropagation()}>
            <div className="bt-selector-body no-pad">
                {BARCODE_GROUPS.map((group, idx) => (
                    <div key={idx} className="bt-selector-group no-mg">
                        <div className="bt-exact-group-title">{group.title}</div>
                        <div className="list-grid-exact">
                            {group.items.map((item) => (
                                <div 
                                    key={item.id} 
                                    className="bt-exact-item list-item"
                                    onClick={() => {
                                        onSelect(`barcode-${item.id}`); 
                                        onClose();
                                    }}
                                    title={item.desc}
                                >
                                    <span className="bt-barcode-mini-icon">║║</span>
                                    <span className="bt-item-label">{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
