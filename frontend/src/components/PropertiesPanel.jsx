import React from 'react';
import { useDesignStore } from '../store/designStore';
import {
    Trash2, Lock, Unlock, Eye, EyeOff,
    BringToFront, SendToBack, ChevronUp, ChevronDown, Copy
} from 'lucide-react';
import './PropertiesPanel.css';

const FONTS = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Outfit', 'Inter'];
const BARCODE_FORMATS = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14', 'MSI', 'pharmacode'];

function ColorInput({ label, value, onChange }) {
    return (
        <div className="input-group">
            <label>{label}</label>
            <div className="flex gap-2 items-center">
                <div className="color-swatch">
                    <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} />
                </div>
                <input className="input" value={value || '#000000'} onChange={e => onChange(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
        </div>
    );
}

function NumInput({ label, value, onChange, min, max, step = 1, unit = '' }) {
    return (
        <div className="input-group">
            <label>{label}{unit && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}</label>
            <input className="input" type="number" value={value || 0} min={min} max={max} step={step}
                onChange={e => onChange(Number(e.target.value))} />
        </div>
    );
}

export default function PropertiesPanel() {
    const {
        selectedId, elements, canvasWidth, canvasHeight, backgroundColor,
        updateElement, updateElementAndSave, deleteElement, duplicateElement, duplicateAllElements,
        bringForward, sendBackward, bringToFront, sendToBack, toggleLock, toggleVisibility,
        setBackgroundColor, setCanvasSize, sizePreset, newDesign
    } = useDesignStore();

    const el = elements.find(e => e.id === selectedId);

    const update = (key, val) => updateElement(selectedId, { [key]: val });
    const updateAndSave = (key, val) => updateElementAndSave(selectedId, { [key]: val });

    if (!el) {
        // Canvas properties
        return (
            <aside className="props-panel">
                <div className="props-header">Canvas</div>
                <div className="props-section">
                    <div className="props-row">
                        <NumInput label="Width" value={canvasWidth} onChange={(v) => setCanvasSize(v, canvasHeight, sizePreset)} min={50} />
                        <NumInput label="Height" value={canvasHeight} onChange={(v) => setCanvasSize(canvasWidth, v, sizePreset)} min={50} />
                    </div>
                    <ColorInput label="Background Color" value={backgroundColor} onChange={setBackgroundColor} />
                </div>

                <div className="props-section" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="props-label">Design Actions</div>
                    <div className="flex flex-col gap-2">
                        <button className="btn btn-secondary btn-sm w-full gap-2"
                            onClick={duplicateAllElements}
                            disabled={elements.length === 0}>
                            <Copy size={14} /> Duplicate Entire Label
                        </button>
                        <button className="btn btn-ghost btn-sm w-full gap-2"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => { if (confirm('Clear entire design?')) newDesign(sizePreset) }}>
                            <Trash2 size={14} /> Clear Canvas
                        </button>
                    </div>
                </div>
            </aside>
        );
    }

    return (
        <aside className="props-panel">
            <div className="props-header">
                <span>{el.type.charAt(0).toUpperCase() + el.type.slice(1)} Properties</span>
                <div className="flex gap-1">
                    <button className="btn btn-ghost btn-icon" title="Duplicate" onClick={() => duplicateElement(el.id)}><Copy size={14} /></button>
                    <button className="btn btn-ghost btn-icon" title={el.locked ? 'Unlock' : 'Lock'} onClick={() => toggleLock(el.id)}>
                        {el.locked ? <Lock size={14} color="var(--warning)" /> : <Unlock size={14} />}
                    </button>
                    <button className="btn btn-ghost btn-icon" title={el.visible ? 'Hide' : 'Show'} onClick={() => toggleVisibility(el.id)}>
                        {el.visible !== false ? <Eye size={14} /> : <EyeOff size={14} color="var(--text-muted)" />}
                    </button>
                    <button className="btn btn-ghost btn-icon" title="Delete" onClick={() => deleteElement(el.id)}>
                        <Trash2 size={14} color="var(--danger)" />
                    </button>
                </div>
            </div>

            {/* Position & Size */}
            <div className="props-section">
                <div className="props-label">Position & Size</div>
                <div className="props-row">
                    <NumInput label="X" value={Math.round(el.x)} onChange={v => updateAndSave('x', v)} />
                    <NumInput label="Y" value={Math.round(el.y)} onChange={v => updateAndSave('y', v)} />
                </div>

                {/* Dynamic Dimensions based on type */}
                <div className="props-row">
                    {el.type === 'circle' && (
                        <NumInput label="Radius" value={el.radius || 50} onChange={v => update('radius', v)} min={1} />
                    )}
                    {(el.width !== undefined || ['rect', 'barcode', 'qrcode', 'image', 'triangle'].includes(el.type)) && (
                        <NumInput label="Width" value={Math.round(el.width || 100)} onChange={v => update('width', v)} min={1} />
                    )}
                    {(el.height !== undefined || ['rect', 'barcode', 'qrcode', 'image', 'triangle'].includes(el.type)) && (
                        <NumInput label="Height" value={Math.round(el.height || 100)} onChange={v => update('height', v)} min={1} />
                    )}
                </div>

                {/* Line length support */}
                {el.type === 'line' && el.points && (
                    <NumInput label="Length" value={Math.abs(el.points[2] - el.points[0])}
                        onChange={v => update('points', [0, 0, v, 0])} min={1} />
                )}

                <NumInput label="Rotation" value={Math.round(el.rotation || 0)} onChange={v => updateAndSave('rotation', v)} min={-360} max={360} unit="°" />

                <div className="props-row">
                    <NumInput label="Scale X" value={Number((el.scaleX || 1).toFixed(2))} onChange={v => update('scaleX', v)} step={0.1} />
                    <NumInput label="Scale Y" value={Number((el.scaleY || 1).toFixed(2))} onChange={v => update('scaleY', v)} step={0.1} />
                </div>

                <div className="flex gap-1" style={{ marginTop: 4 }}>
                    <button className="btn btn-secondary btn-sm flex-1" style={{ fontSize: 10 }}
                        onClick={() => updateAndSave('selectedId', selectedId) || updateElementAndSave(selectedId, { scaleX: 1, scaleY: 1, rotation: 0 })}>
                        Reset Transform
                    </button>
                    <button className="btn btn-secondary btn-sm flex-1" style={{ fontSize: 10 }} onClick={() => {
                        const width = el.type === 'circle' ? (el.radius || 50) * 2 : (el.width || 100);
                        const scaleX = el.scaleX || 1;
                        let targetX = (canvasWidth / 2);
                        if (el.type !== 'circle') {
                            targetX -= (width * scaleX) / 2;
                        }
                        updateElementAndSave(selectedId, { x: targetX });
                    }}>
                        Center Horizontally
                    </button>
                </div>

                <div className="input-group">
                    <label>Opacity <span style={{ color: 'var(--text-muted)' }}>{Math.round((el.opacity || 1) * 100)}%</span></label>
                    <input type="range" min={0} max={1} step={0.01} value={el.opacity || 1} onChange={e => update('opacity', parseFloat(e.target.value))} />
                </div>
            </div>

            {/* Text specific */}
            {el.type === 'text' && (
                <div className="props-section">
                    <div className="props-label">Text</div>
                    <div className="input-group">
                        <label>Content</label>
                        <textarea className="input" rows={3} value={el.text} onChange={e => update('text', e.target.value)}
                            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>
                    <div className="input-group">
                        <label>Font Family</label>
                        <select className="input" value={el.fontFamily || 'Arial'} onChange={e => update('fontFamily', e.target.value)}>
                            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <NumInput label="Font Size" value={el.fontSize || 16} onChange={v => update('fontSize', v)} min={4} max={200} />
                    <div className="input-group">
                        <label>Style</label>
                        <div className="flex gap-1">
                            <button className={`btn btn-sm ${el.fontWeight === 'bold' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => update('fontWeight', el.fontWeight === 'bold' ? 'normal' : 'bold')} style={{ fontWeight: 'bold' }}>B</button>
                            <button className={`btn btn-sm ${el.fontStyle === 'italic' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => update('fontStyle', el.fontStyle === 'italic' ? 'normal' : 'italic')} style={{ fontStyle: 'italic' }}>I</button>
                            <button className={`btn btn-sm ${el.underline ? 'btn-primary' : 'btn-secondary'}`} onClick={() => update('underline', !el.underline)} style={{ textDecoration: 'underline' }}>U</button>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Align</label>
                        <div className="flex gap-1">
                            {['left', 'center', 'right'].map(a => (
                                <button key={a} className={`btn btn-sm ${el.textAlign === a ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => update('textAlign', a)}>{a.charAt(0).toUpperCase() + a.slice(1)}</button>
                            ))}
                        </div>
                    </div>
                    <ColorInput label="Text Color" value={el.fill} onChange={v => update('fill', v)} />
                </div>
            )}

            {/* Shape fill/stroke */}
            {['rect', 'circle', 'triangle', 'star', 'polygon', 'ellipse', 'path'].includes(el.type) && (
                <div className="props-section">
                    <div className="props-label">Style (Fill & Outline)</div>
                    <div className="props-row">
                        <ColorInput label="Fill Color" value={el.fill} onChange={v => updateAndSave('fill', v)} />
                        <ColorInput label="Stroke Color" value={el.stroke} onChange={v => updateAndSave('stroke', v)} />
                    </div>
                    <NumInput label="Outline Width" value={el.strokeWidth || 0} onChange={v => updateAndSave('strokeWidth', v)} min={0} max={20} />
                    
                    {el.type === 'rect' && <NumInput label="Corner Radius" value={el.cornerRadius || 0} onChange={v => updateAndSave('cornerRadius', v)} min={0} max={100} />}
                    
                    {el.type === 'star' && (
                        <div className="props-row">
                            <NumInput label="Points" value={el.numPoints || 5} onChange={v => updateAndSave('numPoints', v)} min={3} max={50} />
                            <NumInput label="Sharpness" value={el.innerRadius || 20} onChange={v => updateAndSave('innerRadius', v)} min={1} />
                        </div>
                    )}
                    
                    {el.type === 'polygon' && (
                        <NumInput label="Sides" value={el.sides || 6} onChange={v => updateAndSave('sides', v)} min={3} max={50} />
                    )}

                    {el.type === 'path' && (
                        <div className="input-group">
                            <label>Path Data</label>
                            <textarea className="input" style={{ fontSize: 10 }} value={el.data} onChange={e => updateAndSave('data', e.target.value)} />
                        </div>
                    )}
                </div>
            )}

            {/* Line */}
            {el.type === 'line' && (
                <div className="props-section">
                    <div className="props-label">Line Style</div>
                    <ColorInput label="Color" value={el.stroke} onChange={v => update('stroke', v)} />
                    <NumInput label="Width" value={el.strokeWidth || 2} onChange={v => update('strokeWidth', v)} min={1} max={30} />
                </div>
            )}

            {/* Barcode */}
            {el.type === 'barcode' && (
                <div className="props-section">
                    <div className="props-label">Barcode</div>
                    <div className="input-group">
                        <label>Value</label>
                        <input className="input" value={el.barcodeValue || ''} onChange={e => update('barcodeValue', e.target.value)} />
                    </div>
                    <div className="input-group">
                        <label>Format</label>
                        <select className="input" value={el.barcodeFormat || 'CODE128'} onChange={e => update('barcodeFormat', e.target.value)}>
                            {BARCODE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>
                    <ColorInput label="Bar Color" value={el.fill} onChange={v => update('fill', v)} />
                </div>
            )}

            {/* QR Code */}
            {el.type === 'qrcode' && (
                <div className="props-section">
                    <div className="props-label">QR Code</div>
                    <div className="input-group">
                        <label>URL / Value</label>
                        <input className="input" value={el.qrValue || ''} onChange={e => update('qrValue', e.target.value)} placeholder="https://..." />
                    </div>
                </div>
            )}

            {/* Layer Order */}
            <div className="props-section">
                <div className="props-label">Layer Order</div>
                <div className="flex gap-1">
                    <button className="btn btn-secondary btn-sm flex-1" title="Bring to Front" onClick={() => bringToFront(el.id)}><BringToFront size={14} /></button>
                    <button className="btn btn-secondary btn-sm flex-1" title="Bring Forward" onClick={() => bringForward(el.id)}><ChevronUp size={14} /></button>
                    <button className="btn btn-secondary btn-sm flex-1" title="Send Backward" onClick={() => sendBackward(el.id)}><ChevronDown size={14} /></button>
                    <button className="btn btn-secondary btn-sm flex-1" title="Send to Back" onClick={() => sendToBack(el.id)}><SendToBack size={14} /></button>
                </div>
            </div>
        </aside>
    );
}
