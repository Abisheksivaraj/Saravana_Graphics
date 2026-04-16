import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import { useUIStore, unitToPx } from '../store/uiStore';
import './NewDesignModal.css';

export default function NewDesignModal({ onClose }) {
    const { newDesign } = useDesignStore();
    const { measurementUnit } = useUIStore();
    const [width, setWidth] = useState(100);
    const [height, setHeight] = useState(150);
    const [unit, setUnit] = useState(measurementUnit || 'mm');

    const handleCreate = () => {
        const wPx = unitToPx(width, unit);
        const hPx = unitToPx(height, unit);
        newDesign('custom', wPx, hPx);
        onClose();
    };

    return (
        <div className="bt-modal-overlay" onClick={onClose}>
            <div className="bt-modal new-design-modal" onClick={e => e.stopPropagation()}>
                <div className="bt-modal-head">
                    <span>New Design</span>
                    <button onClick={onClose}>✕</button>
                </div>
                
                <div className="bt-modal-body">
                    <p className="bt-modal-desc">
                        Specify the dimensions for your new label.
                    </p>

                    <div className="bt-field-grid mt-4">
                        <div className="bt-field">
                            <label>Width:</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    className="bt-input" 
                                    value={width} 
                                    onChange={e => setWidth(Number(e.target.value))} 
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="bt-field">
                            <label>Height:</label>
                            <input 
                                type="number" 
                                className="bt-input" 
                                value={height} 
                                onChange={e => setHeight(Number(e.target.value))} 
                            />
                        </div>

                        <div className="bt-field">
                            <label>Measurement Unit:</label>
                            <select 
                                className="bt-input" 
                                value={unit} 
                                onChange={e => setUnit(e.target.value)}
                            >
                                <option value="mm">Millimeters (mm)</option>
                                <option value="in">Inches (in)</option>
                                <option value="px">Pixels (px)</option>
                                <option value="pt">Points (pt)</option>
                            </select>
                        </div>
                    </div>

                    <div className="bt-template-preview mt-6">
                        <div className="bt-label-sm mb-2">Orientation</div>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={height >= width} readOnly />
                                <span>Portrait</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" checked={width > height} readOnly />
                                <span>Landscape</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="bt-modal-foot">
                    <button className="bt-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="bt-btn-ok" onClick={handleCreate}>Create Design</button>
                </div>
            </div>
        </div>
    );
}
