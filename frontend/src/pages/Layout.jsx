import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, FileSpreadsheet, Download,
    ArrowLeft, Search, ZoomIn, ZoomOut, Palette, Plus, X, Wand2,
    ChevronLeft,
    Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Line, Circle, Ellipse, Star, RegularPolygon, Path } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { designsAPI, stripColorsAPI } from '../api';
import { useUIStore, unitToPx } from '../store/uiStore';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import BarcodeElement from '../components/BarcodeElement';
import QRElement from '../components/QRElement';
import ImageElement from '../components/ImageElement';
import logo from '../assets/final.jpeg';
import './Layout.css';

// ─── Font cache (base64 strings cached so we only fetch once per session) ─────
const _fontCache = {};

const loadCustomFonts = async (pdf) => {
    const fontFiles = [
        { name: 'Arial', style: 'normal', file: '/fonts/Arial.ttf' },
        { name: 'Arial', style: 'bold', file: '/fonts/Arial-Bold.ttf' },
        { name: 'Arial', style: 'italic', file: '/fonts/Arial-Italic.ttf' },
        { name: 'Arial', style: 'bolditalic', file: '/fonts/Arial-Bold-Italic.ttf' },
        { name: 'Calibri', style: 'normal', file: '/fonts/Calibri.ttf' },
        { name: 'Calibri', style: 'bold', file: '/fonts/Calibri-Bold.ttf' },
        { name: 'OCR-BT', style: 'normal', file: '/fonts/OCRB.ttf' },
        { name: 'RupeeForbidan', style: 'normal', file: '/fonts/RupeeForbidan.ttf' },
    ];

    for (const font of fontFiles) {
        try {
            const fileName = font.file.split('/').pop();
            if (!_fontCache[fileName]) {
                const response = await fetch(font.file);
                if (!response.ok) {
                    console.warn(`Font fetch failed: ${font.file} (Status: ${response.status})`);
                    continue;
                }

                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html') || contentType.includes('text/plain')) {
                    console.warn(`Skipping font ${font.name}: Received ${contentType} instead of binary.`);
                    continue;
                }

                const buffer = await response.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                _fontCache[fileName] = btoa(binary);
            }

            if (_fontCache[fileName]) {
                pdf.addFileToVFS(fileName, _fontCache[fileName]);
                pdf.addFont(fileName, font.name, font.style);
            }
        } catch (e) {
            console.warn(`Font registration failed: ${font.name} ${font.style}`, e);
        }
    }
};

// ─── Resolve PDF font name from element fontFamily ────────────────────────────
const resolvePdfFont = (fontFamily = '') => {
    const ff = fontFamily.toLowerCase();
    if (ff.includes('calibri')) return 'Calibri';
    if (ff.includes('ocr')) return 'OCR-BT';
    if (ff.includes('rupee') || ff.includes('forbidan')) return 'RupeeForbidan';
    if (ff.includes('times')) return 'times';
    if (ff.includes('courier')) return 'courier';
    return 'Arial';
};

// ─── Strip Color Map ──────────────────────────────────────────────────────────
let STRIP_COLOR_MAP = {};
const resolveStripColor = (colorName) => {
    return STRIP_COLOR_MAP[String(colorName).trim().toLowerCase()] || null;
};

// ─── Format price: always show 2 decimal places ───────────────────────────────
const formatPrice = (raw) => {
    if (/^\d+(\.\d+)?$/.test(String(raw).trim())) {
        return parseFloat(raw).toFixed(2);
    }
    return String(raw).trim();
};

// ─── Format NET QTY: split TOP/BOTTOM onto separate lines ────────────────────
const formatNetQty = (val) => {
    const s = String(val || '').trim();
    if (!s) return s;
    if (/TOP/i.test(s) && /BOTTOM/i.test(s)) {
        return s.replace(/\s{1,}(BOTTOM)/i, '\n$1');
    }
    return s;
};

// ─── Check if a column name is price-related ─────────────────────────────────
const isPriceColumn = (colName) => {
    const lower = (colName || '').toLowerCase();
    return lower.includes('mrp') || lower.includes('price');
};

// ─── Render ₹ symbol to a PNG data URL using canvas ──────────────────────────
const rupeeImageCache = {};
const getRupeeImage = (fontSizePt, color = '#000000') => {
    const cacheKey = `${fontSizePt}_${color}`;
    if (rupeeImageCache[cacheKey]) return rupeeImageCache[cacheKey];
    const scale = 4;
    const sizePx = Math.round(fontSizePt * 3.7795 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = color;
    ctx.font = `${sizePx * 0.95}px "Rupee Forbidan", Arial, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('₹', sizePx / 2, sizePx / 2);
    rupeeImageCache[cacheKey] = canvas;
    return canvas;
};

// ─── Draw text that may contain ₹ into jsPDF ─────────────────────────────────
const drawRupeeText = (pdf, rawText, x, y, scaleX = 1) => {
    if (!rawText) return;
    const text = String(rawText);
    if (!text.includes('₹')) {
        pdf.text(text, x, y, {});
        return;
    }
    const fs = pdf.getFontSize();
    const fsMM = fs * 0.352778;
    const imgH = fsMM * 1.10;
    const imgW = fsMM * 0.95 * scaleX;
    const imgY = y - fsMM * 1.01;
    const tc = pdf.getTextColor();
    const colorHex = typeof tc === 'string' && tc.startsWith('#') ? tc : '#000000';
    const rupeeImg = getRupeeImage(fs, colorHex);
    const parts = text.split('₹');
    let curX = x;
    parts.forEach((part, i) => {
        if (part.length > 0) {
            pdf.text(part, curX, y, {});
            curX += pdf.getTextWidth(part) * scaleX;
        }
        if (i < parts.length - 1) {
            try { pdf.addImage(rupeeImg, 'PNG', curX, imgY, imgW, imgH); } catch (e) { }
            const gapMM = fs * 0.352778 * 0.30; // 30% of font size in mm
            curX += imgW + gapMM;
        }
    });
};

// ─── Detect label type from design object ────────────────────────────────────
const getLabelType = (design) => {
    if (!design) return 'normal';
    if (design.labelType) return design.labelType.toLowerCase();
    const title = (design.title || '').toLowerCase();
    if (title.includes('azortee') || title.includes('azorte')) return 'azortee';
    if (title.includes('livsmart')) return 'livsmart';
    return 'normal';
};

// ─── AZORTEE: Build circle→text pairing using center-to-center distance ──────
const buildAzorteeCircleMap = (elements, data) => {
    const sizeTextEls = elements.filter(textEl => {
        if (textEl.type !== 'text' && textEl.type !== 'placeholder') return false;
        const t = (textEl.text || '').trim();
        if (t.includes('{{')) return false;
        return t.length > 0 && t.length <= 6;
    });

    const circleTextMap = new Map();

    elements.forEach(circleEl => {
        const elName = (circleEl.name || '').toLowerCase();
        const isSizeCircle =
            circleEl.type === 'circle' &&
            (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'));
        if (!isSizeCircle) return;

        const cCX = circleEl.x || 0;
        const cCY = circleEl.y || 0;

        let bestText = null;
        let bestDist = Infinity;

        sizeTextEls.forEach(textEl => {
            const tX = textEl.x || 0;
            const tY = textEl.y || 0;
            const dx = cCX - tX;
            const dy = cCY - tY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestText = textEl;
            }
        });

        if (bestText && bestDist < 120) {
            let tv = bestText.text || '';
            Object.keys(data).forEach(col => {
                tv = tv.replaceAll(`{{${col}}}`, String(data[col] ?? '').trim());
            });
            circleTextMap.set(circleEl.id, tv.trim().toUpperCase());
        }
    });

    return circleTextMap;
};

// ─── Canvas Preview Label ─────────────────────────────────────────────────────
const LayoutLabel = ({
    elements = [],
    data = {},
    mapping = {},
    width,
    height,
    designW,
    designH,
    isBranding = false,
    logoImg = null,
    labelType = 'normal',
    modes = {},
}) => {
    const mergedElements = useMemo(() => {
        const sizeCol = Object.keys(data).find(
            k => k.toLowerCase() === 'size' || k.toLowerCase().includes('size')
        );
        const sizeVal = sizeCol ? String(data[sizeCol] || '').trim().toUpperCase() : '';

        if (isBranding) {
            return [
                { type: 'rect', x: 0, y: 0, width, height, fill: '#ffffff' },
                logoImg
                    ? { type: 'image', x: 0, y: 0, width, height, image: logoImg, zIndex: 10 }
                    : null,
            ].filter(Boolean);
        }

        if (labelType === 'azortee') {
            const circleTextMap = buildAzorteeCircleMap(elements, data);
            return elements.map(el => {
                const elName = (el.name || '').toLowerCase();
                const isSizeCircle =
                    el.type === 'circle' &&
                    (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'));
                if (isSizeCircle) {
                    const pairedText = circleTextMap.get(el.id) || '';
                    return { ...el, visible: !!(sizeVal && pairedText === sizeVal) };
                }
                return resolveElement(el, data, mapping, modes);
            });
        }

        if (labelType === 'livsmart') {
            const result = [];
            elements.forEach(el => {
                const resolved = resolveElement(el, data, mapping, modes);
                if (
                    (el.type === 'text' || el.type === 'placeholder') &&
                    sizeVal &&
                    !el.text?.includes('{{')
                ) {
                    const cleanText = (el.text || '').trim().toUpperCase();
                    if (cleanText === sizeVal && cleanText.length < 8) {
                        const padding = 1.5;
                        const fsPx = el.fontSize || 12;
                        const charW = fsPx * 0.6;
                        const textW = cleanText.length * charW;
                        const rectW = (el.width && el.width > 10 ? el.width : textW) + padding * 2;
                        const rectH = fsPx * 1.4;
                        result.push({
                            id: `__livsmart_rect_${el.id}`,
                            type: 'rect',
                            x: (el.x || 0) - padding,
                            y: (el.y || 0) - padding,
                            width: rectW,
                            height: rectH,
                            fill: '#000000',
                            zIndex: (el.zIndex || 0) - 0.5,
                            visible: true,
                        });
                        result.push({ ...resolved, fill: '#ffffff', isHighlightedSize: true });
                        return;
                    }
                }
                result.push(resolved);
            });
            return result;
        }

        return elements.map(el => {
            let newEl = resolveElement(el, data, mapping, modes);
            const elName = (el.name || '').toLowerCase();

            if (
                el.type === 'circle' &&
                (elName.includes('sizeindicator') || elName.includes('sizecircle'))
            ) {
                newEl.visible = false;
            }

            if (el.type === 'text' || el.type === 'placeholder') {
                const cleanV = (newEl.text || '').trim().toUpperCase();
                if (sizeVal && cleanV === sizeVal && cleanV.length < 6) {
                    newEl.fill = '#000000';
                    newEl.isHighlightedSize = true;
                }
            }

            if (el.type === 'rect') {
                const isSizeBox = elements.some(other => {
                    if (other.type !== 'text' && other.type !== 'placeholder') return false;
                    const ot = (other.text || '').trim().toUpperCase();
                    if (!sizeVal || ot !== sizeVal || ot.length >= 6) return false;
                    const dx = Math.abs((other.x || 0) - (el.x || 0));
                    const dy = Math.abs((other.y || 0) - (el.y || 0));
                    return dx <= 8 && dy <= 8;
                });
                if (isSizeBox) newEl.fill = '#000000';
            }

            return newEl;
        });
    }, [elements, data, mapping, modes, isBranding, logoImg, width, height, labelType]);

    const sorted = useMemo(
        () => [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
        [mergedElements]
    );

    const dW = designW || 166;
    const dH = designH || 387;
    const s = Math.min(width / dW, height / dH);
    const ox = (width - dW * s) / 2;
    const oy = (height - dH * s) / 2;

    return (
        <Group>
            <Rect
                width={width}
                height={height}
                fill="white"
                stroke="#e2e8f0"
                strokeWidth={1}
                cornerRadius={8}
            />
            <Group x={ox} y={oy} scaleX={s} scaleY={s}>
                {sorted.map((el, i) => {
                    const key = el.id || `el-${i}`;
                    const common = {
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
                        case 'placeholder': {
                            const txt = el.text || '';
                            const fs = el.fontSize || 12;
                            const ff = el.fontFamily || 'Arial';
                            const col = el.fill || '#000000';
                            const isItalic = el.fontStyle === 'italic';
                            const weight = el.fontWeight || 'normal';
                            const textAlign = el.textAlign || 'left';
                            const wrapWidth =
                                el.wrap === 'none' || (el.width || 200) < 20
                                    ? undefined
                                    : el.width || 200;

                            if (!txt.includes('₹')) {
                                return (
                                    <Group key={key} {...common}>
                                        <Text
                                            text={txt}
                                            fontSize={fs}
                                            fontFamily={ff}
                                            fontStyle={`${isItalic ? 'italic' : 'normal'} ${weight}`}
                                            align={textAlign}
                                            fill={col}
                                            width={wrapWidth}
                                            wrap={wrapWidth ? 'word' : 'none'}
                                            letterSpacing={el.letterSpacing || 0}
                                            lineHeight={el.lineHeight || 1.2}
                                            textDecoration={el.underline ? 'underline' : 'none'}
                                        />
                                    </Group>
                                );
                            }

                            const parts = txt.split('₹');
                            return (
                                <Group key={key} {...common}>
                                    {(() => {
                                        let currentX = 0;
                                        const items = [];
                                        const rupeeImg = getRupeeImage(fs, col);
                                        const rH = fs * 0.85;
                                        const rW = fs * 0.72;
                                        const rY = fs * 0.05;

                                        parts.forEach((p, i) => {
                                            if (p) {
                                                items.push(
                                                    <Text
                                                        key={`p-${i}`}
                                                        x={currentX}
                                                        y={0}
                                                        text={p}
                                                        fontSize={fs}
                                                        fontFamily={ff}
                                                        fontStyle={`${isItalic ? 'italic' : 'normal'} ${weight}`}
                                                        fill={col}
                                                        letterSpacing={el.letterSpacing || 0}
                                                    />
                                                );
                                                const canvas = document.createElement('canvas');
                                                const context = canvas.getContext('2d');
                                                context.font = `${fs}px ${ff}`;
                                                currentX +=
                                                    context.measureText(p).width +
                                                    (el.letterSpacing || 0);
                                            }
                                            if (i < parts.length - 1) {
                                                items.push(
                                                    <KImage
                                                        key={`r-${i}`}
                                                        x={currentX}
                                                        y={rY}
                                                        image={rupeeImg}
                                                        width={rW}
                                                        height={rH}
                                                    />
                                                );
                                                currentX += rW + 4;
                                            }
                                        });

                                        if (textAlign === 'center' && wrapWidth) {
                                            const offset = (wrapWidth - currentX) / 2;
                                            return <Group x={offset}>{items}</Group>;
                                        } else if (textAlign === 'right' && wrapWidth) {
                                            const offset = wrapWidth - currentX;
                                            return <Group x={offset}>{items}</Group>;
                                        }
                                        return items;
                                    })()}
                                </Group>
                            );
                        }
                        case 'rect':
                            return (
                                <Rect
                                    key={key}
                                    {...common}
                                    width={el.width || 0}
                                    height={el.height || 0}
                                    fill={el.fill || 'transparent'}
                                    cornerRadius={el.cornerRadius || 0}
                                    stroke={el.stroke || 'transparent'}
                                    strokeWidth={el.strokeWidth || 0}
                                />
                            );
                        case 'line':
                            return (
                                <Line
                                    key={key}
                                    {...common}
                                    points={el.points || [0, 0, 100, 0]}
                                    stroke={el.stroke || '#000000'}
                                    strokeWidth={el.strokeWidth || 1}
                                />
                            );
                        case 'circle':
                            return (
                                <Circle
                                    key={key}
                                    {...common}
                                    radius={el.radius || 10}
                                    fill={el.fill}
                                    stroke={el.stroke}
                                    strokeWidth={el.strokeWidth || 0}
                                />
                            );
                        case 'ellipse':
                            return (
                                <Ellipse
                                    key={key}
                                    {...common}
                                    radiusX={el.radiusX || 10}
                                    radiusY={el.radiusY || 10}
                                    fill={el.fill}
                                    stroke={el.stroke}
                                    strokeWidth={el.strokeWidth || 0}
                                />
                            );
                        case 'barcode':
                            return (
                                <BarcodeElement key={key} {...common} el={el} onSelect={() => { }} />
                            );
                        case 'qrcode':
                            return <QRElement key={key} {...common} el={el} onSelect={() => { }} />;
                        case 'image':
                            if (el.image)
                                return (
                                    <KImage
                                        key={key}
                                        {...common}
                                        image={el.image}
                                        width={el.width}
                                        height={el.height}
                                    />
                                );
                            return <ImageElement key={key} {...common} el={el} />;
                        default:
                            return null;
                    }
                })}
            </Group>
        </Group>
    );
};

// ─── Helper: resolve a single element's dynamic values from data/mapping ──────
function resolveElement(el, data, mapping, modes = {}) {
    let newEl = { ...el };
    const elName = (el.name || '').toLowerCase();
    const manualMapped = mapping[el.id];
    const isPlaceholder = el.type === 'placeholder' || (el.text && el.text.includes('{{'));
    const isBarcodeQR = el.type === 'barcode' || el.type === 'qrcode';
    const isRect = el.type === 'rect';

    if (
        manualMapped &&
        data[manualMapped] !== undefined &&
        (isPlaceholder || isBarcodeQR || isRect)
    ) {
        const raw = String(data[manualMapped] ?? '').replace(/^[₹\s]+/, '').trim();
        const forcedMode = modes[el.id];

        if (forcedMode === 'qrcode') {
            newEl.type = 'qrcode';
            newEl.qrValue = raw;
            return newEl;
        }
        if (forcedMode === 'ean13') {
            newEl.type = 'barcode';
            newEl.barcodeValue = raw;
            newEl.barcodeFormat = 'EAN13';
            return newEl;
        }
        if (forcedMode === 'barcode') {
            newEl.type = 'barcode';
            newEl.barcodeValue = raw;
            newEl.barcodeFormat = 'CODE128';
            return newEl;
        }
        if (forcedMode === 'text') {
            newEl.type = 'text';
            newEl.text = raw;
            return newEl;
        }
        if (el.type === 'text' || el.type === 'placeholder') {
            const isPrice = isPriceColumn(manualMapped);
            newEl.text = formatNetQty(isPrice ? formatPrice(raw) : raw);
        } else if (el.type === 'barcode') {
            newEl.barcodeValue = raw;
        } else if (el.type === 'qrcode') {
            newEl.qrValue = raw;
        } else if (el.type === 'rect') {
            const mc = resolveStripColor(raw.trim());
            if (mc) newEl.fill = mc;
        }
        return newEl;
    }

    if (el.type === 'barcode' && !manualMapped) {
        const eanCol = Object.keys(data || {}).find(
            c => c.toLowerCase().includes('ean')
        );
        if (eanCol && data[eanCol] !== undefined) {
            newEl.barcodeValue = String(data[eanCol] ?? '').replace(/^[₹\s]+/, '').trim();
        }
    }

    if (el.type === 'text' || el.type === 'placeholder') {
        let t = el.text || '';
        Object.keys(data).forEach(col => {
            const ph = `{{${col}}}`;
            if (t.includes(ph)) {
                const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
                t = t.replaceAll(ph, isPriceColumn(col) ? formatPrice(raw) : raw);
            }
        });
        newEl.text = formatNetQty(t);
    }

    if (el.type === 'rect') {
        const isStrip =
            elName.includes('strip') ||
            elName.includes('color') ||
            ((el.width || 0) > 80 && (el.height || 0) < 50);
        if (isStrip) {
            const stripCol = Object.keys(data).find(col => {
                const norm = col.toLowerCase().replace(/[\s_-]/g, '');
                return norm.includes('stripcolor') || norm === 'strip';
            });
            if (stripCol && data[stripCol]) {
                const mc = resolveStripColor(String(data[stripCol]).trim());
                if (mc) newEl.fill = mc;
            }
        }
    }

    return newEl;
}

// ─── QR Value Resolver (centralised, used by both preview and PDF) ────────────
function resolveQRValue(el, data, mapping) {
    // Check manual mapping first
    const mp = mapping[el.id];
    if (mp && data[mp] !== undefined) {
        return String(data[mp] ?? '').replace(/^[₹\s]+/, '').trim();
    }

    // Check all possible property names on the element itself
    const direct =
        el.qrValue ||
        el.value ||
        el.barcodeValue ||
        el.qrcode ||
        el.data ||
        '';

    if (direct && direct !== 'QR' && direct !== '') {
        return String(direct).trim();
    }

    // Try matching by fieldName or element name against data columns
    const fieldKey = (el.fieldName || el.name || '').toLowerCase();
    if (fieldKey) {
        const matchedCol = Object.keys(data || {}).find(
            c => c.toLowerCase() === fieldKey
        );
        if (matchedCol && data[matchedCol] !== undefined) {
            return String(data[matchedCol] ?? '').replace(/^[₹\s]+/, '').trim();
        }
    }

    // Auto-match columns containing 'qr'
    const qrCol = Object.keys(data || {}).find(
        c => c.toLowerCase().includes('qr')
    );
    if (qrCol && data[qrCol] !== undefined) {
        return String(data[qrCol] ?? '').replace(/^[₹\s]+/, '').trim();
    }

    return '';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Layout() {
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useUIStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [manualMapping, setManualMapping] = useState({});
    const [mappingModes, setMappingModes] = useState({});
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

    const corelPalette = [
        { name: 'P Yellow 10', cmyk: '0,0,10,0', hex: '#FFFBE6' },
        { name: 'P Yellow 20', cmyk: '0,0,20,0', hex: '#FFF7CC' },
        { name: 'P Yellow 40', cmyk: '0,0,40,0', hex: '#FFF099' },
        { name: 'P Yellow 60', cmyk: '0,0,60,0', hex: '#FFE966' },
        { name: 'Process Yellow', cmyk: '0,0,100,0', hex: '#FFED00' },
        { name: 'Golden Yellow', cmyk: '0,20,100,0', hex: '#FFCC00' },
        { name: 'Orange Yellow', cmyk: '0,30,100,0', hex: '#FFB300' },
        { name: 'Light Orange', cmyk: '0,40,100,0', hex: '#FF9900' },
        { name: 'Process Orange', cmyk: '0,60,100,0', hex: '#F7941E' },
        { name: 'Deep Orange', cmyk: '0,80,100,0', hex: '#D95E1F' },
        { name: 'Light Red', cmyk: '0,80,80,0', hex: '#F15A29' },
        { name: 'Press Red', cmyk: '0,100,100,0', hex: '#ED1C24' },
        { name: 'Deep Red', cmyk: '0,100,100,20', hex: '#BE1E23' },
        { name: 'Maroon', cmyk: '0,100,100,50', hex: '#800000' },
        { name: 'P Magenta 20', cmyk: '0,20,0,0', hex: '#FADEEF' },
        { name: 'P Magenta 40', cmyk: '0,40,0,0', hex: '#F5BEDB' },
        { name: 'P Magenta 60', cmyk: '0,60,0,0', hex: '#F09EC7' },
        { name: 'Process Magenta', cmyk: '0,100,0,0', hex: '#EC008C' },
        { name: 'Deep Magenta', cmyk: '20,100,0,0', hex: '#B9006E' },
        { name: 'Wine', cmyk: '40,100,40,20', hex: '#7A0026' },
        { name: 'Lavender', cmyk: '20,20,0,0', hex: '#E6E6FA' },
        { name: 'Light Purple', cmyk: '40,40,0,0', hex: '#B2B2D8' },
        { name: 'Purple', cmyk: '60,60,0,0', hex: '#92278F' },
        { name: 'Royal Purple', cmyk: '80,80,0,0', hex: '#662D91' },
        { name: 'Deep Purple', cmyk: '100,100,0,0', hex: '#2E3192' },
        { name: 'Violet', cmyk: '40,100,0,0', hex: '#A84FB0' },
        { name: 'Dark Violet', cmyk: '60,100,20,0', hex: '#6D2D91' },
        { name: 'P Cyan 20', cmyk: '20,0,0,0', hex: '#E0F4FB' },
        { name: 'P Cyan 40', cmyk: '40,0,0,0', hex: '#B3E5F6' },
        { name: 'P Cyan 60', cmyk: '60,0,0,0', hex: '#80D1F1' },
        { name: 'Process Cyan', cmyk: '100,0,0,0', hex: '#00AEEF' },
        { name: 'Sky Blue', cmyk: '100,20,0,0', hex: '#0093D1' },
        { name: 'Royal Blue', cmyk: '100,60,0,0', hex: '#2E3192' },
        { name: 'Navy Blue', cmyk: '100,100,0,40', hex: '#000080' },
        { name: 'Dark Navy', cmyk: '100,100,20,60', hex: '#00004D' },
        { name: 'Teal Blue', cmyk: '100,40,40,0', hex: '#0071BC' },
        { name: 'Light Teal', cmyk: '40,0,20,0', hex: '#B3E5E1' },
        { name: 'Teal', cmyk: '100,0,40,0', hex: '#00A99D' },
        { name: 'Dark Teal', cmyk: '100,40,60,20', hex: '#005E5E' },
        { name: 'Light Green', cmyk: '20,0,40,0', hex: '#E6F4E0' },
        { name: 'Lime', cmyk: '40,0,100,0', hex: '#D9E021' },
        { name: 'Press Green', cmyk: '100,0,100,0', hex: '#00A651' },
        { name: 'Forest Green', cmyk: '100,0,100,40', hex: '#006837' },
        { name: 'Deep Green', cmyk: '100,40,100,20', hex: '#00401A' },
        { name: 'Olive', cmyk: '40,40,100,20', hex: '#808000' },
        { name: 'Beige', cmyk: '0,10,20,10', hex: '#E6D2B3' },
        { name: 'Sand', cmyk: '0,20,40,10', hex: '#D7B58E' },
        { name: 'Tan', cmyk: '20,40,60,0', hex: '#C69C6D' },
        { name: 'Gold', cmyk: '0,20,100,20', hex: '#C69C23' },
        { name: 'Bronze', cmyk: '0,50,100,40', hex: '#996633' },
        { name: 'Brown', cmyk: '0,60,100,60', hex: '#754C24' },
        { name: 'Chocolate', cmyk: '40,70,100,50', hex: '#42210B' },
        { name: 'White', cmyk: '0,0,0,0', hex: '#FFFFFF' },
        { name: 'Grey 10', cmyk: '0,0,0,10', hex: '#E6E7E8' },
        { name: 'Grey 20', cmyk: '0,0,0,20', hex: '#D1D3D4' },
        { name: 'Grey 30', cmyk: '0,0,0,30', hex: '#A7A9AC' },
        { name: 'Grey 40', cmyk: '0,0,0,40', hex: '#939598' },
        { name: 'Grey 50', cmyk: '0,0,0,50', hex: '#808285' },
        { name: 'Grey 60', cmyk: '0,0,0,60', hex: '#6D6E71' },
        { name: 'Grey 70', cmyk: '0,0,0,70', hex: '#58595B' },
        { name: 'Grey 80', cmyk: '0,0,0,80', hex: '#414042' },
        { name: 'Grey 90', cmyk: '0,0,0,90', hex: '#231F20' },
        { name: 'Process Black', cmyk: '0,0,0,100', hex: '#000000' },
    ];

    const defaultCMYKColors = [
        { _id: 'def-blue', name: 'Blue', hex: '#0d5ce3', cmyk: '95,64,11,0' },
        { _id: 'def-red', name: 'Red', hex: '#ff0000', cmyk: '0,100,100,0' },
        { _id: 'def-orange', name: 'Orange', hex: '#ff6600', cmyk: '0,60,100,0' },
        { _id: 'def-green', name: 'Green', hex: '#00ff00', cmyk: '100,0,100,0' },
        { _id: 'def-purple', name: 'Purple', hex: '#8526d6', cmyk: '48,85,16,0' },
    ];

    const fetchStripColors = async () => {
        try {
            let colors = [...defaultCMYKColors];
            try {
                const res = await stripColorsAPI.getAll();
                if (res?.data?.colors) colors = [...colors, ...res.data.colors];
            } catch (err) {
                console.warn('Could not fetch custom strip colors from API');
            }
            setStripColors(colors);
            const map = {};
            colors.forEach(c => {
                map[c.name.toLowerCase()] = c.hex;
            });
            STRIP_COLOR_MAP = map;
        } catch (err) {
            console.error(err);
        }
    };

    const fetchDesigns = async () => {
        try {
            setLoading(true);
            const res = await designsAPI.getAll();
            setTemplates(res?.data?.designs || []);
        } catch {
            toast.error('Failed to load designs');
        } finally {
            setLoading(false);
        }
    };

    const [cmykInput, setCmykInput] = useState({ name: '', c: 0, m: 0, y: 0, k: 0 });

    const handleDeleteColor = async (e, colorId) => {
        e.stopPropagation();
        try {
            const updated = stripColors.filter(c => c._id !== colorId);
            setStripColors(updated);
            const map = {};
            updated.forEach(c => {
                map[c.name.toLowerCase()] = c.hex;
            });
            STRIP_COLOR_MAP = map;
            toast.success('Color removed');
            if (
                !String(colorId).startsWith('custom-') &&
                !String(colorId).startsWith('def-')
            ) {
                await stripColorsAPI.delete(colorId);
            }
        } catch (err) {
            toast.error('Failed to delete color');
        }
    };

    const handleAddCMYKColor = async () => {
        if (!cmykInput.name.trim()) return toast.error('Enter a color name');
        const c = cmykInput.c / 100,
            m = cmykInput.m / 100,
            y = cmykInput.y / 100,
            k = cmykInput.k / 100;
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        const rgbToHex = v => v.toString(16).padStart(2, '0');
        const hex = `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`.toUpperCase();
        const newColor = {
            _id: `custom-${Date.now()}`,
            name: cmykInput.name.trim(),
            hex,
            cmyk: `${cmykInput.c},${cmykInput.m},${cmykInput.y},${cmykInput.k}`,
        };
        const updatedColors = [...stripColors, newColor];
        setStripColors(updatedColors);
        STRIP_COLOR_MAP[newColor.name.toLowerCase()] = hex;
        setCmykInput({ name: '', c: 0, m: 0, y: 0, k: 0 });
        toast.success(`${newColor.name} added with Hex ${hex}`);
        try {
            await stripColorsAPI.create({ name: newColor.name, hex });
        } catch (e) { }
    };

    const handleSelectTemplate = async designId => {
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
                if (
                    !['text', 'placeholder', 'barcode', 'qrcode', 'rect'].includes(el.type)
                )
                    return;
                if (el.type === 'rect') {
                    const elName = (el.name || '').toLowerCase();
                    const isStrip =
                        elName.includes('strip') ||
                        elName.includes('color') ||
                        ((el.width || 0) > 80 && (el.height || 0) < 50);
                    if (isStrip) {
                        const lbl = el.fieldName || el.name || 'Strip Color';
                        fields.push({
                            id: el.id,
                            name: el.fieldName || el.name || 'strip',
                            type: 'rect',
                            label: lbl,
                        });
                    }
                    return;
                }
                const matches = el.text?.match(/{{(.*?)}}/g);
                if (matches) {
                    matches.forEach(m => {
                        const name = m.replace(/{{|}}/g, '');
                        if (!fields.find(f => f.name === name))
                            fields.push({
                                id: el.id,
                                name,
                                type: 'placeholder',
                                label: `{{${name}}}`,
                            });
                    });
                } else if (el.type !== 'text') {
                    const lbl =
                        el.fieldName || el.text || el.name || `Field ${el.id.slice(0, 4)}`;
                    fields.push({
                        id: el.id,
                        name: el.fieldName || el.text,
                        type: el.type,
                        label: lbl.length > 30 ? lbl.slice(0, 30) + '…' : lbl,
                    });
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
        } catch {
            toast.error('Failed to load design');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            let bestSheet = wb.Sheets[wb.SheetNames[0]];
            let bestColCount = 0;
            wb.SheetNames.forEach(name => {
                const sheet = wb.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (rows.length === 0) return;
                const headerCount = rows[0].filter(
                    c => c !== null && c !== undefined && String(c).trim() !== ''
                ).length;
                if (headerCount > bestColCount) {
                    bestColCount = headerCount;
                    bestSheet = sheet;
                }
            });
            const data = XLSX.utils.sheet_to_json(bestSheet, { defval: '', blankrows: true });
            if (data.length > 0) {
                setExcelData(data);
                const cols = Object.keys(data[0]).filter(
                    c => c && String(c).trim() !== '' && c !== '__EMPTY'
                );
                setColumns(cols);
                toast.success(`Loaded ${data.length} records · ${cols.length} columns`);
                if (selectedTemplate) {
                    const nm = { ...manualMapping };
                    templateFields.forEach(f => {
                        if (f.name) {
                            const m = cols.find(
                                c => c.toLowerCase() === f.name.toLowerCase()
                            );
                            if (m && !nm[f.id]) nm[f.id] = m;
                        }
                    });
                    setManualMapping(nm);
                }
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleBrandingLogoUpload = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new window.Image();
            img.src = ev.target.result;
            img.onload = () => setBrandingImg(img);
        };
        reader.readAsDataURL(file);
    };

    // ─── Unified text value resolver ─────────────────────────────────────────
    const resolveTextValue = (el, data, mapping) => {
        let val = el.text || '';
        const mapped = mapping[el.id];
        const isPlaceholder = el.type === 'placeholder' || (el.text && el.text.includes('{{'));
        const isBarcodeQR = el.type === 'barcode' || el.type === 'qrcode';
        const isRect = el.type === 'rect';

        if (mapped && data[mapped] !== undefined && (isPlaceholder || isBarcodeQR || isRect)) {
            const raw = String(data[mapped] ?? '').replace(/^[₹\s]+/, '').trim();
            const isPrice = isPriceColumn(mapped);
            val = isPrice ? formatPrice(raw) : raw;
            return formatNetQty(val);
        }

        let hadPh = false;
        Object.keys(data).forEach(col => {
            const ph = `{{${col}}}`;
            if (val.includes(ph)) {
                hadPh = true;
                const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
                const isPrice = isPriceColumn(col);
                const formatted = isPrice ? formatPrice(raw) : raw;
                val = val.replaceAll(ph, formatted);
            }
        });

        if (
            !hadPh &&
            el.fieldName &&
            (isBarcodeQR || isRect || el.type === 'placeholder')
        ) {
            const ac = Object.keys(data).find(
                col => col.toLowerCase() === el.fieldName.toLowerCase()
            );
            if (ac && data[ac] !== undefined) {
                const raw = String(data[ac] ?? '').replace(/^[₹\s]+/, '').trim();
                val = raw;
            }
        }

        while (/₹\s*₹/.test(val)) val = val.replace(/₹\s*₹/g, '₹');
        val = formatNetQty(val);
        return val;
    };

    const renderQRAtPos = async (pdf, qv, qx, qy, qsz, fill = '#000000') => {
        try {
            const dataUrl = await QRCode.toDataURL(qv, {
                margin: 1,
                errorCorrectionLevel: 'M',
                width: 512,
                color: { dark: fill || '#000000', light: '#ffffff' },
            });
            const base64Data = dataUrl.split(',')[1];
            pdf.addImage(base64Data, 'PNG', qx, qy, qsz, qsz);
        } catch (e) {
            console.warn('QR render failed:', e);
        }
    };

    // ─── Vector Barcode ───────────────────────────────────────────────────────
    const drawVectorBarcode = async (pdf, value, x, y, w, h, format, fill) => {
        try {
            const fmt = (format || 'CODE128').toUpperCase();

            // Redirect 2D formats to their respective renderers if they happen to be in a barcode element
            if (fmt === 'QRCODE') {
                const qsz = Math.min(w, h);
                const qx = x + (w - qsz) / 2;
                const qy = y + (h - qsz) / 2;
                await renderQRAtPos(pdf, value, qx, qy, qsz, fill);
                return;
            }

            const isEAN13 = fmt === 'EAN13';
            if (isEAN13) {
                const L = {
                    0: '0001101', 1: '0011001', 2: '0010011', 3: '0111101', 4: '0100011',
                    5: '0110001', 6: '0101111', 7: '0111011', 8: '0110111', 9: '0001011',
                };
                const G = {
                    0: '0100111', 1: '0110011', 2: '0011011', 3: '0100001', 4: '0011101',
                    5: '0111001', 6: '0000101', 7: '0010001', 8: '0001001', 9: '0010111',
                };
                const R = {
                    0: '1110010', 1: '1100110', 2: '1101100', 3: '1000010', 4: '1011100',
                    5: '1001110', 6: '1010000', 7: '1000100', 8: '1001000', 9: '1110100',
                };
                const PARITY = {
                    0: 'LLLLLL', 1: 'LLGLGG', 2: 'LLGGLG', 3: 'LLGGGL', 4: 'LGLLGG',
                    5: 'LGGLLG', 6: 'LGGGLL', 7: 'LGLGLG', 8: 'LGLGGL', 9: 'LGGLGL',
                };
                const s = String(value).replace(/\D/g, '').padEnd(13, '0').substring(0, 13);
                const d = s.split('').map(Number);
                const parity = PARITY[d[0]] || 'LLLLLL';
                let bits = '101';
                for (let i = 0; i < 6; i++)
                    bits += parity[i] === 'G' ? G[d[i + 1]] : L[d[i + 1]];
                bits += '01010';
                for (let i = 0; i < 6; i++) bits += R[d[i + 7]];
                bits += '101';

                const fsPt = 6;
                const fsMM = fsPt * 0.352778;
                const gap = 0.1;
                const barZoneH = h - fsMM - gap;
                const guardH = barZoneH + 1.2;
                const unitW = w / 109, bsX = x + unitW * 7;
                const isG = i => i < 3 || (i >= 45 && i < 50) || i >= 92;

                pdf.setFillColor(fill || '#000000');
                let cx = bsX;
                for (let i = 0; i < 95;) {
                    if (bits[i] === '1') {
                        let sp = 1;
                        while (i + sp < 95 && bits[i + sp] === '1' && isG(i + sp) === isG(i)) sp++;
                        pdf.rect(cx, y, unitW * sp, isG(i) ? guardH : barZoneH, 'F');
                        cx += unitW * sp;
                        i += sp;
                    } else { cx += unitW; i++; }
                }
                try { pdf.setFont('OCR-BT', 'normal'); } catch (e) { pdf.setFont('courier', 'normal'); }
                pdf.setFontSize(fsPt);
                const ty = y + barZoneH + fsMM * 1.0;
                pdf.text(s[0], x + unitW * 2.5, ty, { align: 'center' });
                for (let i = 0; i < 6; i++)
                    pdf.text(s[i + 1], bsX + unitW * (3 + i * 7 + 3.5), ty, { align: 'center' });
                for (let i = 0; i < 6; i++)
                    pdf.text(s[i + 7], bsX + unitW * (50 + i * 7 + 3.5), ty, { align: 'center' });
            } else {
                const bd = {};
                // Normalize format for JsBarcode (e.g. "CODE128")
                const safeFmt = fmt.replace(/\s/g, '');
                JsBarcode(bd, String(value || '123456789'), { format: safeFmt, margin: 0 });
                const encs = bd.encodings || [];
                let total = 0;
                encs.forEach(e => { total += e.data.length; });
                const unitW = w / total, fsPt = 6, fsMM = fsPt * 0.352778, barH = h - fsMM - 0.5;
                pdf.setFillColor(fill || '#000000');
                let cx = x;
                encs.forEach(enc => {
                    for (let i = 0; i < enc.data.length;) {
                        if (enc.data[i] === '1') {
                            let sp = 1;
                            while (i + sp < enc.data.length && enc.data[i + sp] === '1') sp++;
                            pdf.rect(cx, y, unitW * sp, barH, 'F');
                            cx += unitW * sp; i += sp;
                        } else { cx += unitW; i++; }
                    }
                });
                try { pdf.setFont('OCR-BT', 'normal'); } catch (e) { pdf.setFont('courier', 'normal'); }
                const scaledFsPt = fsPt * (w / 44);
                pdf.setFontSize(scaledFsPt);
                pdf.text(String(value), x + w / 2, y + barH + 0.5 + (scaledFsPt * 0.352778) * 0.8, { align: 'center' });
            }
        } catch (e) { console.warn('Barcode PDF err:', e); }
    };

    // ─── PDF Label Renderer ───────────────────────────────────────────────────
    const drawVectorLabel = async (
        pdf, elements, data, mapping, mmX, mmY, mmW, mmH,
        isBranding = false, isProduction = false, modes = {}
    ) => {
        await loadCustomFonts(pdf);

        const labelType = getLabelType(selectedTemplate);
        const unit = selectedTemplate?.canvasUnit || 'px';
        const rawW = selectedTemplate?.canvasWidth || selectedTemplate?.width || 166;
        const rawH = selectedTemplate?.canvasHeight || selectedTemplate?.height || 387;
        const dWmm = unit === 'mm' ? rawW : rawW * PX_TO_MM;
        const dHmm = unit === 'mm' ? rawH : rawH * PX_TO_MM;

        const cs = Math.min(mmW / dWmm, mmH / dHmm);
        const offX = mmX + (mmW - dWmm * cs) / 2;
        const offY = mmY + (mmH - dHmm * cs) / 2;
        const canvasRadius = selectedTemplate?.canvasRadius || 10;
        const tagR = isProduction ? 0 : Math.min(4, canvasRadius * PX_TO_MM * cs);

        pdf.setFillColor('#ffffff');
        if (tagR > 0) {
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F');
        } else {
            pdf.rect(mmX, mmY, mmW, mmH, 'F');
        }

        if (!isProduction) {
            pdf.setDrawColor('#FF00FF');
            pdf.setLineWidth(0.15);
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'D');
            pdf.circle(mmX + mmW / 2, mmY + 5, 1.5, 'D');
        }

        if (isBranding) {
            pdf.setFillColor('#000000');
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F');
            pdf.setDrawColor('#ffffff');
            pdf.setLineWidth(0.4);
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'D');
            const bImg = brandingImg || logoImg;
            if (bImg) {
                try {
                    const aspect = bImg.height / bImg.width;
                    const drawW = mmW * 0.85;
                    const drawH = drawW * aspect;
                    const dx = mmX + (mmW - drawW) / 2;
                    const dy = mmY + (mmH - drawH) / 2;
                    pdf.addImage(bImg, 'PNG', dx, dy, drawW, drawH);
                } catch (e) { }
            }
            return;
        }

        pdf.saveGraphicsState();
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, null);
        pdf.internal.write('W n');

        const sizeCol = Object.keys(data).find(
            k => k.toLowerCase() === 'size' || k.toLowerCase().includes('size')
        );
        const sizeVal = String(data[sizeCol] || '').trim().toUpperCase();

        const azorteeVisibleCircles = new Set();
        if (labelType === 'azortee' && sizeVal) {
            const circleTextMap = buildAzorteeCircleMap(elements, data);
            circleTextMap.forEach((pairedText, circleId) => {
                if (pairedText === sizeVal) {
                    azorteeVisibleCircles.add(circleId);
                }
            });
        }

        const sizeHighlightRectIds = new Set();
        if ((labelType === 'normal' || labelType === 'livsmart') && sizeVal) {
            elements.forEach(textEl => {
                if (textEl.type !== 'text' && textEl.type !== 'placeholder') return;
                const resolved = resolveTextValue(textEl, data, mapping);
                if (!resolved) return;
                const cleanResolved = resolved.trim().toUpperCase();
                if (cleanResolved !== sizeVal || cleanResolved.length >= 6) return;
                elements.forEach(rectEl => {
                    if (rectEl.type !== 'rect') return;
                    const dx = Math.abs((rectEl.x || 0) - (textEl.x || 0));
                    const dy = Math.abs((rectEl.y || 0) - (textEl.y || 0));
                    if (dx <= 8 && dy <= 8) sizeHighlightRectIds.add(rectEl.id);
                });
            });
        }

        const livsmartHighlightTextIds = new Set();
        if (labelType === 'livsmart' && sizeVal) {
            elements.forEach(el => {
                if (el.type !== 'text' && el.type !== 'placeholder') return;
                if (el.text?.includes('{{')) return;
                const cleanText = (el.text || '').trim().toUpperCase();
                if (cleanText === sizeVal && cleanText.length < 8) {
                    livsmartHighlightTextIds.add(el.id);
                }
            });
        }

        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const el of sorted) {
            if (el.visible === false) continue;
            pdf.saveGraphicsState();

            const elSX = el.scaleX || 1;
            const elSY = el.scaleY || 1;
            const elRot = el.rotation || 0;
            const unitScale = unit === 'mm' ? 1 : PX_TO_MM;
            let ex = offX + (el.x || 0) * unitScale * cs;
            let ey = offY + (el.y || 0) * unitScale * cs;
            const ew = (el.width || 0) * unitScale * cs * elSX;
            const eh = (el.height || 0) * unitScale * cs * elSY;
            const elName = (el.name || '').toLowerCase();

            const forcedMode = modes[el.id] || mappingModes[el.id];
            if (forcedMode === 'qrcode') {
                const qv = String(data[manualMapping[el.id]] || resolveQRValue(el, data, manualMapping));
                if (qv) {
                    await renderQRAtPos(pdf, qv, ex, ey, ew, eh, el.fill);
                    pdf.restoreGraphicsState();
                    continue;
                }
            } else if (forcedMode === 'ean13' || forcedMode === 'barcode') {
                const bv = String(data[manualMapping[el.id]] || resolveBarcodeValue(el, data, manualMapping));
                const fmt = forcedMode === 'ean13' ? 'EAN13' : 'CODE128';
                drawVectorBarcode(pdf, bv, ex, ey, ew, eh, fmt, el.fill);
                pdf.restoreGraphicsState();
                continue;
            } else if (forcedMode === 'text') {
                const val = String(data[manualMapping[el.id]] || '');
                const fs = Math.max(2, (el.fontSize || 12) * 0.75 * (el.scaleY || 1) * cs);
                const fsMM = fs * 0.352778;
                pdf.setFontSize(fs);
                pdf.text(val, ex, ey + fsMM * 0.85);
                pdf.restoreGraphicsState();
                continue;
            }

            // ── SIZE INDICATOR CIRCLE ────────────────────────────────────────
            if (
                el.type === 'circle' &&
                (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'))
            ) {
                if (labelType === 'azortee' && azorteeVisibleCircles.has(el.id)) {
                    const rx = (el.radius || 10) * unitScale * cs * (el.scaleX || 1);
                    const ry = (el.radius || 10) * unitScale * cs * (el.scaleY || 1);
                    pdf.setDrawColor(el.stroke || el.fill || '#000000');
                    pdf.setLineWidth(Math.max(0.2, (el.strokeWidth || 1.5) * unitScale * cs * (el.scaleX || 1)));
                    pdf.ellipse(ex, ey, rx, ry, 'D');
                }
                pdf.restoreGraphicsState();
                continue;
            }

            // ── TEXT ─────────────────────────────────────────────────────────
            if (el.type === 'text' || el.type === 'placeholder') {
                let val = resolveTextValue(el, data, mapping);
                if (!val || val === 'Text') { pdf.restoreGraphicsState(); continue; }

                const fs = Math.max(2, (el.fontSize || 12) * 0.75 * (el.scaleY || 1) * cs);
                const fsMM = fs * 0.352778;
                const cleanV = val.trim().toUpperCase();

                if (labelType === 'livsmart' && livsmartHighlightTextIds.has(el.id)) {
                    const padding = 0.5;
                    const measuredW = pdf.getTextWidth(val) || 0;
                    const rectW = (ew > 2 ? ew : measuredW) + padding * 2;
                    const rectH = fsMM * 1.5;
                    pdf.setFillColor('#000000');
                    pdf.rect(ex - padding, ey - padding, rectW, rectH, 'F');
                }

                let textColor = el.fill || '#000000';
                if (labelType === 'livsmart' && livsmartHighlightTextIds.has(el.id)) {
                    textColor = '#ffffff';
                } else if (labelType === 'normal' && sizeVal && cleanV === sizeVal && cleanV.length < 6) {
                    textColor = '#000000';
                }

                pdf.setFontSize(fs);
                pdf.setTextColor(textColor);

                const bold = String(el.fontWeight || '').includes('bold') || el.fontWeight === '700' || el.fontWeight === 700;
                const italic = el.fontStyle === 'italic';
                const pdfStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';

                const pdfFont = resolvePdfFont(el.fontFamily || '');
                const availableFonts = pdf.getFontList();
                const fontExists = availableFonts[pdfFont];

                try {
                    if (fontExists) {
                        pdf.setFont(pdfFont, pdfStyle);
                    } else {
                        pdf.setFont('helvetica', pdfStyle);
                    }
                } catch (e) {
                    try { pdf.setFont('helvetica', 'normal'); } catch (e2) { }
                }

                const align = el.textAlign || 'left';
                const wrapW = (el.width || 0) * unitScale * cs;

                if (elRot !== 0) {
                    const safeVal = val.replace(/₹/g, 'Rs.');
                    const lines = wrapW > 10 ? pdf.splitTextToSize(safeVal, wrapW) : [safeVal];
                    let rotAnchorX = ex;
                    if (align === 'center' && wrapW > 0) rotAnchorX = ex + wrapW / 2;
                    else if (align === 'right' && wrapW > 0) rotAnchorX = ex + wrapW;
                    pdf.text(lines.join('\n'), rotAnchorX, ey + fsMM * 0.85, {
                        align,
                        angle: -elRot,
                        lineHeightFactor: el.lineHeight || 1.2,
                    });
                    pdf.restoreGraphicsState();
                    continue;
                }

                const tabPos = el.tabPos || 0;
                if (tabPos > 0 && val.includes(':')) {
                    const lh = fs * 0.352778 * (el.lineHeight || 1.2);
                    val.split('\n').forEach((line, i) => {
                        const ci = line.indexOf(':');
                        const ly = ey + fsMM * 0.85 + i * lh;
                        if (ci !== -1) {
                            drawRupeeText(pdf, line.substring(0, ci).trim(), ex, ly, elSX);
                            drawRupeeText(pdf, line.substring(ci).trim(), ex + tabPos * unitScale * cs, ly, elSX);
                        } else {
                            drawRupeeText(pdf, line, ex, ly, elSX);
                        }
                    });
                    pdf.restoreGraphicsState();
                    continue;
                }

                if (elSX !== 1 && elSX > 0) pdf.internal.write(`${(elSX * 100).toFixed(1)} Tz`);

                const ty = ey + fsMM * 0.85;
                const explicitLines = val.split('\n');
                const rawLines = [];
                explicitLines.forEach(seg => {
                    const segClean = seg.trim();
                    if (!segClean) return;
                    const segWithRupee = segClean.replace(/₹/g, ' ₹ ');
                    if (wrapW > 10 && el.wrap !== 'none') {
                        const wrapped = pdf.splitTextToSize(segWithRupee, wrapW);
                        wrapped.forEach(l => rawLines.push(l.trim()));
                    } else {
                        rawLines.push(segWithRupee);
                    }
                });

                const lh = fsMM * (el.lineHeight || 1.2);

                const effectiveW = wrapW > 10
                    ? wrapW
                    : (() => {
                        let maxW = 0;
                        rawLines.forEach(l => {
                            const w = pdf.getTextWidth(l.replace(/\s*₹\s*/g, '').trim());
                            if (w > maxW) maxW = w;
                        });
                        return maxW;
                    })();

                rawLines.forEach((line, li) => {
                    const lineY = ty + li * lh;
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return;

                    if (!trimmedLine.includes('₹')) {
                        let anchorX = ex;
                        let textOpts = {};
                        if (align === 'center') {
                            anchorX = ex + effectiveW / 2;
                            textOpts = { align: 'center' };
                        } else if (align === 'right') {
                            anchorX = ex + effectiveW;
                            textOpts = { align: 'right' };
                        }
                        pdf.text(trimmedLine, anchorX, lineY, textOpts);
                    } else {
                        const safeTextForWidth = trimmedLine.replace(/\s*₹\s*/g, '');
                        let lineW = 0;
                        try {
                            const currentFont = pdf.internal.getFont();
                            if (currentFont && currentFont.metadata && currentFont.metadata.widths) {
                                lineW = pdf.getTextWidth(safeTextForWidth);
                            } else {
                                lineW = safeTextForWidth.length * (fs * 0.2);
                            }
                        } catch (e) {
                            lineW = safeTextForWidth.length * (fs * 0.2);
                        }

                        const visualLineW = lineW * (elSX || 1);
                        let lineX = ex;
                        if (align === 'center') lineX = ex + (effectiveW - visualLineW) / 2;
                        else if (align === 'right') lineX = ex + effectiveW - visualLineW;
                        drawRupeeText(pdf, trimmedLine, lineX, lineY, elSX);
                    }
                });

                if (elSX !== 1 && elSX > 0) pdf.internal.write('100 Tz');

                // ── RECT ─────────────────────────────────────────────────────────
            } else if (el.type === 'rect') {
                let fill = el.fill;
                const isStrip =
                    elName.includes('strip') || elName.includes('color') ||
                    ((el.width || 0) > 80 && (el.height || 0) < 50);
                if (isProduction && isStrip) { pdf.restoreGraphicsState(); continue; }
                if (isStrip) {
                    const manualMapped = mapping[el.id];
                    if (manualMapped && data[manualMapped] !== undefined) {
                        const raw = String(data[manualMapped] ?? '');
                        const mc = resolveStripColor(raw.trim());
                        if (mc) fill = mc;
                    } else {
                        const sc = Object.keys(data || {}).find(col => {
                            const norm = col.toLowerCase().replace(/[\s_-]/g, '');
                            return norm.includes('stripcolor') || norm === 'strip';
                        });
                        if (sc && data[sc]) {
                            const mc = resolveStripColor(String(data[sc]).trim());
                            if (mc) fill = mc;
                        }
                    }
                }

                if (sizeHighlightRectIds.has(el.id)) fill = '#000000';

                const isLabelBorder = Math.abs(ew - mmW) < 3 && Math.abs(eh - mmH) < 3;
                const r = el.cornerRadius
                    ? Math.max(0, el.cornerRadius * unitScale * cs)
                    : isLabelBorder ? tagR : 0;
                if (fill && fill !== 'transparent') {
                    pdf.setFillColor(fill);
                    r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'F') : pdf.rect(ex, ey, ew, eh, 'F');
                }
                if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0) {
                    if (!isLabelBorder) {
                        pdf.setDrawColor(el.stroke);
                        pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                        r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'D') : pdf.rect(ex, ey, ew, eh, 'D');
                    }
                }

                // ── BARCODE ───────────────────────────────────────────────────────
                // REPLACE WITH:
            } else if (el.type === 'barcode') {
                let bv = el.barcodeValue || '123456789';
                const mp = mapping[el.id];
                if (mp && data[mp] !== undefined) {
                    bv = String(data[mp]);
                } else {
                    // 1. Try exact match by fieldName or element name
                    const ac = Object.keys(data || {}).find(
                        c => c.toLowerCase() === (el.fieldName || el.name || '').toLowerCase()
                    );
                    if (ac) {
                        bv = String(data[ac] ?? bv);
                    } else {
                        // 2. Auto-match any column whose header contains 'ean'
                        const eanCol = Object.keys(data || {}).find(
                            c => c.toLowerCase().includes('ean')
                        );
                        if (eanCol && data[eanCol] !== undefined) {
                            bv = String(data[eanCol] ?? bv).replace(/^[₹\s]+/, '').trim();
                        }
                    }
                }
                const format = (el.barcodeFormat || 'CODE128').toUpperCase();
                let bw = ew;
                let bh = eh * 0.9;
                let bx = ex;
                let by = ey;

                if (isProduction && format === 'EAN13') {
                    bw = 30;
                    bh = 14;
                    // Center within original element bounds
                    bx = ex + (ew - bw) / 2;
                    by = ey + (eh - bh) / 2;
                } else if (!isProduction) {
                    bh += 2;
                }

                await drawVectorBarcode(pdf, bv, bx, by, bw, bh, el.barcodeFormat || 'CODE128', el.fill);

                // ── QR CODE ── FULLY FIXED ────────────────────────────────────────
            } else if (el.type === 'qrcode') {
                try {
                    let qv = resolveQRValue(el, data, mapping);
                    if (!qv) {
                        const qrCol = Object.keys(data || {}).find(
                            c => c.toLowerCase().includes('qr')
                        );
                        if (qrCol && data[qrCol]) {
                            qv = String(data[qrCol]).replace(/^[₹\s]+/, '').trim();
                        }
                    }

                    if (qv) {
                        const dataUrl = await QRCode.toDataURL(qv, {
                            margin: 1,
                            errorCorrectionLevel: 'M',
                            width: 512,
                            color: { dark: '#000000', light: '#ffffff' },
                        });

                        const qsz = Math.min(ew, eh);
                        const qx = ex + (ew - qsz) / 2;
                        const qy = ey + (eh - qsz) / 2;
                        const base64Data = dataUrl.split(',')[1];

                        try {
                            pdf.addImage(base64Data || dataUrl, 'PNG', qx, qy, qsz, qsz);
                        } catch (imgErr) {
                            console.warn('QR addImage failed:', imgErr.message);
                        }
                    }
                } catch (e) {
                    console.warn('QR render error:', e.message);
                }
                pdf.restoreGraphicsState();
                continue;

                // ── IMAGE ─────────────────────────────────────────────────────────
            } else if (el.type === 'image') {
                const src = el.image || el.src || el.url;
                if (src) { try { pdf.addImage(src, 'PNG', ex, ey, ew, eh); } catch (e) { } }

                // ── LINE ─────────────────────────────────────────────────────────
            } else if (el.type === 'line') {
                const pts = el.points || [0, 0, 100, 0];
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                pdf.line(
                    ex + pts[0] * unitScale * cs, ey + pts[1] * unitScale * cs,
                    ex + pts[2] * unitScale * cs, ey + pts[3] * unitScale * cs
                );

                // ── GENERIC CIRCLE ────────────────────────────────────────────────
            } else if (el.type === 'circle') {
                const rx = (el.radius || 10) * unitScale * cs * (el.scaleX || 1);
                const ry = (el.radius || 10) * unitScale * cs * (el.scaleY || 1);
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs * (el.scaleX || 1)));
                if (el.fill && el.fill !== 'transparent') {
                    pdf.setFillColor(el.fill);
                    pdf.ellipse(ex, ey, rx, ry, 'FD');
                } else {
                    pdf.ellipse(ex, ey, rx, ry, 'D');
                }
            }

            pdf.restoreGraphicsState();
        }
        pdf.restoreGraphicsState();
    };

    // ─── Constants for Proof Sheet Branding ────────────────────────────────────
    const COMPANY_NAME = "SARAVANA GRAPHICS";
    const COMPANY_TAGLINE = "Professional Label & Card Designer";
    const COMPANY_ADDRESS = "Tirupur, Tamil Nadu, India";
    const CONTACT_INFO = "Email: info@saravanagraphics.com | Web: www.saravanagraphics.com";

    // ─── Download Proof Sheet ─────────────────────────────────────────────────
    const downloadPDF = async () => {
        if (!selectedTemplate) return;
        try {
            toast.loading('Generating Proof Sheet…', { id: 'pdf' });
            const PAGE_W = 297, PAGE_H = 210;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const _unit = selectedTemplate.canvasUnit || 'px';
            const _dW = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const _dH = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const origW = _unit === 'mm' ? _dW : _dW * PX_TO_MM;
            const origH = _unit === 'mm' ? _dH : _dH * PX_TO_MM;

            const cols = 5, rows = 2, hGap = 6, vGap = 8;
            const HEADER_H = 35;
            const usableW = PAGE_W - 25;
            const usableH = PAGE_H - 30 - HEADER_H;
            const scaleX = (usableW - (cols - 1) * hGap) / (cols * origW);
            const scaleY = (usableH - (rows - 1) * vGap) / (rows * origH);
            const masterScale = Math.min(0.95, scaleX, scaleY);
            const labelW = origW * masterScale, labelH = origH * masterScale;
            const maxPP = cols * rows;
            const gridW = cols * labelW + (cols - 1) * hGap;
            const gridH = rows * labelH + (rows - 1) * vGap;
            const startX = (PAGE_W - gridW) / 2;
            const startY = HEADER_H + 5 + (usableH - gridH) / 2;

            const pages = [];
            let currentPage = [{ isBranding: true, data: null }];
            for (const row of excelData) {
                if (Object.values(row).every(v => v === '' || v == null)) continue;
                if (currentPage.length >= maxPP) { pages.push(currentPage); currentPage = []; }
                currentPage.push({ isBranding: false, data: row });
            }
            if (currentPage.length > 0) pages.push(currentPage);

            const drawBrandingHeader = (pageNum, totalPages) => {
                pdf.saveGraphicsState();

                const bImg = brandingImg || logoImg;
                if (bImg) {
                    try {
                        const aspect = bImg.height / bImg.width;
                        const imgW = 28;
                        const imgH = imgW * aspect;
                        pdf.addImage(bImg, 'PNG', 10, 6, imgW, imgH);
                    } catch (e) { console.warn("Header logo error", e); }
                }

                pdf.setFont("Arial", "bold");
                pdf.setFontSize(14);
                pdf.setTextColor("#000000");
                pdf.text(COMPANY_NAME, 42, 13);

                pdf.setFont("Arial", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor("#555555");
                pdf.text(COMPANY_TAGLINE, 42, 17);
                pdf.text(COMPANY_ADDRESS, 42, 21);
                pdf.text(CONTACT_INFO, 42, 25);

                pdf.setFontSize(16);
                pdf.setFont("Arial", "bold");
                pdf.setTextColor("#000080");
                pdf.text("DESIGN PROOF APPROVAL SHEET", PAGE_W - 10, 13, { align: 'right' });

                pdf.setFontSize(9);
                pdf.setFont("Arial", "normal");
                pdf.setTextColor("#777777");
                pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - 10, 19, { align: 'right' });
                pdf.text(`Date: ${new Intl.DateTimeFormat('en-IN').format(new Date())}`, PAGE_W - 10, 24, { align: 'right' });

                pdf.setDrawColor("#e2e8f0");
                pdf.setLineWidth(0.4);
                pdf.line(10, 32, PAGE_W - 10, 32);

                pdf.restoreGraphicsState();
            };

            for (let pIdx = 0; pIdx < pages.length; pIdx++) {
                const pgItems = pages[pIdx];
                if (pIdx > 0) pdf.addPage();

                drawBrandingHeader(pIdx + 1, pages.length);

                for (let i = 0; i < pgItems.length; i++) {
                    const item = pgItems[i];
                    const c = i % cols, r = Math.floor(i / cols);
                    const x = startX + c * (labelW + hGap), y = startY + r * (labelH + vGap);
                    if (item.isBranding) {
                        await drawVectorLabel(pdf, [], {}, {}, x, y, labelW, labelH, true);
                    } else {
                        await drawVectorLabel(pdf, selectedTemplate.elements, item.data, manualMapping, x, y, labelW, labelH, false, false, mappingModes);
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
            const _unit2 = selectedTemplate.canvasUnit || 'px';
            const _dW2 = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const _dH2 = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const lW = _unit2 === 'mm' ? _dW2 : _dW2 * PX_TO_MM;
            const lH = _unit2 === 'mm' ? _dH2 : _dH2 * PX_TO_MM;
            const ori = lW > lH ? 'landscape' : 'portrait';
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

    const getDesignPx = () => {
        if (!selectedTemplate) return { w: 166, h: 387 };
        const unit = selectedTemplate.canvasUnit || 'px';
        const w = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
        const h = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
        return {
            w: unit === 'px' ? w : unitToPx(w, unit),
            h: unit === 'px' ? h : unitToPx(h, unit),
        };
    };
    const { w: itemW, h: itemH } = getDesignPx();
    const colsCount = 6, spacing = 6, marginSide = 50;

    let requiredRows = 1, tempCol = 1, tempRow = 0;
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
    const currentLabelType = getLabelType(selectedTemplate);

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc' }}>
                <div className="layout-header-simple">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={18} />
                        </button>
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
                                <button
                                    className="btn btn-secondary btn-sm gap-2 px-6 shadow-lg shadow-secondary/20"
                                    onClick={downloadIndividualPDF}
                                    style={{ borderRadius: 50 }}
                                >
                                    <Download size={14} /> Download Labels
                                </button>
                                <button
                                    className="btn btn-primary btn-sm gap-2 px-6 shadow-lg shadow-primary/20"
                                    onClick={downloadPDF}
                                    style={{ borderRadius: 50 }}
                                >
                                    <Download size={14} /> Download Proof Sheet
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="layout-content-grid">
                    <div className="layout-toolbar-horizontal">
                        {/* 1. Design Selector */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">1. Select Design</div>
                            <select
                                className="select-input-simple h-[38px] min-w-[180px] text-xs font-bold border-muted/20"
                                value={selectedTemplate?._id || selectedTemplate?.id || ''}
                                onChange={e => handleSelectTemplate(e.target.value)}
                            >
                                <option value="">— Choose Design —</option>
                                {templates.map(t => (
                                    <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>
                                ))}
                            </select>
                            {selectedTemplate && (
                                <span
                                    className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ml-1"
                                    style={{
                                        background: currentLabelType === 'azortee' ? '#e0f0ff' : currentLabelType === 'livsmart' ? '#f0ffe0' : '#f5f5f5',
                                        color: currentLabelType === 'azortee' ? '#0055cc' : currentLabelType === 'livsmart' ? '#226600' : '#888',
                                    }}
                                >
                                    {currentLabelType}
                                </span>
                            )}
                        </div>

                        {/* 2. Branding Logo */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">2. Logo</div>
                            <button
                                className={`btn btn-ghost btn-sm h-[38px] border border-muted/10 px-4 ${brandingImg ? 'bg-success/10 text-success' : ''}`}
                                onClick={() => document.getElementById('branding-upload').click()}
                            >
                                <Wand2 size={14} className="mr-2" /> {brandingImg ? 'Logo Added' : 'Add Logo'}
                            </button>
                            <input type="file" id="branding-upload" hidden accept="image/*" onChange={handleBrandingLogoUpload} />
                        </div>

                        {/* 3. Strip Colors */}
                        <div className="toolbar-section relative">
                            <div className="section-label-mini">3. Palette</div>
                            <button
                                className="btn btn-ghost btn-sm h-[38px] border border-muted/10 px-4"
                                onClick={() => setShowStripManager(!showStripManager)}
                            >
                                <Palette size={14} className="mr-2" /> Colors
                            </button>
                            {showStripManager && (
                                <div
                                    className="absolute top-[100%] left-0 mt-2 bg-white border border-[#333] shadow-2xl z-[500]"
                                    style={{ width: '550px', minWidth: '550px', padding: '0', boxSizing: 'border-box' }}
                                >
                                    <div
                                        className="text-white text-[11px] font-bold px-2 py-1.5 flex justify-between items-center"
                                        style={{ background: '#000080', width: '100%' }}
                                    >
                                        <span style={{ whiteSpace: 'nowrap' }}>CMYK Color Palette</span>
                                        <button
                                            onClick={() => setShowStripManager(false)}
                                            style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}
                                        >×</button>
                                    </div>
                                    <div style={{ display: 'flex', minHeight: '400px' }}>
                                        <div style={{ flex: '1.2', padding: '12px', borderRight: '1px solid #ddd' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '1px', background: '#999', border: '1px solid #999', marginBottom: '15px', maxHeight: '160px', overflowY: 'auto' }}>
                                                {corelPalette.map(cp => (
                                                    <div
                                                        key={cp.name}
                                                        style={{ background: cp.hex, height: '18px', cursor: 'pointer' }}
                                                        title={`${cp.name} (${cp.cmyk})`}
                                                        onClick={() => {
                                                            const [c, m, y, k] = cp.cmyk.split(',').map(Number);
                                                            setCmykInput({ name: cp.name, c, m, y, k });
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', background: '#f8f8f8', padding: '8px', border: '1px solid #ddd' }}>
                                                <div style={{ width: '30px', height: '30px', border: '1px solid #666', background: cmykInput.name ? corelPalette.find(p => p.name === cmykInput.name)?.hex || '#fff' : '#fff' }}></div>
                                                <div style={{ flex: '1' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold' }}>#</span>
                                                        <input
                                                            type="text" readOnly
                                                            value={(corelPalette.find(p => p.name === cmykInput.name)?.hex || '#FFFFFF').toUpperCase()}
                                                            style={{ width: '100%', fontSize: '11px', border: '1px solid #999', padding: '1px 4px', background: 'white' }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { label: 'C', key: 'c', gradient: 'linear-gradient(to right, #fff, #00FFFF)' },
                                                    { label: 'M', key: 'm', gradient: 'linear-gradient(to right, #fff, #FF00FF)' },
                                                    { label: 'Y', key: 'y', gradient: 'linear-gradient(to right, #fff, #FFFF00)' },
                                                    { label: 'K', key: 'k', gradient: 'linear-gradient(to right, #fff, #000)' },
                                                ].map(s => (
                                                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', width: '12px' }}>{s.label}</span>
                                                        <div style={{ flex: '1', height: '10px', border: '1px solid #999', position: 'relative', background: s.gradient }}>
                                                            <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', width: '4px', background: 'white', border: '1px solid #333', left: `${cmykInput[s.key]}%`, transform: 'translateX(-50%)', pointerEvents: 'none' }}></div>
                                                            <input
                                                                type="range"
                                                                style={{ position: 'absolute', inset: '0', opacity: '0', cursor: 'pointer', width: '100%' }}
                                                                min="0" max="100" value={cmykInput[s.key]}
                                                                onChange={e => setCmykInput(p => ({ ...p, [s.key]: Number(e.target.value) }))}
                                                            />
                                                        </div>
                                                        <input
                                                            type="number" min="0" max="100"
                                                            style={{ width: '35px', fontSize: '10px', border: '1px solid #999', textAlign: 'center', padding: '0 2px' }}
                                                            value={cmykInput[s.key]}
                                                            onChange={e => { let v = Math.min(100, Math.max(0, Number(e.target.value))); setCmykInput(p => ({ ...p, [s.key]: v })); }}
                                                        />
                                                        <span style={{ fontSize: '10px' }}>%</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                                                <input
                                                    type="text" placeholder="Color Name"
                                                    style={{ width: '100%', fontSize: '11px', border: '1px solid #999', padding: '3px', marginBottom: '6px', boxSizing: 'border-box' }}
                                                    value={cmykInput.name}
                                                    onChange={e => setCmykInput(p => ({ ...p, name: e.target.value }))}
                                                />
                                                <button
                                                    style={{ width: '100%', background: '#000080', color: 'white', fontSize: '11px', padding: '5px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                                                    onClick={handleAddCMYKColor}
                                                >ADD TO PALETTE</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
                                            <div style={{ background: '#eee', padding: '6px 10px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #ddd' }}>Strip Colors</div>
                                            <div style={{ flex: '1', overflowY: 'auto', padding: '5px' }}>
                                                {stripColors.length === 0 ? (
                                                    <div style={{ padding: '20px', fontSize: '10px', color: '#999', textAlign: 'center' }}>No colors added yet</div>
                                                ) : (
                                                    stripColors.map(sc => (
                                                        <div
                                                            key={sc._id}
                                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: '1px solid #eee', background: 'white', marginBottom: '4px', cursor: 'pointer', borderRadius: '2px' }}
                                                            className="hover:border-blue-300"
                                                            onClick={() => {
                                                                if (sc.cmyk) {
                                                                    const [c, m, y, k] = sc.cmyk.split(',').map(Number);
                                                                    setCmykInput({ name: sc.name, c, m, y, k });
                                                                }
                                                            }}
                                                        >
                                                            <div style={{ width: '14px', height: '14px', border: '1px solid #666', background: sc.hex }}></div>
                                                            <div style={{ flex: '1', fontSize: '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</div>
                                                            <div style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                                                {sc.cmyk ? sc.cmyk.split(',').map((v, i) => `${['C', 'M', 'Y', 'K'][i]}:${v}`).join(' ') : sc.hex}
                                                            </div>
                                                            <button
                                                                onClick={e => handleDeleteColor(e, sc._id)}
                                                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#999' }}
                                                            ><Trash2 size={11} /></button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 4. Excel Upload */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">4. Data</div>
                            <div
                                className={`excel-drop-horizontal ${excelData.length ? 'has-data' : ''} px-4`}
                                onClick={() => document.getElementById('excel-input').click()}
                            >
                                <FileSpreadsheet size={14} className={excelData.length ? 'text-success' : 'text-muted'} />
                                <span>{excelData.length ? `${excelData.length} Rows` : 'Upload Excel'}</span>
                            </div>
                            <input type="file" id="excel-input" hidden accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </div>

                        {/* 5. Field Mapping */}
                        {selectedTemplate && excelData.length > 0 && templateFields.length > 0 && (
                            <div className="toolbar-section flex-1 ml-4 pl-4 border-l border-muted/10">
                                <div className="section-label-mini">5. Mapping</div>
                                <div className="mapping-row-toolbar">
                                    {templateFields.map(field => (
                                        <div key={field.id} className="mapping-item-compact">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <label>{field.label}</label>
                                                    <select
                                                        className="text-[9px] bg-transparent border-none opacity-50 hover:opacity-100 cursor-pointer outline-none"
                                                        value={mappingModes[field.id] || ''}
                                                        onChange={e => setMappingModes(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                    >
                                                        <option value="">Auto</option>
                                                        <option value="text">Text</option>
                                                        <option value="barcode">Barcode</option>
                                                        <option value="ean13">EAN13</option>
                                                        <option value="qrcode">QR Code</option>
                                                    </select>
                                                </div>
                                                <select
                                                    className="mapping-select-toolbar"
                                                    value={manualMapping[field.id] || ''}
                                                    onChange={e => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}
                                                >
                                                    <option value="">Auto</option>
                                                    {columns.map(col => (
                                                        <option key={col} value={col}>{col}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                                    <div
                                                        key={col} title={col}
                                                        className={`header-chip-mini ${Object.values(manualMapping).includes(col) ? 'mapped' : ''}`}
                                                        style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    >{col}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div
                                    className="konva-container-clean"
                                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                                >
                                    <Stage width={sheetW} height={sheetH} ref={stageRef} className="konva-sheet-simple">
                                        <Layer>
                                            <Rect width={sheetW} height={sheetH} fill="#f1f5f9" />
                                            <Group x={marginSide} y={20}>
                                                {logoImg && <KImage image={logoImg} width={160} height={45} />}
                                                <Rect y={55} width={sheetW - marginSide * 2} height={1} fill="#e2e8f0" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={65} fontSize={10} fontFamily="Arial" fill="#94a3b8" letterSpacing={2} />
                                            </Group>
                                            <Group x={marginSide} y={110}>
                                                <Group x={0} y={0}>
                                                    <LayoutLabel width={itemW} height={itemH} isBranding logoImg={brandingImg || logoImg} />
                                                </Group>
                                                {(() => {
                                                    let col = 1, row = 0;
                                                    return excelData.map((rowData, i) => {
                                                        if (Object.values(rowData).every(v => v === '' || v == null)) {
                                                            if (col > 0) { row++; col = 0; }
                                                            return null;
                                                        }
                                                        if (col >= colsCount) { row++; col = 0; }
                                                        const gx = col * (itemW + spacing);
                                                        const gy = row * (itemH + spacing);
                                                        col++;
                                                        return (
                                                            <Group key={i} x={gx} y={gy}>
                                                                <LayoutLabel
                                                                    elements={selectedTemplate.elements}
                                                                    data={rowData}
                                                                    mapping={manualMapping}
                                                                    modes={mappingModes}
                                                                    width={itemW}
                                                                    height={itemH}
                                                                    designW={selectedTemplate.canvasWidth || selectedTemplate.width}
                                                                    designH={selectedTemplate.canvasHeight || selectedTemplate.height}
                                                                    labelType={currentLabelType}
                                                                />
                                                            </Group>
                                                        );
                                                    });
                                                })()}
                                            </Group>
                                        </Layer>
                                    </Stage>
                                </div>

                                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur shadow-2xl px-6 py-3 rounded-full border border-white">
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>
                                        <ZoomOut size={16} />
                                    </button>
                                    <span className="text-xs font-bold w-12 text-center text-primary">{Math.round(zoom * 100)}%</span>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.min(3, z + 0.1))}>
                                        <ZoomIn size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}