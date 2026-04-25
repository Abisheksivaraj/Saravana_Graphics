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
import ShapePropertiesDialog from '../components/ShapePropertiesDialog';
import TextPropertiesDialog from '../components/TextPropertiesDialog';
import LinePropertiesDialog from '../components/LinePropertiesDialog';
import ImagePropertiesDialog from '../components/ImagePropertiesDialog';
import NewDesignModal from '../components/NewDesignModal';
import toast from 'react-hot-toast';
import {
  AlignLeft, AlignCenter, AlignRight,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd
} from 'lucide-react';
import './Editor.css';

/* ─────────────────── Ruler Components ─────────────────── */

function HRuler({ widthPx, zoom, scrollLeft }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || widthPx <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = widthPx * dpr;
    canvas.height = 24 * dpr;
    canvas.style.width = widthPx + 'px';
    canvas.style.height = '24px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, widthPx, 24);

    ctx.strokeStyle = '#666';
    ctx.fillStyle = '#333';
    ctx.font = '9px Arial';
    ctx.lineWidth = 1;

    const ppi = 96 * zoom;
    const offset = -(scrollLeft || 0) + 100; // Match padding in bt-canvas-inner

    // Draw from -20 to 50 inches
    for (let i = -20; i <= 50; i++) {
      const x = Math.round(i * ppi + offset) + 0.5;
      if (x < -ppi || x > widthPx + ppi) continue;

      // Major tick (inch)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 24); ctx.stroke();
      ctx.fillText(String(i), x + 4, 12);

      // Subdivisions
      for (let j = 1; j < 8; j++) {
        const subX = x + (ppi * j / 8);
        if (subX < 0 || subX > widthPx) continue;
        const h = j % 4 === 0 ? 12 : (j % 2 === 0 ? 8 : 4);
        ctx.beginPath();
        ctx.moveTo(Math.round(subX) + 0.5, 24 - h);
        ctx.lineTo(Math.round(subX) + 0.5, 24);
        ctx.stroke();
      }
    }
  }, [widthPx, zoom, scrollLeft]);

  return <canvas ref={ref} style={{ display: 'block', imageRendering: 'crisp-edges' }} />;
}

function VRuler({ heightPx, zoom, scrollTop }) {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || heightPx <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 24 * dpr;
    canvas.height = heightPx * dpr;
    canvas.style.width = '24px';
    canvas.style.height = heightPx + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 24, heightPx);

    ctx.strokeStyle = '#666';
    ctx.fillStyle = '#333';
    ctx.font = '9px Arial';
    ctx.lineWidth = 1;

    const ppi = 96 * zoom;
    const offset = -(scrollTop || 0) + 100; // Match padding in bt-canvas-inner

    for (let i = -20; i <= 80; i++) {
      const y = Math.round(i * ppi + offset) + 0.5;
      if (y < -ppi || y > heightPx + ppi) continue;

      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(24, y); ctx.stroke();
      
      ctx.save();
      ctx.translate(14, y + 4);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(i), 0, 0);
      ctx.restore();

      for (let j = 1; j < 8; j++) {
        const subY = y + (ppi * j / 8);
        if (subY < 0 || subY > heightPx) continue;
        const w = j % 4 === 0 ? 12 : (j % 2 === 0 ? 8 : 4);
        ctx.beginPath();
        ctx.moveTo(24 - w, Math.round(subY) + 0.5);
        ctx.lineTo(24, Math.round(subY) + 0.5);
        ctx.stroke();
      }
    }
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
    alignElements, distributeElements, straightenElements
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
  const [showShapeProps, setShowShapeProps] = useState(null); // stores elementId
  const [showTextProps, setShowTextProps] = useState(null); // stores elementId
  const [showLineProps, setShowLineProps] = useState(null); // stores elementId
  const [showImageProps, setShowImageProps] = useState(null); // stores elementId
  const [showNewModal, setShowNewModal] = useState(false);

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

  // Always ensure history is initialized from current elements after store hydration
  useEffect(() => {
    const state = useDesignStore.getState();
    if (state.elements.length > 0 && state.history.length === 1 && 
        JSON.stringify(state.history[0]) !== JSON.stringify(state.elements)) {
      useDesignStore.setState({ 
        history: [JSON.parse(JSON.stringify(state.elements))], 
        historyIndex: 0 
      });
    }
  }, []);

  const fitToScreen = useCallback(() => {
    if (!canvasAreaRef.current) return;
    const padding = 120; // Margin around the label
    const areaW = canvasAreaRef.current.clientWidth - padding;
    const areaH = canvasAreaRef.current.clientHeight - padding;
    if (areaW <= 0 || areaH <= 0) return;
    const newZoom = Math.min(areaW / canvasWidth, areaH / canvasHeight, 8.0);
    setZoom(Number(newZoom.toFixed(2)));

    // Scroll to center
    setTimeout(() => {
      if (!canvasAreaRef.current) return;
      const scrollEl = canvasAreaRef.current;
      const innerEl = scrollEl.firstChild;
      if (innerEl) {
        scrollEl.scrollLeft = (innerEl.clientWidth - scrollEl.clientWidth) / 2;
        scrollEl.scrollTop = (innerEl.clientHeight - scrollEl.clientHeight) / 2;
      }
    }, 50);
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
      if (!silent) { 
        toast.success('Design saved!'); 
        setShowSaveModal(false); 
        navigate('/dashboard');
      }
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
        setShowNewModal(true);
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
      case 'cut': ds.cut(); break;
      case 'copy': ds.copy(); break;
      case 'paste': ds.paste(); break;
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
      // Allow natural copy/cut/paste/select-all inside text boxes
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
          return;
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 's' || e.code === 'KeyS')) { e.preventDefault(); handleSave(false); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.code === 'KeyZ')) { 
        e.preventDefault(); 
        if (e.shiftKey) redo(); else undo(); 
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || e.code === 'KeyY')) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) { e.preventDefault(); ds.copy(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'x' || e.code === 'KeyX')) { e.preventDefault(); ds.cut(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); setZoom(Math.min(8, zoom + 0.1)); }
      if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(Math.max(0.1, zoom - 0.1)); }
      if (e.key === 'Escape') {
        if (showSaveModal) {
          setShowSaveModal(false);
          return;
        }

        const ui = useUIStore.getState();
        const ds = useDesignStore.getState();

        if (ui.selectedTool !== 'pick') {
          ui.setSelectedTool('pick');
        }

        if (ds.selectedIds.length > 0) {
          ds.deselectAll();
        }
      }
    };
    
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(Math.min(8, Math.max(0.1, zoom + delta)));
      }
    };

    const handlePaste = async (e) => {
      // Allow natural paste inside input fields
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      e.preventDefault(); // Stop default browser behavior
      const stage = stageRef.current;
      const pos = stage?.getRelativePointerPosition() || { x: 100, y: 100 };
      const clipboardData = e.clipboardData;

      if (!clipboardData) {
        // Fallback to internal if event is missing data
        ds.paste(pos.x, pos.y);
        return;
      }

      // Priority 1: Files (Images)
      if (clipboardData.files && clipboardData.files.length > 0) {
        for (const file of Array.from(clipboardData.files)) {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              addElement('image', { src: ev.target.result, width: 150, height: 150, x: pos.x, y: pos.y });
              toast.success('Image pasted');
            };
            reader.readAsDataURL(file);
          }
        }
        return;
      }

      // Priority 2: Text (can be plain text or our JSON)
      const text = clipboardData.getData('text/plain');
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data.type === 'saravana-elements' && Array.isArray(data.elements)) {
            ds.pasteElements(data.elements, pos.x, pos.y);
            toast.success('Elements pasted');
            return;
          }
        } catch (err) {
          // Not our JSON, handle as plain text
        }

        // Handle as plain text
        addElement('text', { text, x: pos.x, y: pos.y });
        toast.success('Text pasted');
        return;
      }

      // Priority 3: Fallback to store's internal clipboard
      ds.paste(pos.x, pos.y);
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('paste', handlePaste);
    };
  }, [zoom]);

  const handleRotate = (deg) => {
    if (!selectedEl) return;
    useDesignStore.getState().updateElementAndSave(selectedEl.id, {
      rotation: ((selectedEl.rotation || 0) + deg) % 360,
    });
  };

  const handleElementDblClick = (elId) => {
    const el = elements.find(e => e.id === elId);
    if (!el) return;
    
    if (el.type === 'barcode') {
      setShowBarcodeProps(elId);
    } else if (el.type === 'text') {
      setShowTextProps(elId);
    } else if (el.type === 'line') {
      setShowLineProps(elId);
    } else if (['rect', 'circle', 'ellipse', 'star', 'polygon', 'diamond', 'hexagon', 'octagon', 'triangle', 'arrow'].includes(el.type)) {
      setShowShapeProps(elId);
    } else if (el.type === 'image') {
      setShowImageProps(elId);
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
            Saravana Graphicss — [{title || 'Document1'}.btw {isDirty ? '*' : ''}]
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button 
          className={`bt-titlebar-save-btn${isDirty ? ' dirty' : ''}`} 
          onClick={() => handleSave(false)}
          disabled={isSaving}
          title="Save Design (Ctrl+S)"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
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
          <div className="bt-ruler-corner" />
          <div className="bt-ruler-h-wrap">
            <HRuler widthPx={canvasAreaSize.w} zoom={zoom} scrollLeft={scrollPos.x} />
            <div className="bt-ruler-unit">in</div>
          </div>

          <div className="bt-ruler-v-wrap">
            <VRuler heightPx={canvasAreaSize.h} zoom={zoom} scrollTop={scrollPos.y} />
          </div>

          <div
            ref={canvasAreaRef}
            className="bt-canvas-scroll"
            onScroll={handleCanvasScroll}
          >
            <div className="bt-canvas-inner">
              <DesignCanvas 
                stageRef={stageRef} 
                showGrid={showGrid} 
                onElementDblClick={handleElementDblClick}
              />
            </div>
            
            {selectedIds.length > 1 && (
              <div style={{
                position: 'fixed',
                bottom: 40,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#fff',
                padding: '10px 16px',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                zIndex: 1000
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#333', marginRight: 8, fontFamily: 'Segoe UI, sans-serif' }}>
                  Align to Label:
                </span>
                <button className="bt-prop-btn" onClick={() => alignElements('left')} title="Align Left"><AlignLeft size={20} /></button>
                <button className="bt-prop-btn" onClick={() => alignElements('center')} title="Align Horizontal Center"><AlignCenter size={20} /></button>
                <button className="bt-prop-btn" onClick={() => alignElements('right')} title="Align Right"><AlignRight size={20} /></button>
                <div className="bt-prop-sep" style={{ height: 24 }} />
                <button className="bt-prop-btn" onClick={() => alignElements('top')} title="Align Top"><AlignVerticalJustifyStart size={20} /></button>
                <button className="bt-prop-btn" onClick={() => alignElements('middle')} title="Align Vertical Middle"><AlignVerticalJustifyCenter size={20} /></button>
                <button className="bt-prop-btn" onClick={() => alignElements('bottom')} title="Align Bottom"><AlignVerticalJustifyEnd size={20} /></button>

                <div className="bt-prop-sep" style={{ height: 24 }} />
                <button 
                  className="bt-prop-btn" 
                  onClick={() => straightenElements()} 
                  title="Straight — Align all selected to same line as first selected"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontWeight: 600, fontSize: 12, fontFamily: 'Segoe UI, sans-serif' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><rect x="4" y="6" width="6" height="4" rx="1" fill="currentColor" opacity="0.3"/><rect x="14" y="6" width="6" height="4" rx="1" fill="currentColor" opacity="0.3"/></svg>
                  Straight
                </button>

                {selectedIds.length >= 3 && (
                  <>
                    <div className="bt-prop-sep" style={{ height: 24, marginLeft: 4, marginRight: 4 }} />
                    <button className="bt-prop-btn" onClick={() => distributeElements('x')} title="Distribute Horizontally (Equal Gaps)">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 22V2m16 20V2M8 12h8m-8-4v8m8-8v8"/>
                      </svg>
                    </button>
                    <button className="bt-prop-btn" onClick={() => distributeElements('y')} title="Distribute Vertically (Equal Gaps)">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 4H2m20 16H2M12 8v8m-4-8h8m-8 8h8"/>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>


      </div>


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

      {showShapeProps && (
        <ShapePropertiesDialog 
          elementId={showShapeProps} 
          onClose={() => setShowShapeProps(null)} 
        />
      )}

      {showTextProps && (
        <TextPropertiesDialog 
          elementId={showTextProps} 
          onClose={() => setShowTextProps(null)} 
        />
      )}

      {showLineProps && (
        <LinePropertiesDialog 
          elementId={showLineProps} 
          onClose={() => setShowLineProps(null)} 
        />
      )}

      {showImageProps && (
        <ImagePropertiesDialog 
          elementId={showImageProps} 
          onClose={() => setShowImageProps(null)} 
        />
      )}

      {showNewModal && (
        <NewDesignModal 
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input id="bt-hidden-img-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
    </div>
  );
}
