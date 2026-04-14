import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDesignStore, SIZE_PRESETS } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import { designsAPI, companiesAPI } from '../api';
import { useCompanyStore } from '../store/companyStore';
import { useAuthStore } from '../store/authStore';
import DesignCanvas from '../components/DesignCanvas';
import Toolbar from '../components/Toolbar';
import PropertyBar from '../components/PropertyBar';
import PropertiesPanel from '../components/PropertiesPanel';
import {
    Save, Download, Printer, Undo2, Redo2, ZoomIn, ZoomOut,
    ArrowLeft, Grid, ChevronDown, Layers, Settings, Maximize2, Folder
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Editor.css';

export default function Editor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const stageRef = useRef();
    const autoSaveRef = useRef();
    const canvasAreaRef = useRef();

    const {
        designId, title, canvasWidth, canvasHeight, backgroundColor, sizePreset,
        elements, isDirty, isSaving, zoom, selectedIds,
        setTitle, setCompany, setZoom, setCanvasSize, newDesign, loadDesign, setDesignId,
        setIsSaving, setDirty, addElement, undo, redo, historyIndex, history,
        company,
    } = useDesignStore();

    const [showGrid, setShowGrid] = useState(true);
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingTitle, setEditingTitle] = useState(false);
    const [hidePanel, setHidePanel] = useState(false);

    const { measurementUnit, setMeasurementUnit } = useUIStore();

    const { companies, fetchCompanies } = useCompanyStore();

    // Load existing design or start fresh
    useEffect(() => {
        fetchCompanies();
        if (id) {
            setLoading(true);
            designsAPI.getById(id)
                .then(res => { 
                    loadDesign(res.data.design);
                    // Defer fitToScreen to ensure state is updated
                    setTimeout(fitToScreen, 100);
                })
                .catch(() => { toast.error('Failed to load design'); navigate('/dashboard'); })
                .finally(() => setLoading(false));
        } else {
            // Only initialize if we don't have a designId OR an existing folder configuration
            if (!designId && !company) {
                newDesign('price-tag');
                setTimeout(fitToScreen, 100);
            }
        }
    }, [id]);

    const fitToScreen = useCallback(() => {
        if (!canvasAreaRef.current) return;
        
        const padding = 40; // Reduced padding for more drawing space
        const areaWidth = canvasAreaRef.current.clientWidth - (padding * 2);
        const areaHeight = canvasAreaRef.current.clientHeight - (padding * 2);
        
        if (areaWidth <= 0 || areaHeight <= 0) return;

        const scaleW = areaWidth / canvasWidth;
        const scaleH = areaHeight / canvasHeight;
        // Increase limit to 8x to handle very small labels (like 44mm)
        const newZoom = Math.min(scaleW, scaleH, 8.0); 
        
        setZoom(Number(newZoom.toFixed(2)));
    }, [canvasWidth, canvasHeight, setZoom]);

    // Fit on dimension change
    useEffect(() => {
        fitToScreen();
    }, [canvasWidth, canvasHeight]);

    // Fit on window resize
    useEffect(() => {
        window.addEventListener('resize', fitToScreen);
        return () => window.removeEventListener('resize', fitToScreen);
    }, [fitToScreen]);

    // Auto-save every 30 seconds if dirty
    const autoSave = useCallback(async () => {
        if (!isDirty) return;
        await handleSave(true);
    }, [isDirty, designId, title, canvasWidth, canvasHeight, backgroundColor, sizePreset, elements]);

    useEffect(() => {
        autoSaveRef.current = setInterval(autoSave, 30000);
        return () => clearInterval(autoSaveRef.current);
    }, [autoSave]);

    const getThumbnail = () => {
        if (!stageRef.current) return '';
        try {
            return stageRef.current.toDataURL({ pixelRatio: 0.3 });
        } catch { return ''; }
    };

    const handleSave = async (silent = false) => {
        if (isSaving) return;
        if (!silent) {
            setShowSaveModal(true);
            return;
        }
        await confirmSave(true);
    };

    const confirmSave = async (silent = false) => {
        setIsSaving(true);
        try {
            const thumbnail = getThumbnail();
            const payload = { title, company, canvasWidth, canvasHeight, backgroundColor, sizePreset, elements, thumbnail };
            if (designId) {
                await designsAPI.update(designId, payload);
            } else {
                const res = await designsAPI.create(payload);
                setDesignId(res.data.design._id);
                navigate(`/editor/${res.data.design._id}`, { replace: true });
            }
            setDirty(false);
            if (!silent) {
                toast.success('Design saved!');
                setShowSaveModal(false);
            }
        } catch { if (!silent) toast.error('Failed to save'); }
        finally { setIsSaving(false); }
    };

    const handleExportPNG = () => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({
            pixelRatio: 2,
            backgroundColor: 'white'
        });
        const a = document.createElement('a');
        a.href = uri; a.download = `${title || 'design'}.png`; a.click();
        toast.success('Exported as PNG!');
    };

    const handlePrint = () => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const win = window.open('', '_blank');
        win.document.write(`
      <!DOCTYPE html><html><head><title>Print - ${title}</title>
      <style>* { margin:0; padding:0; } body { display:flex; justify-content:center; align-items:center; min-height:100vh; }
      img { max-width:100%; } @media print { body { display:block; } img { width:100%; } }</style>
      </head><body><img src="${uri}" onload="window.print();window.close();" /></body></html>
    `);
        win.document.close();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            addElement('image', { src: ev.target.result, width: 150, height: 150 });
        };
        reader.readAsDataURL(file);
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom(zoom + 0.1); }
            if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(zoom - 0.1); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [zoom]);

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
            <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
    );

    return (
        <div className="editor">
            {/* Top Bar */}
            <header className="editor-topbar">
                <div className="editor-topbar-left">
                    <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="editor-logo-icon"><Layers size={16} color="white" /></div>
                    {editingTitle ? (
                        <input className="editor-title-input" value={title} autoFocus
                            onChange={e => setTitle(e.target.value)}
                            onBlur={() => setEditingTitle(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)} />
                    ) : (
                        <h1 className="editor-title" onClick={() => setEditingTitle(true)} title="Click to rename">
                            {title} {isDirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
                        </h1>
                    )}
                </div>

                <div className="editor-topbar-center">
                    {/* Company selector */}
                    <div className="company-selector">
                        <Folder size={14} className="text-muted" />
                        <select 
                            className="company-select" 
                            value={company}
                            onChange={async (e) => {
                                const newCo = e.target.value;
                                setCompany(newCo);
                                
                                // Auto-title logic for NEW designs
                                if (!designId && newCo) {
                                    try {
                                        const res = await designsAPI.getNextTitle(newCo);
                                        setTitle(res.data.nextTitle);
                                    } catch (err) {
                                        console.error("Failed to fetch next title:", err);
                                    }
                                }
                            }}
                        >
                            <option value="">No Folder</option>
                            {companies.map(c => (
                                <option key={c._id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="prop-sep" />
                    <div className="prop-group px-4">
                        <span className="text-muted text-xs font-semibold uppercase tracking-wider">Dimensions:</span>
                        <span className="font-bold">{Math.round(pxToUnit(canvasWidth, measurementUnit))} × {Math.round(pxToUnit(canvasHeight, measurementUnit))} {measurementUnit}</span>
                    </div>

                    {/* Undo/Redo */}
                    <button className="btn btn-ghost btn-icon" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>

                    {/* Zoom */}
                    <div className="zoom-controls">
                        <button className="btn btn-ghost btn-icon" onClick={() => setZoom(zoom - 0.1)} title="Zoom Out"><ZoomOut size={16} /></button>
                        <span className="zoom-label" onClick={fitToScreen} title="Click to Fit to Screen" style={{ cursor: 'pointer' }}>
                            {Math.round(zoom * 100)}%
                        </span>
                        <button className="btn btn-ghost btn-icon" onClick={() => setZoom(zoom + 0.1)} title="Zoom In"><ZoomIn size={16} /></button>
                        <button className="btn btn-ghost btn-icon" onClick={fitToScreen} title="Fit to Screen"><Maximize2 size={14} /></button>
                    </div>

                    {/* Grid */}
                    <button className={`btn btn-ghost btn-icon ${showGrid ? 'grid-active' : ''}`} onClick={() => setShowGrid(!showGrid)} title="Toggle Grid">
                        <Grid size={16} />
                    </button>
                </div>

                <div className="editor-topbar-right">
                    <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print">
                        <Printer size={14} /> Print
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleExportPNG} title="Export PNG">
                        <Download size={14} /> Export PNG
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleSave()} disabled={isSaving} title="Save (Ctrl+S)">
                        {isSaving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }}></div> : <Save size={14} />}
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </header>

            {/* Dynamic Property Bar (context-sensitive) */}
            <PropertyBar />

            {/* Body */}
            <div className="editor-body" onClick={() => setShowSizeMenu(false)}>
                <Toolbar onImageUpload={handleImageUpload} />

                {/* Canvas area with Rulers Wrapper */}
                <div ref={canvasAreaRef} className="editor-canvas-area">
                    <div className="ruler-container" style={{
                        position: 'relative',
                        padding: '20px 0 0 20px', // Space for rulers
                        boxShadow: 'inset 20px 0 0 0 var(--bg-tertiary), inset 0 20px 0 0 var(--bg-tertiary)'
                    }}>
                        {/* Fake ruler lines for context */}
                        <div className="ruler ruler-h" style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 20, borderBottom: '1px solid var(--border)' }}></div>
                        <div className="ruler ruler-v" style={{ position: 'absolute', top: 20, left: 0, bottom: 0, width: 20, borderRight: '1px solid var(--border)' }}></div>
                        
                        <DesignCanvas stageRef={stageRef} showGrid={showGrid} />
                    </div>
                </div>

                <div className={`props-panel-container ${selectedIds.length === 0 ? 'collapsed' : ''}`}>
                    <PropertiesPanel />
                </div>
            </div>

            {/* Save Confirmation Modal */}
            {showSaveModal && (
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Save Design</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowSaveModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group mb-4">
                                <label className="form-label mb-2 block font-semibold text-sm">Design Title</label>
                                <input 
                                    className="input w-full" 
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Enter design title..."
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label mb-2 block font-semibold text-sm">Target Folder</label>
                                <div className="company-input-wrapper">
                                    <Folder className="input-icon-left" size={16} />
                                    <select 
                                        className="select-input w-full pl-10 h-10" 
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                    >
                                        <option value="">No Folder (Uncategorized)</option>
                                        {companies.map(c => (
                                            <option key={c._id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => confirmSave(false)} disabled={isSaving}>
                                {isSaving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }}></div> : <Save size={16} />}
                                {isSaving ? 'Saving...' : 'Save Design'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
