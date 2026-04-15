import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import { designsAPI } from '../api';
import { useCompanyStore } from '../store/companyStore';
import { useAuthStore } from '../store/authStore';
import DesignCanvas from '../components/DesignCanvas';
import MenuBar from '../components/MenuBar';
import StandardToolbar from '../components/StandardToolbar';
import PropertyBar from '../components/PropertyBar';
import ComponentsPanel from '../components/ComponentsPanel';
import PropertiesPanel from '../components/PropertiesPanel';
import BarcodePropertiesDialog from '../components/BarcodePropertiesDialog';
import toast from 'react-hot-toast';
import './Editor.css';

/* ─────────────────── Ruler Components ─────────────────── */

function HRuler({ widthPx, zoom, scrollLeft }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || widthPx <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = 20 * dpr;
    canvas.style.width = widthPx + 'px';
    canvas.style.height = '20px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, widthPx, 20);

    ctx.strokeStyle = '#808080';
    ctx.fillStyle = '#333';
    ctx.font = '8px Arial';
    ctx.lineWidth = 1;

    const ppi = 96 * zoom;
    const off = -(scrollLeft || 0);

    for (let i = 0; i <= 60; i++) {
      const x = Math.round(i * ppi + off) + 0.5;
      if (x < -1 || x > widthPx + 1) continue;

      // Major (inch)
      ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, 20); ctx.stroke();
      if (i > 0) ctx.fillText(String(i), x + 2, 9);

      // Half inch
      const xh = x + ppi * 0.5;
      if (xh > 0 && xh < widthPx) {
        ctx.beginPath(); ctx.moveTo(Math.round(xh) + 0.5, 13); ctx.lineTo(Math.round(xh) + 0.5, 20); ctx.stroke();
      }

      // Quarter inches
      [1, 3].forEach(q => {
        const xq = x + ppi * q / 4;
        if (xq > 0 && xq < widthPx) {
          ctx.beginPath(); ctx.moveTo(Math.round(xq) + 0.5, 16); ctx.lineTo(Math.round(xq) + 0.5, 20); ctx.stroke();
        }
      });
    }
    // Bottom line
    ctx.strokeStyle = '#aaa';
    ctx.beginPath(); ctx.moveTo(0, 19.5); ctx.lineTo(widthPx, 19.5); ctx.stroke();
  }, [widthPx, zoom, scrollLeft]);

  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'crisp-edges' }} />;
}

function VRuler({ heightPx, zoom, scrollTop }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || heightPx <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 20 * dpr;
    canvas.height = heightPx * dpr;
    canvas.style.width = '20px';
    canvas.style.height = heightPx + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, 20, heightPx);

    ctx.strokeStyle = '#808080';
    ctx.fillStyle = '#333';
    ctx.font = '8px Arial';
    ctx.lineWidth = 1;

    const ppi = 96 * zoom;
    const off = -(scrollTop || 0);

    for (let i = 0; i <= 60; i++) {
      const y = Math.round(i * ppi + off) + 0.5;
      if (y < -1 || y > heightPx + 1) continue;

      ctx.beginPath(); ctx.moveTo(9, y); ctx.lineTo(20, y); ctx.stroke();
      if (i > 0) {
        ctx.save();
        ctx.translate(9, y + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(i), 0, 0);
        ctx.restore();
      }

      const yh = y + ppi * 0.5;
      if (yh > 0 && yh < heightPx) {
        ctx.beginPath(); ctx.moveTo(13, Math.round(yh) + 0.5); ctx.lineTo(20, Math.round(yh) + 0.5); ctx.stroke();
      }

      [1, 3].forEach(q => {
        const yq = y + ppi * q / 4;
        if (yq > 0 && yq < heightPx) {
          ctx.beginPath(); ctx.moveTo(16, Math.round(yq) + 0.5); ctx.lineTo(20, Math.round(yq) + 0.5); ctx.stroke();
        }
      });
    }
    ctx.strokeStyle = '#aaa';
    ctx.beginPath(); ctx.moveTo(19.5, 0); ctx.lineTo(19.5, heightPx); ctx.stroke();
  }, [heightPx, zoom, scrollTop]);

  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'crisp-edges' }} />;
}

/* ─────────────────── Status Bar ─────────────────── */
function StatusBar({ zoom, selectedEl, canvasWidth, canvasHeight }) {
  const fmt = (v) => Number(pxToUnit(v || 0, 'in')).toFixed(2);
  return (
    <div className="bt-statusbar">
      <span className="bt-sb-item">Printer: ZDesigner ZT231-203dpi ZPL</span>
      <span className="bt-sb-sep">|</span>
      {selectedEl ? (
        <>
          <span className="bt-sb-item">
            Object: {selectedEl.type}
          </span>
          <span className="bt-sb-sep">|</span>
          <span className="bt-sb-item">
            X: {fmt(selectedEl.x)}" &nbsp; Y: {fmt(selectedEl.y)}"
          </span>
          <span className="bt-sb-sep">|</span>
          <span className="bt-sb-item">
            Item Width: {fmt(selectedEl.width || (selectedEl.radius ? selectedEl.radius * 2 : 0))}"
            &nbsp;
            Item Height: {fmt(selectedEl.height || (selectedEl.radius ? selectedEl.radius * 2 : 0))}"
          </span>
        </>
      ) : (
        <>
          <span className="bt-sb-item">
            Item Width: {fmt(canvasWidth)}" &nbsp; Item Height: {fmt(canvasHeight)}"
          </span>
        </>
      )}
      <span className="bt-sb-push" />
      <span className="bt-sb-item">{Math.round(zoom * 100)}%</span>
    </div>
  );
}

/* ─────────────────── Main Editor ─────────────────── */
export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const stageRef = useRef();
  const canvasAreaRef = useRef();
  const autoSaveRef = useRef();

  const {
    designId, title, canvasWidth, canvasHeight, backgroundColor, sizePreset,
    elements, isDirty, isSaving, zoom, selectedIds,
    setTitle, setCompany, setZoom, newDesign, loadDesign, setDesignId,
    setIsSaving, setDirty, addElement, undo, redo, historyIndex, history,
    company, setBackgroundColor, deleteElement,
    bringToFront, sendToBack, bringForward, sendBackward,
    alignElements,
  } = useDesignStore();

  const [showGrid, setShowGrid] = useState(false);
  const [showComponents, setShowComponents] = useState(true);
  const [showPropsPanel, setShowPropsPanel] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('template');
  const [canvasAreaSize, setCanvasAreaSize] = useState({ w: 800, h: 600 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [editingTitle, setEditingTitle] = useState(false);
  const [showBarcodeProps, setShowBarcodeProps] = useState(null); // stores elementId

  const { companies, fetchCompanies } = useCompanyStore();
  const selectedEl = selectedIds.length > 0 ? elements.find(e => e.id === selectedIds[0]) : null;

  // ── Load design ──
  useEffect(() => {
    fetchCompanies();
    if (id) {
      setLoading(true);
      designsAPI.getById(id)
        .then(res => { loadDesign(res.data.design); setTimeout(fitToScreen, 120); })
        .catch(() => { toast.error('Failed to load design'); navigate('/dashboard'); })
        .finally(() => setLoading(false));
    } else {
      if (!designId && !company) { newDesign('price-tag'); setTimeout(fitToScreen, 120); }
    }
  }, [id]);

  const fitToScreen = useCallback(() => {
    if (!canvasAreaRef.current) return;
    const padding = 80;
    const areaW = canvasAreaRef.current.clientWidth - padding;
    const areaH = canvasAreaRef.current.clientHeight - padding;
    if (areaW <= 0 || areaH <= 0) return;
    const newZoom = Math.min(areaW / canvasWidth, areaH / canvasHeight, 8.0);
    setZoom(Number(newZoom.toFixed(2)));
  }, [canvasWidth, canvasHeight, setZoom]);

  useEffect(() => { fitToScreen(); }, [canvasWidth, canvasHeight]);
  useEffect(() => {
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [fitToScreen]);

  // ── Track canvas area size for rulers ──
  useEffect(() => {
    if (!canvasAreaRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setCanvasAreaSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(canvasAreaRef.current);
    return () => ro.disconnect();
  }, []);

  const handleCanvasScroll = (e) => {
    setScrollPos({ x: e.target.scrollLeft, y: e.target.scrollTop });
  };

  // ── Auto-save ──
  const autoSaveFn = useCallback(async () => {
    if (!isDirty || !designId) return;
    await confirmSave(true);
  }, [isDirty, designId]);

  useEffect(() => {
    autoSaveRef.current = setInterval(autoSaveFn, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [autoSaveFn]);

  // ── Save helpers ──
  const getThumbnail = () => {
    if (!stageRef.current) return '';
    try { return stageRef.current.toDataURL({ pixelRatio: 0.3 }); } catch { return ''; }
  };

  const handleSave = (silent = false) => {
    if (isSaving) return;
    if (!silent) { setShowSaveModal(true); return; }
    confirmSave(true);
  };

  const confirmSave = async (silent = false) => {
    setIsSaving(true);
    try {
      const payload = {
        title, company, canvasWidth, canvasHeight, backgroundColor, sizePreset, elements,
        thumbnail: getThumbnail(),
      };
      if (designId) {
        await designsAPI.update(designId, payload);
      } else {
        const res = await designsAPI.create(payload);
        setDesignId(res.data.design._id);
        navigate(`/editor/${res.data.design._id}`, { replace: true });
      }
      setDirty(false);
      if (!silent) { toast.success('Design saved!'); setShowSaveModal(false); }
    } catch { if (!silent) toast.error('Failed to save'); }
    finally { setIsSaving(false); }
  };

  const handleExportPNG = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2, backgroundColor: 'white' });
    const a = document.createElement('a');
    a.href = uri; a.download = `${title || 'design'}.png`; a.click();
    toast.success('Exported as PNG!');
  };

  const handlePrint = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>*{margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;min-height:100vh}img{max-width:100%}@media print{body{display:block}img{width:100%}}</style></head><body><img src="${uri}" onload="window.print();window.close()"/></body></html>`);
    win.document.close();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addElement('image', { src: ev.target.result, width: 150, height: 150 });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Menu actions ──
  const handleMenuAction = (action) => {
    const ui = useUIStore.getState();
    const ds = useDesignStore.getState();
    switch (action) {
      case 'new':
        if (window.confirm('Create a new design? Unsaved changes will be lost.')) newDesign('price-tag');
        break;
      case 'open':
        navigate('/dashboard');
        break;
      case 'save': handleSave(false); break;
      case 'saveas': handleSave(true); break;
      case 'print': handlePrint(); break;
      case 'export-png': handleExportPNG(); break;
      case 'exit': navigate('/dashboard'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'delete': if (selectedIds.length) deleteElement(selectedIds); break;
      case 'zoom-in': setZoom(Math.min(8, zoom + 0.25)); break;
      case 'zoom-out': setZoom(Math.max(0.1, zoom - 0.25)); break;
      case 'zoom-50': setZoom(0.5); break;
      case 'zoom-75': setZoom(0.75); break;
      case 'zoom-100': setZoom(1.0); break;
      case 'zoom-150': setZoom(1.5); break;
      case 'zoom-200': setZoom(2.0); break;
      case 'fit': fitToScreen(); break;
      case 'grid': setShowGrid(g => !g); break;
      case 'components-panel': setShowComponents(c => !c); break;
      case 'bring-front': if (selectedIds[0]) bringToFront(selectedIds[0]); break;
      case 'bring-forward': if (selectedIds[0]) bringForward(selectedIds[0]); break;
      case 'send-backward': if (selectedIds[0]) sendBackward(selectedIds[0]); break;
      case 'send-back': if (selectedIds[0]) sendToBack(selectedIds[0]); break;
      case 'align-left': alignElements('left'); break;
      case 'align-center': alignElements('center'); break;
      case 'align-right': alignElements('right'); break;
      case 'align-top': alignElements('top'); break;
      case 'align-middle': alignElements('middle'); break;
      case 'align-bottom': alignElements('bottom'); break;
      // Drawing tools from Create menu
      case 'text':
      case 'text-m':
      case 'text-wp':
      case 'text-arc':
        ui.setSelectedTool('text'); break;
      case 'barcode': ui.setSelectedTool('barcode'); break;
      case 'draw-line': ui.setSelectedTool('draw-line'); break;
      case 'draw-rect': ui.setSelectedTool('draw-rect'); break;
      case 'draw-circle': ui.setSelectedTool('draw-circle'); break;
      case 'qrcode': ui.setSelectedTool('qrcode'); break;
      case 'image': document.getElementById('bt-hidden-img-upload')?.click(); break;
      case 'import-data': document.getElementById('bt-hidden-excel-upload')?.click(); break;
      default: break;
    }
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(false); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); setZoom(Math.min(8, zoom + 0.1)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(Math.max(0.1, zoom - 0.1)); }
      if (e.key === 'Escape') {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        
        if (showSaveModal) {
          setShowSaveModal(false);
          return;
        }

        const ui = useUIStore.getState();
        const ds = useDesignStore.getState();

        if (ui.selectedTool !== 'pick') {
          ui.setSelectedTool('pick');
          return;
        }

        if (ds.selectedIds.length > 0) {
          ds.deselectAll();
          return;
        }

        navigate('/dashboard');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoom]);

  const handleRotate = (deg) => {
    if (!selectedEl) return;
    useDesignStore.getState().updateElementAndSave(selectedEl.id, {
      rotation: ((selectedEl.rotation || 0) + deg) % 360,
    });
  };

  const handleElementDblClick = (elId) => {
    const el = elements.find(e => e.id === elId);
    if (el && el.type === 'barcode') {
      setShowBarcodeProps(elId);
    }
  };

  if (loading) return (
    <div className="bt-loading">
      <div className="bt-spinner" />
      <span style={{ fontFamily: 'Segoe UI, Arial', fontSize: 13, color: '#555', marginTop: 10 }}>
        Loading design...
      </span>
    </div>
  );

  return (
    <div className="bt-editor">

      {/* ── Title Bar ── */}
      <div className="bt-titlebar">
        <div className="bt-tb-logo">📊</div>
        {editingTitle ? (
          <input
            className="bt-titlebar-input"
            value={title}
            autoFocus
            onChange={e => setTitle(e.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
          />
        ) : (
          <span className="bt-titlebar-text" onDoubleClick={() => setEditingTitle(true)}>
            BarTender Enterprise Automation (Simulating Professional) — [{title || 'Document1'}.btw {isDirty ? '*' : ''}]
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button className="bt-titlebar-action" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
          ← Dashboard
        </button>
      </div>

      {/* ── Menu Bar ── */}
      <MenuBar
        onAction={handleMenuAction}
        gridOn={showGrid}
        componentsVisible={showComponents}
      />

      {/* ── Standard Toolbar (row 1) ── */}
      <StandardToolbar
        onAction={handleMenuAction}
        onImageUpload={handleImageUpload}
        showGrid={showGrid}
      />

      {/* ── Formatting Toolbar (row 2) ── */}
      <PropertyBar />

      {/* ── Main body ── */}
      <div className="bt-body">

        {/* Components Panel */}
        {showComponents && (
          <ComponentsPanel onToggle={() => setShowComponents(false)} />
        )}

        {/* Canvas Wrapper: ruler corner + rulers + scrollable canvas */}
        <div className="bt-canvas-wrapper">
          {/* Corner square (20×20) */}
          <div className="bt-ruler-corner" />

          {/* Horizontal ruler */}
          <div className="bt-ruler-h-wrap">
            <HRuler widthPx={canvasAreaSize.w} zoom={zoom} scrollLeft={scrollPos.x} />
          </div>

          {/* Row: vertical ruler + scrollable canvas */}
          <div className="bt-canvas-row">
            <div className="bt-ruler-v-wrap">
              <VRuler heightPx={canvasAreaSize.h} zoom={zoom} scrollTop={scrollPos.y} />
            </div>

            {/* The scrollable blue canvas area */}
            <div
              ref={canvasAreaRef}
              className="bt-canvas-scroll"
              onScroll={handleCanvasScroll}
            >
              <div
                className="bt-canvas-inner"
                style={{
                  width: canvasWidth * zoom + 160,
                  height: canvasHeight * zoom + 160,
                }}
              >
                <DesignCanvas 
                  stageRef={stageRef} 
                  showGrid={showGrid} 
                  onElementDblClick={handleElementDblClick}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right-side rotation panel */}
        <div className="bt-right-panel">
          <button
            className="bt-rot-btn"
            title="Rotate 90°"
            onClick={() => handleRotate(90)}
          >90°</button>
          <button
            className="bt-rot-btn"
            title="Rotate 180°"
            onClick={() => handleRotate(180)}
          >180°</button>
          <button
            className="bt-rot-btn"
            title="Rotate 270°"
            onClick={() => handleRotate(270)}
          >270°</button>
          <div style={{ flex: 1 }} />
          {/* Zoom percent shortcuts */}
          <button className="bt-rot-btn" onClick={fitToScreen} title="Fit">Fit</button>
        </div>

        {/* Properties Panel (right side, shows on selection) */}
        {showPropsPanel && (
          <div className={`bt-props-wrap${selectedIds.length === 0 ? ' bt-props-hidden' : ''}`}>
            <PropertiesPanel />
          </div>
        )}
      </div>

      {/* ── Bottom tab strip ── */}
      <div className="bt-bottom">
        <div className="bt-ds-tabs">
          <button className="bt-ds-tab">Data Sources</button>
          <button
            className={`bt-ds-tab${showComponents ? ' active' : ''}`}
            onClick={() => setShowComponents(c => !c)}
          >
            Components
          </button>
        </div>
        <div className="bt-tmpl-tabs">
          <button
            className={`bt-tmpl-tab${activeTemplate === 'template' ? ' active' : ''}`}
            onClick={() => setActiveTemplate('template')}
          >
            Template 1
          </button>
          <button
            className={`bt-tmpl-tab${activeTemplate === 'dataentry' ? ' active' : ''}`}
            onClick={() => setActiveTemplate('dataentry')}
          >
            Data Entry Form
          </button>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <StatusBar
        zoom={zoom}
        selectedEl={selectedEl}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
      />

      {/* ── Save Modal ── */}
      {showSaveModal && (
        <div className="bt-modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="bt-modal" onClick={e => e.stopPropagation()}>
            <div className="bt-modal-head">
              <span>Save Design</span>
              <button onClick={() => setShowSaveModal(false)}>✕</button>
            </div>
            <div className="bt-modal-body">
              <div className="bt-field">
                <label>Design Title</label>
                <input
                  className="bt-input"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Enter design title..."
                />
              </div>
              <div className="bt-field">
                <label>Target Folder</label>
                <select
                  className="bt-input"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                >
                  <option value="">No Folder</option>
                  {companies.map(c => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bt-modal-foot">
              <button className="bt-btn-cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
              <button
                className="bt-btn-ok"
                onClick={() => confirmSave(false)}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Properties Dialog */}
      {showBarcodeProps && (
        <BarcodePropertiesDialog 
          elementId={showBarcodeProps} 
          onClose={() => setShowBarcodeProps(null)} 
        />
      )}

      {/* Hidden file inputs */}
      <input id="bt-hidden-img-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
    </div>
  );
}
