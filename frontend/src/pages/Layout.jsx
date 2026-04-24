import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, FileSpreadsheet, ListChecks, Eye, Download,
    ArrowLeft, Search, RefreshCw, CheckCircle2, AlertCircle,
    Table, Wand2, Info, ZoomIn, ZoomOut, Palette, Plus, Trash2, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Path, Circle, Ellipse, Line, Star, RegularPolygon } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { templatesAPI, designsAPI, stripColorsAPI } from '../api';
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

// CMYK to RGB hex conversion (client-side)
const cmykToHex = (c, m, y, k) => {
    const r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
    const g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
    const b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
};

// Dynamic strip color map
let STRIP_COLOR_MAP = {};

const resolveStripColor = (colorName) => {
    if (!colorName) return null;
    const name = String(colorName).trim().toLowerCase();
    return STRIP_COLOR_MAP[name] || null;
};

// Component to render a single label within the grid
const LayoutLabel = ({ elements = [], data = {}, mapping = {}, x, y, width, height, isBranding = false, logoImg = null }) => {
    const mergedElements = useMemo(() => {
        if (isBranding) {
            return [
                { type: 'rect', x: 0, y: 0, width, height, fill: '#ffffff' },
                logoImg ? { type: 'image', x: 0, y: 0, width, height, image: logoImg, zIndex: 10 } : null
            ].filter(Boolean);
        }

        return elements.map(el => {
            let newEl = { ...el };
            const isPlaceholder = el.type === 'placeholder';
            const isText = el.type === 'text';
            let text = el.text || '';
            const manualMapping = mapping[el.id];

            // Manual Mapping Logic
            if (manualMapping && data[manualMapping] !== undefined) {
                const val = String(data[manualMapping]);
                if (isText || isPlaceholder) {
                    let textVal = val;
                    // Standardize Rupee symbol ONLY for price fields
                    const isPriceCol = manualMapping.toLowerCase().includes('mrp') || manualMapping.toLowerCase().includes('price');
                    if (isPriceCol && textVal && !textVal.includes('₹') && /^\d/.test(textVal)) {
                        textVal = '₹' + textVal;
                    }
                    newEl.text = textVal;
                } else if (el.type === 'barcode') {
                    newEl.barcodeValue = val;
                } else if (el.type === 'qrcode') {
                    newEl.qrValue = val;
                }
                return newEl;
            }

            // Fallback: Placeholder Replacement {{Header}}
            if (isText || isPlaceholder) {
                let currentText = text;
                Object.keys(data).forEach(col => {
                    const placeholder = `{{${col}}}`;
                    if (currentText.includes(placeholder)) {
                        currentText = currentText.replaceAll(placeholder, data[col] !== undefined ? String(data[col]) : '');
                    }
                });

                // Rupee symbol cleanup
                while (currentText && /₹\s*₹/.test(currentText)) {
                    currentText = currentText.replace(/₹\s*₹/g, '₹');
                }
                newEl.text = currentText;
            }

            // Strip Color Logic (unchanged)
            if (el.type === 'rect') {
                const elName = (el.name || '').toLowerCase();
                if (elName.includes('strip')) {
                    const stripCol = Object.keys(data).find(col =>
                        col.toLowerCase().replace(/[\s_-]/g, '').includes('stripcolor') ||
                        col.toLowerCase().replace(/[\s_-]/g, '') === 'strip'
                    );
                    if (stripCol && data[stripCol] !== undefined) {
                        const mappedColor = resolveStripColor(String(data[stripCol]).trim());
                        if (mappedColor) newEl.fill = mappedColor;
                    }
                }
            }

            return newEl;
        });
    }, [elements, data, mapping, isBranding, logoImg, width, height]);

    const sortedElements = useMemo(() =>
        [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
        , [mergedElements]);

    return (
        <Group x={x} y={y}>
            <Rect width={width} height={height} fill="white" stroke="#f1f5f9" strokeWidth={1} cornerRadius={10} />
            {sortedElements.map((el, i) => {
                const elementKey = el.id || `el-${i}`;
                const commonProps = {
                    x: el.x || 0,
                    y: el.y || 0,
                    rotation: el.rotation || 0,
                    scaleX: el.scaleX || 1,
                    scaleY: el.scaleY || 1,
                    opacity: el.opacity !== undefined ? el.opacity : 1,
                    visible: el.visible !== false,
                };

                switch (el.type) {
                    case 'text':
                    case 'placeholder':
                        return (
                            <Text key={elementKey} {...commonProps}
                                text={el.text || ''}
                                fontSize={el.fontSize || 12}
                                fontFamily={el.fontFamily || 'Arial'}
                                fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                align={el.textAlign || 'left'}
                                verticalAlign={el.verticalAlign || 'top'}
                                fill={el.fill || '#000000'}
                                width={el.width || 200}
                                wrap="word"
                                textDecoration={el.underline ? 'underline' : 'none'}
                                padding={el.padding || 0}
                            />
                        );
                    case 'rect':
                        return <Rect key={elementKey} {...commonProps} width={el.width || 0} height={el.height || 0} fill={el.fill || 'transparent'} cornerRadius={el.cornerRadius || 0} stroke={el.stroke || 'transparent'} strokeWidth={el.strokeWidth || 0} shadowBlur={el.shadowBlur || 0} />;
                    case 'line':
                        return <Line key={elementKey} {...commonProps} points={el.points || [0, 0, 100, 0]} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth || 1} lineCap={el.lineCap || 'round'} lineJoin={el.lineJoin || 'round'} dash={el.dash} />;
                    case 'path':
                        return <Path key={elementKey} {...commonProps} data={el.data || ''} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'circle':
                        return <Circle key={elementKey} {...commonProps} radius={el.radius || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'ellipse':
                        return <Ellipse key={elementKey} {...commonProps} radiusX={el.radiusX || 10} radiusY={el.radiusY || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'star':
                        return <Star key={elementKey} {...commonProps} innerRadius={el.innerRadius || 5} outerRadius={el.outerRadius || 10} numPoints={el.numPoints || 5} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'regularPolygon':
                        return <RegularPolygon key={elementKey} {...commonProps} sides={el.sides || 3} radius={el.radius || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                    case 'barcode':
                        return <BarcodeElement key={elementKey} {...commonProps} el={el} onSelect={() => { }} />;
                    case 'qrcode':
                        return <QRElement key={elementKey} {...commonProps} el={el} onSelect={() => { }} />;
                    case 'image':
                        if (el.image) return <KImage key={elementKey} {...commonProps} image={el.image} width={el.width} height={el.height} />;
                        return <ImageElement key={elementKey} {...commonProps} el={el} />;
                    default:
                        return null;
                }
            })}
        </Group>
    );
};

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
    const PX_TO_MM = 0.264583;

    useEffect(() => {
        const img = new window.Image();
        img.src = logo;
        img.onload = () => setLogoImg(img);
        fetchStripColors();
        fetchDesigns();
    }, []);

    const fetchStripColors = async () => {
        try {
            const res = await stripColorsAPI.getAll();
            const colors = res?.data?.colors || [];
            setStripColors(colors);
            const newMap = {};
            colors.forEach(c => { newMap[c.name.toLowerCase()] = c.hex; });
            STRIP_COLOR_MAP = newMap;
        } catch (err) { console.error(err); }
    };

    const fetchDesigns = async () => {
        try {
            setLoading(true);
            const res = await designsAPI.getAll();
            setTemplates(res?.data?.designs || []);
        } catch (err) { toast.error('Failed to load designs'); }
        finally { setLoading(false); }
    };

    const handleSelectTemplate = async (designId) => {
        if (!designId) {
            setSelectedTemplate(null);
            setTemplateFields([]);
            return;
        }
        try {
            setLoading(true);
            const res = await designsAPI.getById(designId);
            const design = res.data.design;
            setSelectedTemplate(design);

            const fields = [];
            design.elements.forEach(el => {
                // Detect Mappable Elements: text, placeholders, barcodes, qrcodes
                if (['text', 'placeholder', 'barcode', 'qrcode'].includes(el.type)) {
                    const matches = el.text?.match(/{{(.*?)}}/g);
                    if (matches) {
                        matches.forEach(m => {
                            const name = m.replace(/{{|}}/g, '');
                            if (!fields.find(f => f.name === name)) {
                                fields.push({ id: el.id, name, type: 'placeholder', label: `Placeholder: {{${name}}}` });
                            }
                        });
                    } else {
                        // Even without {{}}, treat as mappable if it has text or a fieldName
                        const fieldLabel = el.fieldName || el.text || el.name || `Field ${el.id.substring(0, 4)}`;
                        fields.push({
                            id: el.id,
                            name: el.fieldName || el.text,
                            type: el.type,
                            label: fieldLabel.length > 30 ? fieldLabel.substring(0, 30) + '...' : fieldLabel
                        });
                    }
                }
            });
            setTemplateFields(fields);

            // Auto mapping if columns exist
            if (columns.length > 0) {
                const newMapping = {};
                fields.forEach(f => {
                    const match = columns.find(c => c.toLowerCase() === f.name.toLowerCase());
                    if (match) newMapping[f.id] = match;
                });
                setManualMapping(newMapping);
            }
        } catch (err) { toast.error('Failed to load design details'); }
        finally { setLoading(false); }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
            if (data.length > 0) {
                setExcelData(data);
                const cols = Object.keys(data[0]);
                setColumns(cols);
                toast.success(`Loaded ${data.length} records`);

                // Refresh mapping
                if (selectedTemplate) {
                    const newMapping = { ...manualMapping };
                    templateFields.forEach(f => {
                        if (f.name) {
                            const match = cols.find(c => c.toLowerCase() === f.name.toLowerCase());
                            if (match && !newMapping[f.id]) newMapping[f.id] = match;
                        }
                    });
                    setManualMapping(newMapping);
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

    const drawVectorBarcode = (pdf, value, x, y, w, h, format, fill) => {
        try {
            const isEAN13 = (format || '').toUpperCase() === 'EAN13';

            if (isEAN13) {
                const L = {
                    0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101', 4: '0100011',
                    5: '0110001', 6: '0101111', 7: '0111011', 8: '0110111', 9: '0001011'
                };
                const G = {
                    0: '0100111', 1: '0110011', 2: '0011011', 3: '0100001', 4: '0011101',
                    5: '0111001', 6: '0000101', 7: '0010001', 8: '0001001', 9: '0010111'
                };
                const R = {
                    0: '1110010', 1: '1100110', 2: '1101100', 3: '1000010', 4: '1011100',
                    5: '1001110', 6: '1010000', 7: '1000100', 8: '1001000', 9: '1110100'
                };
                const PARITY = {
                    0: 'LLLLLL', 1: 'LLGLGG', 2: 'LLGGLG', 3: 'LLGGGL', 4: 'LGLLGG',
                    5: 'LGGLLG', 6: 'LGGGLL', 7: 'LGLGLG', 8: 'LGLGGL', 9: 'LGGLGL'
                };

                const s = String(value).replace(/\D/g, '').padEnd(13, '0').substring(0, 13);
                const d = s.split('').map(Number);
                const parity = PARITY[d[0]] || 'LLLLLL';

                let bits = '101';
                for (let i = 0; i < 6; i++) {
                    bits += parity[i] === 'G' ? G[d[i + 1]] : L[d[i + 1]];
                }
                bits += '01010';
                for (let i = 0; i < 6; i++) {
                    bits += R[d[i + 7]];
                }
                bits += '101'; // 95 modules total

                // ── Sizing — ALL variables defined before use ─────────────────
                const fontSizePt = 6;
                const fontSizeMM = fontSizePt * 0.352778;  // ~2.82mm
                const gapMM = 0.1; // Closer to barcode
                const digitRowH = fontSizeMM * 1.0;
                const barZoneH = h - digitRowH - gapMM;  // ✅ defined first
                const dataBarH = barZoneH - 0.6;          // ✅ uses barZoneH safely
                const guardBarH = barZoneH;                // ✅ uses barZoneH safely

                // 95 bar modules + 7 left quiet + 7 right quiet = 109 total
                const unitW = w / 109;
                const barStartX = x + unitW * 7;

                const isGuardBit = (i) =>
                    i < 3 || (i >= 45 && i < 50) || i >= 92;

                // Clip everything to element bounds
                pdf.saveGraphicsState();
                pdf.rect(x, y, w, h + 1, null);
                pdf.internal.write('W n');

                // Draw bars
                pdf.setFillColor(fill || '#000000');
                let cx = barStartX;
                for (let i = 0; i < 95;) {
                    if (bits[i] === '1') {
                        const barH = isGuardBit(i) ? guardBarH : dataBarH;
                        let span = 1;
                        while (
                            i + span < 95 &&
                            bits[i + span] === '1' &&
                            isGuardBit(i + span) === isGuardBit(i)
                        ) { span++; }
                        pdf.rect(cx, y, unitW * span, barH, 'F');
                        cx += unitW * span;
                        i += span;
                    } else {
                        cx += unitW;
                        i++;
                    }
                }

                // Draw digits
                pdf.setFont('courier', 'normal');
                pdf.setFontSize(fontSizePt);
                const textY = y + barZoneH + gapMM + fontSizeMM * 0.8;

                // Digit 0: in left quiet zone
                pdf.text(s[0], x + unitW * 3.5, textY, { align: 'center' });

                // Left group digits 1-6
                const lgStartX = barStartX + unitW * 3;
                for (let i = 0; i < 6; i++) {
                    pdf.text(s[i + 1], lgStartX + (i * 7 + 3.5) * unitW, textY, { align: 'center' });
                }

                // Right group digits 7-12
                const rgStartX = barStartX + unitW * 50;
                for (let i = 0; i < 6; i++) {
                    pdf.text(s[i + 7], rgStartX + (i * 7 + 3.5) * unitW, textY, { align: 'center' });
                }

                pdf.restoreGraphicsState();

            } else {
                // ── CODE128 / other ───────────────────────────────────────────
                const barcodeData = {};
                JsBarcode(barcodeData, value || '123456789012', {
                    format: format || 'CODE128', margin: 0
                });
                const encs = barcodeData.encodings || [];
                let totalUnits = 0;
                encs.forEach(e => { totalUnits += e.data.length; });

                const unitW = w / totalUnits;
                const fontSizePt = 8;
                const fontSizeMM = fontSizePt * 0.352778;
                const gapMM = 0.1; // Closer to barcode
                const digitRowH = fontSizeMM * 1.0;
                const barH = h - digitRowH - gapMM;

                pdf.saveGraphicsState();
                pdf.rect(x, y, w, h + 1, null);
                pdf.internal.write('W n');

                pdf.setFillColor(fill || '#000000');
                let cx = x;
                encs.forEach(enc => {
                    for (let i = 0; i < enc.data.length;) {
                        if (enc.data[i] === '1') {
                            let span = 1;
                            while (i + span < enc.data.length && enc.data[i + span] === '1') span++;
                            pdf.rect(cx, y, unitW * span, barH, 'F');
                            cx += unitW * span;
                            i += span;
                        } else {
                            cx += unitW;
                            i++;
                        }
                    }
                });

                pdf.setFont('courier', 'normal');
                pdf.setFontSize(fontSizePt);
                const textY = y + barH + gapMM + fontSizeMM * 0.8;
                pdf.text(String(value), x + w / 2, textY, { align: 'center' });

                pdf.restoreGraphicsState();
            }

        } catch (e) {
            console.warn('PDF Barcode Error:', e);
        }
    };

    const drawVectorLabel = async (pdf, elements, data, mapping, x, y, w, h, isBranding = false, isProduction = false) => {
        // x, y, w, h are in PDF units (MM)
        const mmX = x;
        const mmY = y;
        const mmW = w;
        const mmH = h;

        // Calculate scaling factor based on original design height (assumed 700px/185mm or from template)
        // We want to fit the original design height into the target mmH
        const originalDesignHeightPx = selectedTemplate?.canvasHeight || selectedTemplate?.height || 700;
        const originalDesignHeightMM = originalDesignHeightPx * PX_TO_MM;
        const contentScale = mmH / originalDesignHeightMM;

        // Base white background with 10px rounded corners (2.64mm)
        pdf.setFillColor('#ffffff');
        const tagRadius = 2.64 * contentScale; 
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagRadius, tagRadius, 'F');

        if (isBranding) {
            // Draw a black rounded rect
            pdf.setFillColor('#000000');
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagRadius, tagRadius, 'F');
            
            // Add white double outline for branding
            pdf.setDrawColor('#ffffff');
            pdf.setLineWidth(0.3 * contentScale);
            
            // Outer
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagRadius, tagRadius, 'D');
            
            // Inner (3px gap = 0.8mm)
            const gap = 0.8 * contentScale;
            const innerR = Math.max(0, tagRadius - gap);
            pdf.roundedRect(mmX + gap, mmY + gap, mmW - 2 * gap, mmH - 2 * gap, innerR, innerR, 'D');

            const bImg = brandingImg || logoImg;
            if (bImg) {
                // Fill the area with the logo
                try { pdf.addImage(bImg, 'PNG', mmX, mmY, mmW, mmH); } catch (e) { }
            }
            return;
        }

        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const el of sorted) {
            const elX = mmX + (el.x || 0) * PX_TO_MM * contentScale;
            const elY = mmY + (el.y || 0) * PX_TO_MM * contentScale;
            const elW = (el.width || 0) * PX_TO_MM * contentScale;
            const elH = (el.height || 0) * PX_TO_MM * contentScale;

            if (el.type === 'text' || el.type === 'placeholder') {
                let val = el.text || '';
                const mapped = mapping[el.id];
                if (mapped && data[mapped] !== undefined) {
                    val = String(data[mapped]);
                    const isPriceCol = mapped.toLowerCase().includes('mrp') || mapped.toLowerCase().includes('price');
                    if (isPriceCol && !val.includes('₹') && /^\d/.test(val)) val = '₹' + val;
                }
                if (!val || val === 'Text') continue;

                pdf.setTextColor(el.fill || '#000000');
                const fontSize = (el.fontSize || 12) * 0.75 * (el.scaleX || 1) * contentScale;
                pdf.setFontSize(fontSize);
                pdf.setFont('helvetica', el.fontWeight === 'bold' ? 'bold' : 'normal');

                const lines = pdf.splitTextToSize(val, elW);
                const align = el.textAlign || 'left';
                const rotation = el.rotation || 0;

                const tx = align === 'center' ? elX + elW / 2 : (align === 'right' ? elX + elW : elX);
                const ty = elY + (fontSize * 0.35);

                pdf.text(lines, tx, ty, { align, angle: -rotation }); // jsPDF uses counter-clockwise degrees for 'angle'
            } else if (el.type === 'rect') {
                let fill = el.fill;
                const elName = (el.name || '').toLowerCase();
                const isStrip = elName.includes('strip') || elName.includes('color');
                if (isStrip) continue; // Remove the marked strip as requested

                const isLabelBorder = Math.abs(elW - mmW) < 2 && Math.abs(elH - mmH) < 2;
                const radius = isLabelBorder ? 2.64 * contentScale : (el.cornerRadius || 0) * contentScale;

                if (fill && fill !== 'transparent') {
                    pdf.setFillColor(fill);
                    if (radius > 0) pdf.roundedRect(elX, elY, elW, elH, radius, radius, 'F');
                    else pdf.rect(elX, elY, elW, elH, 'F');
                }
                if (el.stroke && el.stroke !== 'transparent') {
                    if (isProduction && isLabelBorder) continue; // Skip label border in production
                    pdf.setDrawColor(el.stroke);
                    pdf.setLineWidth(0.3 * contentScale);
                    
                    // Outer border
                    if (radius > 0) pdf.roundedRect(elX, elY, elW, elH, radius, radius, 'D');
                    else pdf.rect(elX, elY, elW, elH, 'D');

                    // Inner border (Double outline with 3px gap = 0.8mm)
                    if (isLabelBorder) {
                        const gap = 0.8 * contentScale;
                        const innerR = Math.max(0, radius - gap);
                        pdf.roundedRect(elX + gap, elY + gap, elW - 2 * gap, elH - 2 * gap, innerR, innerR, 'D');
                    }
                }
            } else if (el.type === 'barcode') {
                const val = String(data[mapping[el.id]] || el.barcodeValue || '123456789012');
                const format = el.barcodeFormat || 'CODE128';
                // Reduced height for cleaner look
                drawVectorBarcode(pdf, val, elX, elY, elW, elH * 0.9, format, el.fill);
            } else if (el.type === 'qrcode') {
                try {
                    const qrVal = String(data[mapping[el.id]] || el.qrValue || 'DUMMY_QR');
                    const qr = QRCode.create(qrVal, { margin: 0 });
                    const { data: qrData, size } = qr.modules;

                    const qrSizeMM = Math.min(elW, elH);
                    const cellSize = qrSizeMM / size;

                    pdf.setFillColor('#ffffff');
                    pdf.rect(elX, elY, qrSizeMM, qrSizeMM, 'F');

                    pdf.setFillColor(el.fill || '#000000');
                    for (let row = 0; row < size; row++) {
                        for (let col = 0; col < size; col++) {
                            if (qrData[row * size + col]) {
                                pdf.rect(elX + col * cellSize, elY + row * cellSize, cellSize + 0.01, cellSize + 0.01, 'F');
                            }
                        }
                    }
                } catch (e) { console.warn('QR Error:', e); }

            } else if (el.type === 'image') {
                const imgData = el.image || el.src || el.url;
                if (imgData) {
                    const finalW = elW * (el.scaleX || 1);
                    const finalH = elH * (el.scaleY || 1);
                    try {
                        pdf.addImage(imgData, 'PNG', elX, elY, finalW, finalH);
                    } catch (e) { console.warn('Image PDF Error:', e); }
                }
            } else if (el.type === 'line') {
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth((el.strokeWidth || 1) * 0.2 * contentScale);
                const pts = el.points || [0, 0, 100, 0];
                pdf.line(elX + pts[0] * PX_TO_MM * contentScale, elY + pts[1] * PX_TO_MM * contentScale, elX + pts[2] * PX_TO_MM * contentScale, elY + pts[3] * PX_TO_MM * contentScale);
                if (el.fill && el.fill !== 'transparent') {
                    pdf.setFillColor(el.fill);
                    pdf.circle(elX, elY, (el.radius || 10) * PX_TO_MM * contentScale, 'F');
                }
                if (el.stroke && el.stroke !== 'transparent') {
                    pdf.setDrawColor(el.stroke);
                    pdf.setLineWidth((el.strokeWidth || 1) * 0.2 * contentScale);
                    pdf.circle(elX, elY, (el.radius || 10) * PX_TO_MM * contentScale, 'D');
                }
            }
        }
    };

    const downloadPDF = async () => {
        if (!selectedTemplate) return;
        try {
            toast.loading('Generating Landscape A4 Proof Sheet...', { id: 'pdf-load' });
            
            // Standard A4 dimensions in Landscape
            const PAGE_W = 297;
            const PAGE_H = 210;
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const hSpacingMM = 0.5; 
            const vSpacingMM = 3; 
            const labelW_MM = 43; 
            const labelH_MM = 90;

            const getColsForCurrentRow = (p, r) => (p === 1 && r === 0) ? 6 : 5;
            const getStartColForCurrentRow = (p, r) => (p === 1 && r > 0) ? 1 : 0;
            const maxTagsPerPage = 10;

            const getPageMarginMM = (p) => {
                const maxColsOnPage = p === 1 ? 6 : 5;
                const gridW = maxColsOnPage * labelW_MM + (maxColsOnPage - 1) * hSpacingMM;
                return (PAGE_W - gridW) / 2;
            };

            const drawHeader = (pageNum) => {
                const headerMargin = 10;
                if (logoImg) {
                    try { pdf.addImage(logoImg, 'PNG', headerMargin, 5, 60, 18); } catch (e) { }
                }
                
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor('#64748b');
                
                const addressLine = "Saravana Graphics | NO.21/3, MG Street, Tirupur - 641602 | 9360807755 | Page " + pageNum;
                pdf.text(addressLine, headerMargin + 65, 12);
                
                pdf.setDrawColor('#f1f5f9');
                pdf.line(headerMargin, 25, PAGE_W - headerMargin, 25);
            };

            let currentPage = 1;
            drawHeader(currentPage);

            let curR = 0;
            let curC = 0;
            const startY = 20; 
            let tagsOnPage = 0;

            const marginMM = getPageMarginMM(currentPage);

            // Include Branding Tag first
            await drawVectorLabel(pdf, [], {}, {}, 
                marginMM + 0 * (labelW_MM + hSpacingMM), 
                startY + 0 * (labelH_MM + vSpacingMM), 
                labelW_MM, labelH_MM, true);
            
            curC = 1; // First data tag on Page 1 starts at Col 1
            tagsOnPage = 1;

            for (let i = 0; i < excelData.length; i++) {
                const rowData = excelData[i];
                const isEmpty = Object.values(rowData).every(v => v === '' || v === undefined || v === null);

                const currentMargin = getPageMarginMM(currentPage);

                if (isEmpty) {
                    if (curC > getStartColForCurrentRow(currentPage, curR)) {
                        curR++;
                        curC = getStartColForCurrentRow(currentPage, curR);
                    }
                } else {
                    // Page break logic
                    if (tagsOnPage >= maxTagsPerPage) {
                        pdf.addPage();
                        currentPage++;
                        drawHeader(currentPage);
                        curR = 0;
                        curC = 0;
                        tagsOnPage = 0;
                    }

                    const maxCols = getColsForCurrentRow(currentPage, curR);
                    if (curC >= maxCols) {
                        curR++;
                        curC = getStartColForCurrentRow(currentPage, curR);
                    }

                    await drawVectorLabel(pdf, selectedTemplate.elements, rowData, manualMapping,
                        getPageMarginMM(currentPage) + curC * (labelW_MM + hSpacingMM),
                        startY + curR * (labelH_MM + vSpacingMM),
                        labelW_MM, labelH_MM);
                    
                    curC++;
                    tagsOnPage++;
                }
            }

            pdf.save(`Proof_Sheet_Standardized_${new Date().getTime()}.pdf`);
            toast.success('Downloaded!', { id: 'pdf-load' });
        } catch (err) {
            console.error('PDF Error:', err);
            toast.error('Failed to generate PDF', { id: 'pdf-load' });
        }
    };
    const downloadIndividualPDF = async () => {
        if (!selectedTemplate) return;
        try {
            toast.loading('Generating Individual Labels...', { id: 'label-load' });
            
            const designW_px = selectedTemplate.canvasWidth || selectedTemplate.width || 162; // fallback to 43mm in px
            const designH_px = selectedTemplate.canvasHeight || selectedTemplate.height || 340; // fallback to 90mm in px
            
            const labelW = designW_px * PX_TO_MM;
            const labelH = designH_px * PX_TO_MM;

            const pdf = new jsPDF({
                orientation: labelW > labelH ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [labelW, labelH]
            });

            for (let i = 0; i < excelData.length; i++) {
                const rowData = excelData[i];
                const isEmpty = Object.values(rowData).every(v => v === '' || v === undefined || v === null);
                if (isEmpty) continue;

                if (i > 0) pdf.addPage([labelW, labelH], labelW > labelH ? 'landscape' : 'portrait');
                
                // Draw tag at its original design size (contentScale will be 1)
                // ✅ isProduction = true to remove strip and outline
                await drawVectorLabel(pdf, selectedTemplate.elements, rowData, manualMapping, 0, 0, labelW, labelH, false, true);
            }

            pdf.save(`Individual_Labels_${new Date().getTime()}.pdf`);
            toast.success('Downloaded!', { id: 'label-load' });
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to generate labels', { id: 'label-load' });
        }
    };

    // Calculate dimensions
    const getPxWidth = () => {
        if (!selectedTemplate) return 350;
        const w = selectedTemplate.canvasWidth || selectedTemplate.width || 350;
        const unit = selectedTemplate.canvasUnit || 'px';
        return unit === 'px' ? w : unitToPx(w, unit);
    };
    const getPxHeight = () => {
        if (!selectedTemplate) return 700;
        const h = selectedTemplate.canvasHeight || selectedTemplate.height || 700;
        const unit = selectedTemplate.canvasUnit || 'px';
        return unit === 'px' ? h : unitToPx(h, unit);
    };

    // Force 43x90mm for retail tags
    const itemWidth = unitToPx(43, 'mm');
    const itemHeight = unitToPx(90, 'mm');
    const colsCount = 6; 
    const spacing = 4; // 4px gap matching spacingMM
    const marginSide = 50;
    const sheetWidth = (itemWidth + spacing) * colsCount + (marginSide * 2);
    const totalItems = excelData.length > 0 ? (Math.min(excelData.length, 10) + 1) : 1;
    const rowCount = 2;
    const sheetHeight = (itemHeight + spacing) * rowCount + 150;

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
                        {excelData.length > 0 && (
                            <>
                                <button className="btn btn-ghost btn-sm gap-2" onClick={() => setShowExplorer(!showExplorer)}>
                                    <Search size={14} /> {showExplorer ? 'Hide Data' : 'Inspect Excel'}
                                </button>
                                <button className="btn btn-secondary btn-sm gap-2 px-6 shadow-lg shadow-secondary/20" onClick={downloadIndividualPDF} style={{ borderRadius: '50px' }}>
                                    <Download size={14} /> Download Labels
                                </button>
                                <button className="btn btn-primary btn-sm gap-2 px-6 shadow-lg shadow-primary/20" onClick={downloadPDF} style={{ borderRadius: '50px' }}>
                                    <Download size={14} /> Download Proof Sheet
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="layout-content-grid">
                    <div className="layout-setup-sidebar">
                        <div className="setup-section">
                            <div className="section-label">1. Choose Design</div>
                            <select className="select-input-simple" value={selectedTemplate?._id || ''} onChange={(e) => handleSelectTemplate(e.target.value)}>
                                <option value="">-- Select Design --</option>
                                {templates.map(t => <option key={t._id} value={t._id}>{t.title}</option>)}
                            </select>
                            {selectedTemplate && (
                                <div className="p-2 bg-primary/5 rounded-lg border border-primary/10 mt-1">
                                    <button className="btn btn-ghost btn-xs w-full gap-2 text-[10px] font-bold" onClick={() => document.getElementById('branding-upload').click()}>
                                        <Wand2 size={10} /> {brandingImg ? 'Logo Updated' : 'Add Branding Logo'}
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
                            <input type="file" id="excel-input" hidden accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
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
                                                onChange={(e) => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                            >
                                                <option value="">Auto / Ignore</option>
                                                {columns.map(col => <option key={col} value={col}>{col}</option>)}
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
                                <div className="mt-2 flex flex-wrap gap-1.5 p-2 bg-muted/5 rounded-lg border border-muted/10">
                                    {stripColors.map(sc => <div key={sc._id} className="w-5 h-5 rounded-sm border border-black/10" style={{ background: sc.hex }} title={sc.name} />)}
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
                                            <div className="explorer-headers overflow-auto max-h-[400px] flex flex-wrap gap-1">
                                                {columns.map(col => (
                                                    <div key={col} className={`header-chip-mini ${Object.values(manualMapping).includes(col) ? 'mapped' : ''}`}>{col}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="konva-container-clean" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                                    <Stage width={sheetWidth} height={sheetHeight} ref={stageRef} className="konva-sheet-simple">
                                        <Layer>
                                            <Rect width={sheetWidth} height={sheetHeight} fill="white" />
                                            <Group x={marginSide} y={40}>
                                                {logoImg && <KImage image={logoImg} width={180} height={50} y={-35} x={0} />}
                                                <Rect y={25} width={sheetWidth - 100} height={1} fill="#f1f5f9" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={40} fontSize={11} fontFamily="Inter" fontWeight="600" fill="#94a3b8" letterSpacing={2} />
                                            </Group>
                                            <Group x={marginSide} y={220}>
                                                <LayoutLabel elements={[]} width={itemWidth} height={itemHeight} isBranding={true} logoImg={brandingImg || logoImg} />
                                                {(() => {
                                                    let curR = 0;
                                                    let curC = 1;
                                                    const items = [];

                                                    for (let i = 0; i < excelData.length; i++) {
                                                        const rowData = excelData[i];
                                                        const isEmpty = Object.values(rowData).every(v => v === '' || v === undefined || v === null);

                                                        if (isEmpty) {
                                                            if (curC > 0) {
                                                                curR++;
                                                                curC = 0;
                                                            }
                                                            continue;
                                                        }

                                                        if (curC >= colsCount) {
                                                            curR++;
                                                            curC = 0;
                                                        }

                                                        items.push(
                                                            <Group key={i} x={curC * (itemWidth + spacing)} y={curR * (itemHeight + spacing)}>
                                                                <LayoutLabel elements={selectedTemplate.elements} data={rowData} mapping={manualMapping} width={itemWidth} height={itemHeight} />
                                                            </Group>
                                                        );
                                                        curC++;
                                                        if (curR > 10) break;
                                                    }
                                                    return items;
                                                })()}
                                            </Group>
                                        </Layer>
                                    </Stage>
                                </div>
                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/80 backdrop-blur shadow-2xl px-6 py-3 rounded-full border border-white">
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(Math.max(0.2, zoom - 0.2))}><ZoomOut size={16} /></button>
                                    <span className="text-xs font-bold w-12 text-center text-primary">{Math.round(zoom * 100)}%</span>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(Math.min(3, zoom + 0.2))}><ZoomIn size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
