import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, FileSpreadsheet, Download,
    ArrowLeft, Search, ZoomIn, ZoomOut, Palette, Plus, X, Wand2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Line, Circle, Ellipse, Star, RegularPolygon, Path } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { designsAPI, stripColorsAPI } from '../api';
import { useUIStore, unitToPx } from '../store/uiStore';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import * as QRCode from 'qrcode';
import BarcodeElement from '../components/BarcodeElement';
import QRElement from '../components/QRElement';
import ImageElement from '../components/ImageElement';
import logo from '../assets/logo.png';
import './Layout.css';

// ─── Strip Color Map ──────────────────────────────────────────────────────────
let STRIP_COLOR_MAP = {};
const resolveStripColor = (colorName) => {
    if (!colorName) return null;
    return STRIP_COLOR_MAP[String(colorName).trim().toLowerCase()] || null;
};

// ─── Render ₹ symbol to a PNG data URL using canvas ──────────────────────────
// This avoids ALL font-loading issues — works 100% offline, no CDN needed.
const rupeeImageCache = {};
const getRupeeImage = (fontSizePt, color = '#000000') => {
    const cacheKey = `${fontSizePt}_${color}`;
    if (rupeeImageCache[cacheKey]) return rupeeImageCache[cacheKey];

    const scale = 4; // retina quality
    const sizePx = Math.round(fontSizePt * 3.7795 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = color;
    ctx.font = `bold ${sizePx * 0.85}px Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText('₹', 0, sizePx * 0.05);
    const dataUrl = canvas.toDataURL('image/png');
    rupeeImageCache[cacheKey] = dataUrl;
    return dataUrl;
};

// ─── Draw text that may contain ₹ into jsPDF ─────────────────────────────────
// Splits on ₹, draws plain text segments with pdf.text() and ₹ as PNG image.
const drawRupeeText = (pdf, rawText, x, y, opts = {}) => {
    if (!rawText) return;
    const text = String(rawText);

    if (!text.includes('₹')) {
        pdf.text(text, x, y, opts);
        return;
    }

    const fs = pdf.getFontSize(); // points
    const fsMM = fs * 0.352778;   // points → mm
    // Approximate cap-height offset so image aligns with text baseline
    const imgH = fsMM * 1.05;
    const imgW = fsMM * 0.78;
    const imgY = y - fsMM * 0.88; // align top of glyph

    // Get current text color as hex
    const tc = pdf.getTextColor();
    const colorHex = typeof tc === 'string' && tc.startsWith('#') ? tc : '#000000';
    const rupeeImg = getRupeeImage(fs, colorHex);

    const parts = text.split('₹');
    let curX = x;

    // For center/right alignment we need total width first — just left-align
    // inline segments (caller should already set curX correctly for alignment)
    parts.forEach((part, i) => {
        if (part.length > 0) {
            pdf.text(part, curX, y, {});
            curX += pdf.getTextWidth(part);
        }
        if (i < parts.length - 1) {
            // Draw ₹ as image at baseline
            try {
                pdf.addImage(rupeeImg, 'PNG', curX, imgY, imgW, imgH);
            } catch (e) { /* fallback: skip silently */ }
            // imgW + 0.264mm (≈1px at 96dpi) gap before the next text segment
            curX += imgW + 0.264;
        }
    });
};

// ─── Canvas Preview Label ─────────────────────────────────────────────────────
const LayoutLabel = ({ elements = [], data = {}, mapping = {}, width, height, isBranding = false, logoImg = null }) => {
    const mergedElements = useMemo(() => {
        if (isBranding) {
            return [
                { type: 'rect', x: 0, y: 0, width, height, fill: '#ffffff' },
                logoImg ? { type: 'image', x: 0, y: 0, width, height, image: logoImg, zIndex: 10 } : null
            ].filter(Boolean);
        }

        return elements.map(el => {
            let newEl = { ...el };
            const isText = el.type === 'text' || el.type === 'placeholder';
            const manualMapped = mapping[el.id];

            // Priority 1: Manual mapping
            if (manualMapped && data[manualMapped] !== undefined) {
                const raw = String(data[manualMapped] ?? '').replace(/^₹\s*/, '');
                if (isText) {
                    const isPriceCol = manualMapped.toLowerCase().includes('mrp') || manualMapped.toLowerCase().includes('price');
                    const templateHasRupee = (el.text || '').includes('₹');
                    newEl.text = (isPriceCol && !templateHasRupee && /^\d/.test(raw)) ? '₹' + raw : raw;
                } else if (el.type === 'barcode') newEl.barcodeValue = raw;
                else if (el.type === 'qrcode') newEl.qrValue = raw;
                else if (el.type === 'rect') {
                    const mc = resolveStripColor(raw.trim());
                    if (mc) newEl.fill = mc;
                }
                return newEl;
            }

            // Priority 2: placeholder replacement
            if (isText) {
                let t = el.text || '';
                Object.keys(data).forEach(col => {
                    const ph = `{{${col}}}`;
                    if (t.includes(ph)) t = t.replaceAll(ph, String(data[col] ?? ''));
                });
                while (/₹\s*₹/.test(t)) t = t.replace(/₹\s*₹/g, '₹');
                newEl.text = t;
            }

            // Strip color for rect
            if (el.type === 'rect') {
                const elName = (el.name || '').toLowerCase();
                // Consider it a strip if named 'strip'/'color', OR if it's wide AND short (height < 50)
                const isStrip = elName.includes('strip') || elName.includes('color') || 
                               ((el.width || 0) > 80 && (el.height || 0) < 50);
                
                if (isStrip) {
                    const stripCol = Object.keys(data).find(col =>
                        col.toLowerCase().replace(/[\s_-]/g, '').includes('stripcolor') ||
                        col.toLowerCase().replace(/[\s_-]/g, '') === 'strip'
                    );
                    if (stripCol && data[stripCol]) {
                        const mc = resolveStripColor(String(data[stripCol]).trim());
                        if (mc) newEl.fill = mc;
                    }
                }
            }
            return newEl;
        });
    }, [elements, data, mapping, isBranding, logoImg, width, height]);

    const sorted = useMemo(() => [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)), [mergedElements]);

    return (
        <Group>
            <Rect width={width} height={height} fill="white" stroke="#e2e8f0" strokeWidth={1} cornerRadius={8} />
            {sorted.map((el, i) => {
                const key = el.id || `el-${i}`;
                const common = {
                    x: el.x || 0, y: el.y || 0,
                    rotation: el.rotation || 0,
                    scaleX: ((el.type === 'text' || el.type === 'placeholder') && el.wrap === 'none') ? 1 : (el.scaleX || 1),
                    scaleY: ((el.type === 'text' || el.type === 'placeholder') && el.wrap === 'none') ? 1 : (el.scaleY || 1),
                    opacity: el.opacity !== undefined ? el.opacity : 1,
                    visible: el.visible !== false,
                };
                switch (el.type) {
                    case 'text':
                    case 'placeholder':
                        return <Text key={key} {...common} text={el.text || ''} fontSize={el.fontSize || 12}
                            fontFamily={el.fontFamily || 'Arial'}
                            fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                            align={el.textAlign || 'left'} fill={el.fill || '#000000'}
                            width={(el.wrap === 'none' || (el.width || 200) < 20) ? undefined : (el.width || 200)}
                            wrap={(el.width || 200) < 20 ? 'none' : (el.wrap || 'word')}
                            letterSpacing={el.letterSpacing || 0}
                            lineHeight={el.lineHeight || 1.2}
                            textDecoration={el.underline ? 'underline' : 'none'} />;
                    case 'rect':
                        return <Rect key={key} {...common} width={el.width || 0} height={el.height || 0}
                            fill={el.fill || 'transparent'} cornerRadius={el.cornerRadius || 0}
                            stroke={el.stroke || 'transparent'} strokeWidth={el.strokeWidth || 0} />;
                    case 'line':
                        return <Line key={key} {...common} points={el.points || [0, 0, 100, 0]}
                            stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth || 1} />;
                    case 'circle':
                        return <Circle key={key} {...common} radius={el.radius || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'ellipse':
                        return <Ellipse key={key} {...common} radiusX={el.radiusX || 10} radiusY={el.radiusY || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'barcode':
                        return <BarcodeElement key={key} {...common} el={el} onSelect={() => { }} />;
                    case 'qrcode':
                        return <QRElement key={key} {...common} el={el} onSelect={() => { }} />;
                    case 'image':
                        if (el.image) return <KImage key={key} {...common} image={el.image} width={el.width} height={el.height} />;
                        return <ImageElement key={key} {...common} el={el} />;
                    default:
                        return null;
                }
            })}
        </Group>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Layout() {
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useUIStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [manualMapping, setManualMapping] = useState({});
    const [templateFields, setTemplateFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1.0);
    const [logoImg, setLogoImg] = useState(null);
    const [brandingImg, setBrandingImg] = useState(null);
    const [stripColors, setStripColors] = useState([]);
    const [showStripManager, setShowStripManager] = useState(false);
    const [showExplorer, setShowExplorer] = useState(false);
    const stageRef = useRef();

    // 1 px = 0.264583 mm  (96 DPI)
    const PX_TO_MM = 0.264583;

    useEffect(() => {
        const img = new window.Image();
        img.src = logo;
        img.onload = () => setLogoImg(img);
        fetchStripColors();
        fetchDesigns();
    }, []);

    const defaultCMYKColors = [
        { _id: 'def-blue', name: 'Blue', hex: '#0d5ce3', cmyk: '95,64,11,0' },
        { _id: 'def-red', name: 'Red', hex: '#ff0000', cmyk: '0,100,100,0' },
        { _id: 'def-orange', name: 'Orange', hex: '#ff6600', cmyk: '0,60,100,0' },
        { _id: 'def-green', name: 'Green', hex: '#00ff00', cmyk: '100,0,100,0' },
        { _id: 'def-purple', name: 'Purple', hex: '#8526d6', cmyk: '48,85,16,0' },
    ];

    const fetchStripColors = async () => {
        try {
            // Load default CMYK colors first
            let colors = [...defaultCMYKColors];
            
            try {
                const res = await stripColorsAPI.getAll();
                if (res?.data?.colors) {
                    colors = [...colors, ...res.data.colors];
                }
            } catch (err) { console.warn('Could not fetch custom strip colors from API'); }

            setStripColors(colors);
            const map = {};
            colors.forEach(c => { map[c.name.toLowerCase()] = c.hex; });
            STRIP_COLOR_MAP = map;
        } catch (err) { console.error(err); }
    };

    const fetchDesigns = async () => {
        try {
            setLoading(true);
            const res = await designsAPI.getAll();
            setTemplates(res?.data?.designs || []);
        } catch { toast.error('Failed to load designs'); }
        finally { setLoading(false); }
    };

    // State for manual CMYK color adder
    const [cmykInput, setCmykInput] = useState({ name: '', c: 0, m: 0, y: 0, k: 0 });

    const handleAddCMYKColor = async () => {
        if (!cmykInput.name.trim()) return toast.error('Enter a color name');
        
        // CMYK to RGB conversion
        const c = cmykInput.c / 100;
        const m = cmykInput.m / 100;
        const y = cmykInput.y / 100;
        const k = cmykInput.k / 100;
        
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        
        // RGB to HEX
        const rgbToHex = (v) => v.toString(16).padStart(2, '0');
        const hex = `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`.toUpperCase();

        const newColor = {
            _id: `custom-${Date.now()}`,
            name: cmykInput.name.trim(),
            hex: hex,
            cmyk: `${cmykInput.c},${cmykInput.m},${cmykInput.y},${cmykInput.k}`
        };

        const updatedColors = [...stripColors, newColor];
        setStripColors(updatedColors);
        STRIP_COLOR_MAP[newColor.name.toLowerCase()] = hex;
        
        setCmykInput({ name: '', c: 0, m: 0, y: 0, k: 0 });
        toast.success(`${newColor.name} added with Hex ${hex}`);

        // Try to save to API if available
        try {
            await stripColorsAPI.create({ name: newColor.name, hex });
        } catch(e) {}
    };

    const handleSelectTemplate = async (designId) => {
        if (!designId) { setSelectedTemplate(null); setTemplateFields([]); return; }
        try {
            setLoading(true);
            const res = await designsAPI.getById(designId);
            const design = res.data.design;
            setSelectedTemplate(design);

            const fields = [];
            design.elements.forEach(el => {
                if (!['text', 'placeholder', 'barcode', 'qrcode', 'rect'].includes(el.type)) return;
                
                if (el.type === 'rect') {
                    const elName = (el.name || '').toLowerCase();
                    const isStrip = elName.includes('strip') || elName.includes('color') || 
                                   ((el.width || 0) > 80 && (el.height || 0) < 50);
                    if (isStrip) {
                        const lbl = el.fieldName || el.name || 'Strip Color';
                        fields.push({ id: el.id, name: el.fieldName || el.name || 'strip', type: 'rect', label: lbl });
                    }
                    return;
                }

                const matches = el.text?.match(/{{(.*?)}}/g);
                if (matches) {
                    matches.forEach(m => {
                        const name = m.replace(/{{|}}/g, '');
                        if (!fields.find(f => f.name === name))
                            fields.push({ id: el.id, name, type: 'placeholder', label: `{{${name}}}` });
                    });
                } else {
                    const lbl = el.fieldName || el.text || el.name || `Field ${el.id.slice(0, 4)}`;
                    fields.push({ id: el.id, name: el.fieldName || el.text, type: el.type, label: lbl.length > 30 ? lbl.slice(0, 30) + '…' : lbl });
                }
            });
            setTemplateFields(fields);

            if (columns.length > 0) {
                const nm = {};
                fields.forEach(f => {
                    const m = columns.find(c => c.toLowerCase() === f.name?.toLowerCase());
                    if (m) nm[f.id] = m;
                });
                setManualMapping(nm);
            }
        } catch { toast.error('Failed to load design'); }
        finally { setLoading(false); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });

            // ── Pick the sheet with the most non-empty header columns ──────────
            // This handles workbooks where SheetNames[0] is a summary/template sheet
            // with fewer columns than the actual data sheet.
            let bestSheet = wb.Sheets[wb.SheetNames[0]];
            let bestColCount = 0;

            wb.SheetNames.forEach(name => {
                const sheet = wb.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (rows.length === 0) return;
                // Count non-empty cells in the first row (header row)
                const headerCount = rows[0].filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
                if (headerCount > bestColCount) {
                    bestColCount = headerCount;
                    bestSheet = sheet;
                }
            });

            const data = XLSX.utils.sheet_to_json(bestSheet, { defval: '', blankrows: true });

            if (data.length > 0) {
                setExcelData(data);
                // Filter out null/undefined/empty column names from merged cells or blank headers
                const cols = Object.keys(data[0]).filter(c => c && String(c).trim() !== '' && c !== '__EMPTY');
                setColumns(cols);
                toast.success(`Loaded ${data.length} records · ${cols.length} columns`);
                if (selectedTemplate) {
                    const nm = { ...manualMapping };
                    templateFields.forEach(f => {
                        if (f.name) {
                            const m = cols.find(c => c.toLowerCase() === f.name.toLowerCase());
                            if (m && !nm[f.id]) nm[f.id] = m;
                        }
                    });
                    setManualMapping(nm);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleBrandingLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new window.Image();
            img.src = ev.target.result;
            img.onload = () => setBrandingImg(img);
        };
        reader.readAsDataURL(file);
    };

    // ─── Unified text value resolver ─────────────────────────────────────────
    const resolveTextValue = (el, data, mapping) => {
        let val = el.text || '';
        // If the template element already contains ₹ we never add another one
        const templateHasRupee = val.includes('₹');

        // Step 1: explicit manual mapping
        const mapped = mapping[el.id];
        if (mapped && data[mapped] !== undefined) {
            // Strip any ₹ already in the raw data value (prevents double ₹)
            const raw = String(data[mapped] ?? '').replace(/^₹\s*/, '');
            const isPrice = mapped.toLowerCase().includes('mrp') || mapped.toLowerCase().includes('price');
            val = (isPrice && !templateHasRupee && /^\d/.test(raw)) ? '₹' + raw : raw;
            return val;
        }

        // Step 2: {{ColumnName}} placeholder replacement
        let hadPh = false;
        Object.keys(data).forEach(col => {
            const ph = `{{${col}}}`;
            if (val.includes(ph)) {
                hadPh = true;
                // Strip any ₹ already in the raw data value
                const raw = String(data[col] ?? '').replace(/^₹\s*/, '');
                const isP = col.toLowerCase().includes('mrp') || col.toLowerCase().includes('price');
                // Don't add ₹ if the template already has ₹ right before this placeholder
                const phIdx = val.indexOf(ph);
                const charBefore = phIdx > 0 ? val[phIdx - 1] : '';
                const alreadyPrefixed = charBefore === '₹';
                const rep = (isP && !alreadyPrefixed && /^\d/.test(raw)) ? '₹' + raw : raw;
                val = val.replaceAll(ph, rep);
            }
        });

        // Step 3: auto-match by element fieldName / name
        if (!hadPh) {
            const ac = Object.keys(data).find(col =>
                col.toLowerCase() === (el.fieldName || el.name || '').toLowerCase()
            );
            if (ac && data[ac] !== undefined) {
                const raw = String(data[ac] ?? '').replace(/^₹\s*/, '');
                const isP = ac.toLowerCase().includes('mrp') || ac.toLowerCase().includes('price');
                val = (isP && !templateHasRupee && /^\d/.test(raw)) ? '₹' + raw : raw;
            }
        }

        // Final cleanup: remove any accidental double rupee
        while (/₹\s*₹/.test(val)) val = val.replace(/₹\s*₹/g, '₹');

        // Auto line-break for Net Qty (TOP ... BOTTOM)
        if (/TOP/i.test(val) && /BOTTOM/i.test(val)) {
            val = val.replace(/\s+(BOTTOM)/i, '\n$1');
        }

        return val;
    };

    // ─── Vector Barcode ───────────────────────────────────────────────────────
    const drawVectorBarcode = (pdf, value, x, y, w, h, format, fill) => {
        try {
            const isEAN13 = (format || '').toUpperCase() === 'EAN13';
            if (isEAN13) {
                const L = { 0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101', 4: '0100011', 5: '0110001', 6: '0101111', 7: '0111011', 8: '0110111', 9: '0001011' };
                const G = { 0: '0100111', 1: '0110011', 2: '0011011', 3: '0100001', 4: '0011101', 5: '0111001', 6: '0000101', 7: '0010001', 8: '0001001', 9: '0010111' };
                const R = { 0: '1110010', 1: '1100110', 2: '1101100', 3: '1000010', 4: '1011100', 5: '1001110', 6: '1010000', 7: '1000100', 8: '1001000', 9: '1110100' };
                const PARITY = { 0: 'LLLLLL', 1: 'LLGLGG', 2: 'LLGGLG', 3: 'LLGGGL', 4: 'LGLLGG', 5: 'LGGLLG', 6: 'LGGGLL', 7: 'LGLGLG', 8: 'LGLGGL', 9: 'LGGLGL' };
                const s = String(value).replace(/\D/g, '').padEnd(13, '0').substring(0, 13);
                const d = s.split('').map(Number);
                const parity = PARITY[d[0]] || 'LLLLLL';
                let bits = '101';
                for (let i = 0; i < 6; i++) bits += parity[i] === 'G' ? G[d[i + 1]] : L[d[i + 1]];
                bits += '01010';
                for (let i = 0; i < 6; i++) bits += R[d[i + 7]];
                bits += '101';
                const fsPt = 5, fsMM = fsPt * 0.352778, gap = 0.1;
                const barZoneH = h - fsMM - gap, unitW = w / 109, bsX = x + unitW * 7;
                const isG = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92;
                pdf.setFillColor(fill || '#000000');
                let cx = bsX;
                for (let i = 0; i < 95;) {
                    if (bits[i] === '1') { let sp = 1; while (i + sp < 95 && bits[i + sp] === '1' && isG(i + sp) === isG(i)) sp++; pdf.rect(cx, y, unitW * sp, isG(i) ? barZoneH : barZoneH - 0.5, 'F'); cx += unitW * sp; i += sp; }
                    else { cx += unitW; i++; }
                }
                pdf.setFont('courier', 'normal'); pdf.setFontSize(fsPt);
                const ty = y + barZoneH + gap + fsMM * 0.8;
                pdf.text(s[0], x + unitW * 3.5, ty, { align: 'center' });
                for (let i = 0; i < 6; i++) pdf.text(s[i + 1], bsX + unitW * 3 + (i * 7 + 3.5) * unitW, ty, { align: 'center' });
                for (let i = 0; i < 6; i++) pdf.text(s[i + 7], bsX + unitW * 50 + (i * 7 + 3.5) * unitW, ty, { align: 'center' });
            } else {
                const bd = {};
                JsBarcode(bd, String(value || '123456789'), { format: format || 'CODE128', margin: 0 });
                const encs = bd.encodings || [];
                let total = 0; encs.forEach(e => { total += e.data.length; });
                const unitW = w / total, fsPt = 6, fsMM = fsPt * 0.352778, barH = h - fsMM - 0.5;
                pdf.setFillColor(fill || '#000000');
                let cx = x;
                encs.forEach(enc => {
                    for (let i = 0; i < enc.data.length;) {
                        if (enc.data[i] === '1') { let sp = 1; while (i + sp < enc.data.length && enc.data[i + sp] === '1') sp++; pdf.rect(cx, y, unitW * sp, barH, 'F'); cx += unitW * sp; i += sp; }
                        else { cx += unitW; i++; }
                    }
                });
                pdf.setFont('courier', 'normal'); pdf.setFontSize(fsPt);
                pdf.text(String(value), x + w / 2, y + barH + 0.5 + fsMM * 0.8, { align: 'center' });
            }
        } catch (e) { console.warn('Barcode PDF err:', e); }
    };

    // ─── PDF Label Renderer ───────────────────────────────────────────────────
    const drawVectorLabel = async (pdf, elements, data, mapping, mmX, mmY, mmW, mmH, isBranding = false, isProduction = false) => {

        const dW = selectedTemplate?.canvasWidth || selectedTemplate?.width || 166;
        const dH = selectedTemplate?.canvasHeight || selectedTemplate?.height || 387;

        const cs = Math.min(mmW / (dW * PX_TO_MM), mmH / (dH * PX_TO_MM));

        const offX = mmX + (mmW - dW * PX_TO_MM * cs) / 2;
        const offY = mmY + (mmH - dH * PX_TO_MM * cs) / 2;

        const canvasRadius = selectedTemplate?.canvasRadius || 10;
        const tagR = Math.min(4, canvasRadius * PX_TO_MM * cs);

        pdf.setFillColor('#ffffff');
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F');

        if (isBranding) {
            pdf.setFillColor('#000000');
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F');
            pdf.setDrawColor('#ffffff'); pdf.setLineWidth(0.4);
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'D');
            const g = 1;
            pdf.roundedRect(mmX + g, mmY + g, mmW - g * 2, mmH - g * 2, Math.max(0, tagR - g), Math.max(0, tagR - g), 'D');
            const bImg = brandingImg || logoImg;
            if (bImg) { try { pdf.addImage(bImg, 'PNG', mmX, mmY, mmW, mmH); } catch (e) { } }
            return;
        }

        pdf.saveGraphicsState();
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, null);
        pdf.internal.write('W n');

        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const el of sorted) {
            if (el.visible === false) continue;
            pdf.saveGraphicsState();

            const elSX = el.scaleX || 1;
            const elSY = el.scaleY || 1;
            const elRot = el.rotation || 0;

            const ex = offX + (el.x || 0) * PX_TO_MM * cs;
            const ey = offY + (el.y || 0) * PX_TO_MM * cs;
            const ew = (el.width || 0) * PX_TO_MM * cs * elSX;
            const eh = (el.height || 0) * PX_TO_MM * cs * elSY;

            // ── TEXT ─────────────────────────────────────────────────────────
            if (el.type === 'text' || el.type === 'placeholder') {
                const val = resolveTextValue(el, data, mapping);
                if (!val || val === 'Text') { pdf.restoreGraphicsState(); continue; }

                const fs = Math.max(3, (el.fontSize || 12) * 0.75 * cs);
                pdf.setFontSize(fs);

                // Set text color — needed so drawRupeeText uses correct color
                const textColor = el.fill || '#000000';
                pdf.setTextColor(textColor);

                const bold = String(el.fontWeight || '').includes('bold') || el.fontWeight === '700' || el.fontWeight === 700;
                const italic = el.fontStyle === 'italic';
                const pdfStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
                pdf.setFont('helvetica', pdfStyle);

                const align = el.textAlign || 'left';
                const wrapW = ew;

                // ── Rotated text ──────────────────────────────────────────────
                if (elRot !== 0) {
                    // For rotated text with ₹, replace with Rs. (rotation + image is complex)
                    const safeVal = val.replace(/₹/g, 'Rs.');
                    const lines = wrapW > 0 ? pdf.splitTextToSize(safeVal, wrapW) : [safeVal];
                    pdf.text(lines, ex, ey + fs * 0.352778 * 0.85, {
                        align,
                        angle: elRot,
                        lineHeightFactor: el.lineHeight || 1.2,
                    });
                    pdf.restoreGraphicsState();
                    continue;
                }

                // ── Colon-tab aligned ─────────────────────────────────────────
                const tabPos = el.tabPos || 0;
                if (tabPos > 0 && val.includes(':')) {
                    const lh = fs * 0.352778 * (el.lineHeight || 1.2);
                    val.split('\n').forEach((line, i) => {
                        const ci = line.indexOf(':');
                        const ly = ey + fs * 0.352778 * 0.85 + i * lh;
                        if (ci !== -1) {
                            drawRupeeText(pdf, line.substring(0, ci).trim(), ex, ly);
                            drawRupeeText(pdf, line.substring(ci).trim(), ex + tabPos * PX_TO_MM * cs, ly);
                        } else {
                            drawRupeeText(pdf, line, ex, ly);
                        }
                    });
                    pdf.restoreGraphicsState();
                    continue;
                }

                // ── Apply horizontal scale (Tz) for designer scaleX ──────────
                if (elSX !== 1 && elSX > 0) pdf.internal.write(`${(elSX * 100).toFixed(1)} Tz`);

                const fsMM = fs * 0.352778;
                const ty = ey + fsMM * 0.85;

                // Split into lines then draw each with rupee support
                const lines = wrapW > 0 && el.wrap !== 'none'
                    ? pdf.splitTextToSize(val.replace(/₹/g, ' ₹ ').replace(/\s{2,}/g, ' ').trim(), wrapW)
                    : [val];

                const lh = fsMM * (el.lineHeight || 1.2);

                lines.forEach((line, li) => {
                    const lineY = ty + li * lh;
                    const lineW = pdf.getTextWidth(line.replace(/₹/g, ''));

                    let lineX = ex;
                    if (align === 'center') lineX = ex + (wrapW - lineW) / 2;
                    else if (align === 'right') lineX = ex + wrapW - lineW;

                    drawRupeeText(pdf, line, lineX, lineY);
                });

                if (elSX !== 1 && elSX > 0) pdf.internal.write('100 Tz');

            // ── RECT ─────────────────────────────────────────────────────────
            } else if (el.type === 'rect') {
                let fill = el.fill;

                const elName = (el.name || '').toLowerCase();
                // Consider it a strip if named 'strip'/'color', OR if it's wide AND short (height < 50)
                const isStrip = elName.includes('strip') || elName.includes('color') || 
                               ((el.width || 0) > 80 && (el.height || 0) < 50);

                if (isStrip) {
                    const manualMapped = mapping[el.id];
                    if (manualMapped && data[manualMapped] !== undefined) {
                        const raw = String(data[manualMapped] ?? '');
                        const mc = resolveStripColor(raw.trim());
                        if (mc) fill = mc;
                    } else {
                        const sc = Object.keys(data || {}).find(col =>
                            col.toLowerCase().replace(/[\s_-]/g, '').includes('stripcolor') ||
                            col.toLowerCase().replace(/[\s_-]/g, '') === 'strip'
                        );
                        if (sc && data[sc]) { const mc = resolveStripColor(String(data[sc]).trim()); if (mc) fill = mc; }
                    }
                }

                const isLabelBorder = Math.abs(ew - mmW) < 3 && Math.abs(eh - mmH) < 3;
                const r = el.cornerRadius
                    ? Math.max(0, el.cornerRadius * PX_TO_MM * cs)
                    : (isLabelBorder ? tagR : 0);

                if (fill && fill !== 'transparent') {
                    pdf.setFillColor(fill);
                    r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'F') : pdf.rect(ex, ey, ew, eh, 'F');
                }

                if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0) {
                    if (!(isProduction && isLabelBorder)) {
                        pdf.setDrawColor(el.stroke);
                        pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * PX_TO_MM * cs));
                        r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'D') : pdf.rect(ex, ey, ew, eh, 'D');
                        if (isLabelBorder) {
                            const g = 0.8 * cs;
                            const ir = Math.max(0, r - g);
                            pdf.roundedRect(ex + g, ey + g, ew - g * 2, eh - g * 2, ir, ir, 'D');
                        }
                    }
                }

            // ── BARCODE ───────────────────────────────────────────────────────
            } else if (el.type === 'barcode') {
                let bv = el.barcodeValue || '123456789';
                const mp = mapping[el.id];
                if (mp && data[mp] !== undefined) bv = String(data[mp]);
                else { const ac = Object.keys(data || {}).find(c => c.toLowerCase() === (el.fieldName || el.name || '').toLowerCase()); if (ac) bv = String(data[ac] ?? bv); }
                drawVectorBarcode(pdf, bv, ex, ey, ew, eh * 0.9, el.barcodeFormat || 'CODE128', el.fill);

            // ── QR CODE ───────────────────────────────────────────────────────
            } else if (el.type === 'qrcode') {
                try {
                    let qv = el.qrValue || 'QR';
                    const mp = mapping[el.id];
                    if (mp && data[mp] !== undefined) qv = String(data[mp]);
                    else { const ac = Object.keys(data || {}).find(c => c.toLowerCase() === (el.fieldName || el.name || '').toLowerCase()); if (ac) qv = String(data[ac] ?? qv); }
                    const qr = QRCode.create(qv, { margin: 0 });
                    const { data: qd, size } = qr.modules;
                    const qsz = Math.min(ew, eh), cell = qsz / size;
                    pdf.setFillColor('#ffffff'); pdf.rect(ex, ey, qsz, qsz, 'F');
                    pdf.setFillColor(el.fill || '#000000');
                    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (qd[r * size + c]) pdf.rect(ex + c * cell, ey + r * cell, cell + 0.01, cell + 0.01, 'F');
                } catch (e) { console.warn('QR err:', e); }

            // ── IMAGE ─────────────────────────────────────────────────────────
            } else if (el.type === 'image') {
                const src = el.image || el.src || el.url;
                if (src) { try { pdf.addImage(src, 'PNG', ex, ey, ew, eh); } catch (e) { } }

            // ── LINE ─────────────────────────────────────────────────────────
            } else if (el.type === 'line') {
                const pts = el.points || [0, 0, 100, 0];
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * PX_TO_MM * cs));
                pdf.line(ex + pts[0] * PX_TO_MM * cs, ey + pts[1] * PX_TO_MM * cs, ex + pts[2] * PX_TO_MM * cs, ey + pts[3] * PX_TO_MM * cs);
            }

            pdf.restoreGraphicsState();
        }

        pdf.restoreGraphicsState();
    };

    // ─── Download Proof Sheet ─────────────────────────────────────────────────
    const downloadPDF = async () => {
        if (!selectedTemplate) return;
        try {
            toast.loading('Generating Proof Sheet…', { id: 'pdf' });
            const PAGE_W = 297, PAGE_H = 210;
            // No custom font needed — ₹ rendered as canvas image via drawRupeeText
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

            const dW = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const dH = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const labelW = dW * PX_TO_MM;
            const labelH = dH * PX_TO_MM;

            const hGap = 1.5, vGap = 2, hdrH = 27, mSide = 5;
            const usableW = PAGE_W - mSide * 2;
            const usableH = PAGE_H - hdrH - mSide;
            const cols = Math.max(1, Math.floor((usableW + hGap) / (labelW + hGap)));
            const rows = Math.max(1, Math.floor((usableH + vGap) / (labelH + vGap)));
            const maxPP = cols * rows;

            const drawHeader = (pg) => {
                if (logoImg) { try { pdf.addImage(logoImg, 'PNG', mSide, 4, 52, 16); } catch (e) { } }
                pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#64748b');
                pdf.text(`Saravana Graphics | NO.21/3, MG Street, Tirupur-641602 | 9360807755 | Page ${pg}`, mSide + 56, 12);
                pdf.setDrawColor('#e2e8f0'); pdf.setLineWidth(0.3);
                pdf.line(mSide, 22, PAGE_W - mSide, 22);
            };

            // ─── Step 1: Group data into pages ────────────────────────────────
            const pages = [];
            let currentPage = [];

            // The branding tag is always the first item on Page 1
            currentPage.push({ isBranding: true, data: null });

            for (const row of excelData) {
                // Empty row acts as a manual PAGE BREAK
                if (Object.values(row).every(v => v === '' || v == null)) {
                    if (currentPage.length > 0) {
                        pages.push(currentPage);
                        currentPage = [];
                    }
                    continue;
                }
                
                // If the current page is full, break to a new page
                if (currentPage.length >= maxPP) {
                    pages.push(currentPage);
                    currentPage = [];
                }
                
                currentPage.push({ isBranding: false, data: row });
            }
            if (currentPage.length > 0) pages.push(currentPage);

            // ─── Step 2: Render each page perfectly centered ──────────────────
            for (let pIdx = 0; pIdx < pages.length; pIdx++) {
                const pgItems = pages[pIdx];
                const pgNum = pIdx + 1;
                
                if (pgNum > 1) pdf.addPage();
                drawHeader(pgNum);
                
                // Calculate dynamic width based on how many columns are actually used on this page
                const colsUsed = Math.min(pgItems.length, cols);
                const gridW = colsUsed * labelW + (colsUsed - 1) * hGap;
                const dynamicMarginX = (PAGE_W - gridW) / 2; // Perfectly center this specific group
                
                for (let i = 0; i < pgItems.length; i++) {
                    const item = pgItems[i];
                    const c = i % cols;
                    const r = Math.floor(i / cols);
                    
                    const x = dynamicMarginX + c * (labelW + hGap);
                    const y = hdrH + r * (labelH + vGap);
                    
                    if (item.isBranding) {
                        await drawVectorLabel(pdf, [], {}, {}, x, y, labelW, labelH, true);
                    } else {
                        await drawVectorLabel(pdf, selectedTemplate.elements, item.data, manualMapping, x, y, labelW, labelH);
                    }
                }
            }

            pdf.save(`Proof_Sheet_${Date.now()}.pdf`);
            toast.success('Downloaded!', { id: 'pdf' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF', { id: 'pdf' });
        }
    };

    // ─── Download Individual Labels ───────────────────────────────────────────
    const downloadIndividualPDF = async () => {
        if (!selectedTemplate) return;
        try {
            toast.loading('Generating Individual Labels…', { id: 'ind' });
            const dW = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const dH = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const lW = dW * PX_TO_MM, lH = dH * PX_TO_MM;
            const ori = lW > lH ? 'landscape' : 'portrait';
            // No custom font needed — ₹ rendered as canvas image via drawRupeeText
            const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });

            let first = true;
            for (const row of excelData) {
                if (Object.values(row).every(v => v === '' || v == null)) continue;
                if (!first) pdf.addPage([lW, lH], ori);
                first = false;
                await drawVectorLabel(pdf, selectedTemplate.elements, row, manualMapping, 0, 0, lW, lH, false, true);
            }
            pdf.save(`Labels_${Date.now()}.pdf`);
            toast.success('Downloaded!', { id: 'ind' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate labels', { id: 'ind' });
        }
    };

    // ─── Canvas preview dimensions ────────────────────────────────────────────
    const getDesignPx = () => {
        if (!selectedTemplate) return { w: 166, h: 387 };
        const unit = selectedTemplate.canvasUnit || 'px';
        const w = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
        const h = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
        return { w: unit === 'px' ? w : unitToPx(w, unit), h: unit === 'px' ? h : unitToPx(h, unit) };
    };
    const { w: itemW, h: itemH } = getDesignPx();
    const colsCount = 6, spacing = 6, marginSide = 50;
    
    let requiredRows = 1;
    let tempCol = 1;
    let tempRow = 0;
    excelData.forEach(rowData => {
        if (Object.values(rowData).every(v => v === '' || v == null)) {
            if (tempCol > 0) { tempRow++; tempCol = 0; }
        } else {
            if (tempCol >= colsCount) { tempRow++; tempCol = 0; }
            tempCol++;
        }
    });
    requiredRows = Math.max(1, tempRow + 1);

    const sheetW = (itemW + spacing) * colsCount + marginSide * 2;
    const sheetH = (itemH + spacing) * requiredRows + 160;

    // ─── JSX ─────────────────────────────────────────────────────────────────
    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc' }}>

                <div className="layout-header-simple">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /></button>
                        <div>
                            <h1>Proofing Center</h1>
                            <div className="flex items-center gap-2 text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
                                <span className={selectedTemplate ? 'text-primary' : ''}>1. Design</span>
                                <span className="opacity-30">/</span>
                                <span className={excelData.length ? 'text-primary' : ''}>2. Data</span>
                                <span className="opacity-30">/</span>
                                <span className={excelData.length ? 'text-primary' : ''}>3. Review</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {excelData.length > 0 && (<>
                            <button className="btn btn-ghost btn-sm gap-2" onClick={() => setShowExplorer(!showExplorer)}>
                                <Search size={14} /> {showExplorer ? 'Hide Data' : 'Inspect Excel'}
                            </button>
                            <button className="btn btn-secondary btn-sm gap-2 px-6 shadow-lg shadow-secondary/20" onClick={downloadIndividualPDF} style={{ borderRadius: 50 }}>
                                <Download size={14} /> Download Labels
                            </button>
                            <button className="btn btn-primary btn-sm gap-2 px-6 shadow-lg shadow-primary/20" onClick={downloadPDF} style={{ borderRadius: 50 }}>
                                <Download size={14} /> Download Proof Sheet
                            </button>
                        </>)}
                    </div>
                </div>

                <div className="layout-content-grid">
                    <div className="layout-setup-sidebar">

                        <div className="setup-section">
                            <div className="section-label">1. Choose Design</div>
                            <select className="select-input-simple" value={selectedTemplate?._id || ''} onChange={e => handleSelectTemplate(e.target.value)}>
                                <option value="">-- Select Design --</option>
                                {templates.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}
                            </select>
                            {selectedTemplate && (
                                <div className="p-2 bg-primary/5 rounded-lg border border-primary/10 mt-1">
                                    <button className="btn btn-ghost btn-xs w-full gap-2 text-[10px] font-bold" onClick={() => document.getElementById('branding-upload').click()}>
                                        <Wand2 size={10} /> {brandingImg ? 'Logo Updated ✓' : 'Add Branding Logo'}
                                    </button>
                                    <input type="file" id="branding-upload" hidden accept="image/*" onChange={handleBrandingLogoUpload} />
                                </div>
                            )}
                        </div>

                        <div className="setup-section">
                            <div className="section-label">2. Upload Excel Data</div>
                            <div className={`excel-dropzone-simple ${excelData.length ? 'has-data' : ''}`} onClick={() => document.getElementById('excel-input').click()}>
                                <FileSpreadsheet size={20} className={excelData.length ? 'text-success' : 'text-muted'} />
                                <span>{excelData.length ? `${excelData.length} Rows Loaded` : 'Click to Upload Excel'}</span>
                            </div>
                            <input type="file" id="excel-input" hidden accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </div>

                        {selectedTemplate && templateFields.length > 0 && (
                            <div className="setup-section">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="section-label">3. Map Fields</div>
                                    <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                        {Object.keys(manualMapping).length} Mapped
                                    </span>
                                </div>
                                <div className="mapping-list-simple">
                                    {templateFields.map(field => (
                                        <div key={field.id} className="mapping-row">
                                            <div className="mapping-label" title={field.label}>{field.label}</div>
                                            <select
                                                className="mapping-select-mini"
                                                value={manualMapping[field.id] || ''}
                                                title={manualMapping[field.id] || 'Auto / Ignore'}
                                                onChange={e => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                                            >
                                                <option value="">— Auto / Ignore —</option>
                                                {columns.map(col => (
                                                    <option key={col} value={col} title={col}>{col}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="setup-section border-t border-muted/10 pt-6 mt-auto">
                            <button className="btn btn-ghost btn-xs w-full justify-between px-2 text-muted" onClick={() => setShowStripManager(!showStripManager)}>
                                <span className="flex items-center gap-2"><Palette size={12} /> Strip Colors</span>
                                {showStripManager ? <X size={12} /> : <Plus size={12} />}
                            </button>
                            {showStripManager && (
                                <div className="mt-2 p-2 bg-muted/5 rounded-lg border border-muted/10">
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {stripColors.map(sc => (
                                            <div key={sc._id} className="w-5 h-5 rounded-sm border border-black/10" style={{ background: sc.hex }} title={`${sc.name} (${sc.cmyk || sc.hex})`} />
                                        ))}
                                    </div>
                                    <div className="border-t border-muted/10 pt-2 flex flex-col gap-2">
                                        <input type="text" placeholder="Color Name (e.g. Yellow)" className="input-simple text-[10px] p-1 h-6" value={cmykInput.name} onChange={e => setCmykInput(p => ({ ...p, name: e.target.value }))} />
                                        <div className="flex gap-1">
                                            <input type="number" placeholder="C" className="input-simple text-[10px] p-1 h-6 w-full text-center" value={cmykInput.c || ''} onChange={e => setCmykInput(p => ({ ...p, c: Number(e.target.value) }))} title="Cyan 0-100" />
                                            <input type="number" placeholder="M" className="input-simple text-[10px] p-1 h-6 w-full text-center" value={cmykInput.m || ''} onChange={e => setCmykInput(p => ({ ...p, m: Number(e.target.value) }))} title="Magenta 0-100" />
                                            <input type="number" placeholder="Y" className="input-simple text-[10px] p-1 h-6 w-full text-center" value={cmykInput.y || ''} onChange={e => setCmykInput(p => ({ ...p, y: Number(e.target.value) }))} title="Yellow 0-100" />
                                            <input type="number" placeholder="K" className="input-simple text-[10px] p-1 h-6 w-full text-center" value={cmykInput.k || ''} onChange={e => setCmykInput(p => ({ ...p, k: Number(e.target.value) }))} title="Black 0-100" />
                                        </div>
                                        <button className="btn btn-secondary btn-xs w-full text-[10px]" onClick={handleAddCMYKColor}><Plus size={10} /> Add CMYK Color</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="layout-preview-main">
                        {!selectedTemplate || !excelData.length ? (
                            <div className="empty-preview-state">
                                <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-xl mb-6">
                                    <Layers size={32} className="text-primary/20" />
                                </div>
                                <h3>Ready to Generate Proofs</h3>
                                <p className="max-w-[200px]">Select a design and upload your Excel data to begin.</p>
                            </div>
                        ) : (
                            <div className="canvas-viewport">
                                {showExplorer && (
                                    <div className="explorer-overlay">
                                        <div className="explorer-card-simple">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Excel Inspector</h4>
                                                <button onClick={() => setShowExplorer(false)} className="text-muted hover:text-primary"><X size={16} /></button>
                                            </div>
                                    <div className="flex flex-wrap gap-1 overflow-auto max-h-[400px]">
                                        {columns.map(col => (
                                            <div key={col} title={col} className={`header-chip-mini ${Object.values(manualMapping).includes(col) ? 'mapped' : ''}`}
                                                style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {col}
                                            </div>
                                        ))}
                                    </div>
                                        </div>
                                    </div>
                                )}

                                <div className="konva-container-clean" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                                    <Stage width={sheetW} height={sheetH} ref={stageRef} className="konva-sheet-simple">
                                        <Layer>
                                            <Rect width={sheetW} height={sheetH} fill="#f1f5f9" />
                                            <Group x={marginSide} y={20}>
                                                {logoImg && <KImage image={logoImg} width={160} height={45} />}
                                                <Rect y={55} width={sheetW - marginSide * 2} height={1} fill="#e2e8f0" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={65} fontSize={10} fontFamily="Arial" fill="#94a3b8" letterSpacing={2} />
                                            </Group>
                                            <Group x={marginSide} y={110}>
                                                {/* Branding slot */}
                                                <Group x={0} y={0}>
                                                    <LayoutLabel width={itemW} height={itemH} isBranding logoImg={brandingImg || logoImg} />
                                                </Group>
                                                {(() => {
                                                    let col = 1, row = 0;
                                                    return excelData.map((rowData, i) => {
                                                        if (Object.values(rowData).every(v => v === '' || v == null)) {
                                                            if (col > 0) { row++; col = 0; } return null;
                                                        }
                                                        if (col >= colsCount) { row++; col = 0; }
                                                        
                                                        const gx = col * (itemW + spacing), gy = row * (itemH + spacing);
                                                        col++;
                                                        return (
                                                            <Group key={i} x={gx} y={gy}>
                                                                <LayoutLabel elements={selectedTemplate.elements} data={rowData} mapping={manualMapping} width={itemW} height={itemH} />
                                                            </Group>
                                                        );
                                                    });
                                                })()}
                                            </Group>
                                        </Layer>
                                    </Stage>
                                </div>

                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur shadow-2xl px-6 py-3 rounded-full border border-white">
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}><ZoomOut size={16} /></button>
                                    <span className="text-xs font-bold w-12 text-center text-primary">{Math.round(zoom * 100)}%</span>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.min(3, z + 0.1))}><ZoomIn size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}