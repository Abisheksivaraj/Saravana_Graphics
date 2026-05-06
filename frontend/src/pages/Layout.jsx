import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, FileSpreadsheet, Download,
    ArrowLeft, Search, ZoomIn, ZoomOut, Palette, Plus, X, Wand2,
    ChevronLeft, Save,
    Trash2, Cpu, Link2, AlertCircle, CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Line, Circle, Ellipse, Star, RegularPolygon, Path } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { designsAPI, stripColorsAPI, filesAPI } from '../api';
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

const PX_TO_MM = 0.264583;

// ─── Font cache ───────────────────────────────────────────────────────────────
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
                if (!response.ok) { console.warn(`Font fetch failed: ${font.file}`); continue; }
                const contentType = response.headers.get('content-type') || '';
                if (contentType.includes('text/html') || contentType.includes('text/plain')) { continue; }
                const buffer = await response.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                _fontCache[fileName] = btoa(binary);
            }
            if (_fontCache[fileName]) {
                pdf.addFileToVFS(fileName, _fontCache[fileName]);
                pdf.addFont(fileName, font.name, font.style);
            }
        } catch (e) { console.warn(`Font registration failed: ${font.name}`, e); }
    }
};

const resolvePdfFont = (fontFamily = '') => {
    const ff = fontFamily.toLowerCase();
    if (ff.includes('calibri')) return 'Calibri';
    if (ff.includes('ocr')) return 'OCR-BT';
    if (ff.includes('rupee') || ff.includes('forbidan')) return 'RupeeForbidan';
    if (ff.includes('times')) return 'times';
    if (ff.includes('courier')) return 'courier';
    return 'Arial';
};

let STRIP_COLOR_MAP = {};
const resolveStripColor = (colorName) => STRIP_COLOR_MAP[String(colorName).trim().toLowerCase()] || null;

const formatPrice = (raw) => {
    if (/^\d+(\.\d+)?$/.test(String(raw).trim())) return parseFloat(raw).toFixed(2);
    return String(raw).trim();
};

const formatNetQty = (val) => {
    const s = String(val || '').trim();
    if (!s) return s;
    if (/TOP/i.test(s) && /BOTTOM/i.test(s)) return s.replace(/\s{1,}(BOTTOM)/i, '\n$1');
    return s;
};

const isPriceColumn = (colName) => {
    const lower = (colName || '').toLowerCase();
    return lower.includes('mrp') || lower.includes('price');
};

const rupeeImageCache = {};
const getRupeeImage = (fontSizePt, color = '#000000') => {
    const cacheKey = `${fontSizePt}_${color}`;
    if (rupeeImageCache[cacheKey]) return rupeeImageCache[cacheKey];
    const scale = 4;
    const sizePx = Math.round(fontSizePt * 3.7795 * scale);
    const canvas = document.createElement('canvas');
    canvas.width = sizePx; canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.fillStyle = color;
    ctx.font = `${sizePx * 0.95}px "Rupee Forbidan", Arial, sans-serif`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText('₹', sizePx / 2, sizePx / 2);
    rupeeImageCache[cacheKey] = canvas;
    return canvas;
};

const drawRupeeText = (pdf, rawText, x, y, scaleX = 1) => {
    if (!rawText) return;
    const text = String(rawText);
    if (!text.includes('₹')) { pdf.text(text, x, y, {}); return; }
    const fs = pdf.getFontSize();
    const fsMM = fs * 0.352778;
    const imgH = fsMM * 1.10, imgW = fsMM * 0.95 * scaleX, imgY = y - fsMM * 1.01;
    const tc = pdf.getTextColor();
    const colorHex = typeof tc === 'string' && tc.startsWith('#') ? tc : '#000000';
    const rupeeImg = getRupeeImage(fs, colorHex);
    const parts = text.split('₹');
    let curX = x;
    parts.forEach((part, i) => {
        if (part.length > 0) { pdf.text(part, curX, y, {}); curX += pdf.getTextWidth(part) * scaleX; }
        if (i < parts.length - 1) {
            try { pdf.addImage(rupeeImg, 'PNG', curX, imgY, imgW, imgH); } catch (e) { }
            curX += imgW + 3 * PX_TO_MM;
        }
    });
};

const getLabelType = (design) => {
    if (!design) return 'normal';
    if (design.labelType) return design.labelType.toLowerCase();
    const title = (design.title || '').toLowerCase();
    if (title.includes('azortee') || title.includes('azorte')) return 'azortee';
    if (title.includes('livsmart')) return 'livsmart';
    return 'normal';
};

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
        const isSizeCircle = circleEl.type === 'circle' &&
            (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'));
        if (!isSizeCircle) return;
        const cCX = circleEl.x || 0, cCY = circleEl.y || 0;
        let bestText = null, bestDist = Infinity;
        sizeTextEls.forEach(textEl => {
            const dx = cCX - (textEl.x || 0), dy = cCY - (textEl.y || 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) { bestDist = dist; bestText = textEl; }
        });
        if (bestText && bestDist < 120) {
            let tv = bestText.text || '';
            Object.keys(data).forEach(col => { tv = tv.replaceAll(`{{${col}}}`, String(data[col] ?? '').trim()); });
            circleTextMap.set(circleEl.id, tv.trim().toUpperCase());
        }
    });
    return circleTextMap;
};

// ─── EPC / RFID utilities ─────────────────────────────────────────────────────

/**
 * Normalize a barcode/EAN to pure digits string for fuzzy matching.
 * Handles leading zeros, spaces, and Excel numeric format.
 */
const normBarcode = (val) => String(val || '').replace(/\D/g, '');

/**
 * Build EPC lookup map: { barcodeValue: [epc1, epc2, ...] }
 *
 * Key insight: RFID Excel may have MULTIPLE barcode/EAN columns (e.g. "Barcode",
 * "EAN", "EAN13"). We index by the value of EVERY such column so the lookup
 * succeeds regardless of which column the label-data Excel uses.
 *
 * Also indexes by pure-digit normalised value to handle Excel numeric format
 * mismatches (leading-zero stripping, scientific notation, etc.).
 */
const buildEpcMap = (rfidRows) => {
    const map = {};
    if (!rfidRows || rfidRows.length === 0) return map;

    const addToMap = (key, epcList) => {
        if (!key) return;
        // Original string key
        if (!map[key]) map[key] = epcList;
        // Pure-digit normalised key
        const norm = normBarcode(key);
        if (norm && norm !== key && !map[norm]) map[norm] = epcList;
    };

    rfidRows.forEach(row => {
        const keys = Object.keys(row);
        // Find the EPC column (must exist)
        const epcKey = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '') === 'epc'
            || k.toLowerCase().includes('epc'));
        const epc = epcKey ? String(row[epcKey] || '').trim() : '';
        if (!epc) return;

        const qrKey = keys.find(k => {
            const l = k.toLowerCase().replace(/[\s_-]/g, '');
            return l === 'qr' || l === 'qrcode' || l === 'qrvalue';
        });
        const qr = (qrKey ? String(row[qrKey] || '').trim() : '') || epc;

        // Collect ALL barcode/EAN column keys in this row
        const barcodeKeys = keys.filter(k => {
            const lower = k.toLowerCase().replace(/[\s_-]/g, '');
            return (
                lower === 'barcode' || lower === 'ean' || lower === 'ean13' ||
                lower === 'gtin' || lower.includes('barcode') || lower.includes('ean')
            );
        });

        // For each barcode/EAN column, add value → { epc, qr } to the map
        barcodeKeys.forEach(bk => {
            const val = String(row[bk] || '').trim();
            if (!val) return;
            if (!map[val]) map[val] = [];
            // Share the same array across all keys pointing to the same val
            addToMap(val, map[val]);
            map[val].push({ epc, qr });
        });
    });

    return map;
};


/**
 * Expand label data rows:
 * For each label row, repeat Final Qty times, assigning a unique EPC each time.
 * Returns: [ { ...rowData, __epc: 'XXXX', __labelIndex: N, __totalForEan: M }, ... ]
 */
const expandLabelRows = (labelData, epcMap) => {
    const expanded = [];
    const consumedIdx = {};

    labelData.forEach((row, rowIndex) => {
        if (Object.values(row).every(v => v === '' || v == null)) {
            expanded.push({ ...row, __blank: true, __originalRowIndex: rowIndex });
            return;
        }

        // Find EAN/Barcode column — match any column that looks like a barcode
        const eanKey = Object.keys(row).find(k => {
            const lower = k.toLowerCase().replace(/[\s_-]/g, '');
            return lower === 'ean' || lower === 'ean13' || lower === 'barcode' ||
                lower.includes('ean') || lower.includes('barcode') || lower.includes('gtin');
        });

        const qtyKey = Object.keys(row).find(k => {
            const lower = k.toLowerCase().replace(/\s/g, '');
            return lower === 'finalqty' || lower === 'qty' || lower === 'quantity';
        });

        const ean = eanKey ? String(row[eanKey] || '').trim() : '';
        const qty = qtyKey ? parseInt(row[qtyKey], 10) : 1;
        const safeQty = isNaN(qty) || qty < 1 ? 1 : qty;

        // 1. Exact string match
        let availableEpcs = epcMap[ean] || [];

        // 2. Pure-digit match (handles Excel stripping leading zeros)
        if (!availableEpcs.length && ean) {
            const normEan = normBarcode(ean);
            if (normEan && normEan !== ean) availableEpcs = epcMap[normEan] || [];
        }

        if (!availableEpcs.length && ean) {
            const normEan = normBarcode(ean);
            const matchKey = Object.keys(epcMap).find(k => normBarcode(k) === normEan);
            if (matchKey) availableEpcs = epcMap[matchKey];
        }

        if (!(ean in consumedIdx)) consumedIdx[ean] = 0;

        for (let i = 0; i < safeQty; i++) {
            const epcIdx = consumedIdx[ean];
            const entry = availableEpcs[epcIdx] || { epc: '', qr: '' };
            consumedIdx[ean]++;
            expanded.push({
                ...row,
                __epc: entry.epc,
                __qr: entry.qr || entry.epc,
                __ean: ean,
                __labelIndex: i + 1,
                __totalForEan: safeQty,
                __originalRowIndex: rowIndex
            });
        }
    });

    return expanded;
};

// ─── Canvas Preview Label ─────────────────────────────────────────────────────
const LayoutLabel = ({
    elements = [], data = {}, mapping = {}, width, height,
    designW, designH, isBranding = false, logoImg = null,
    labelType = 'normal', modes = {},
}) => {
    const mergedElements = useMemo(() => {
        const sizeCol = Object.keys(data).find(k => k.toLowerCase() === 'size' || k.toLowerCase().includes('size'));
        const sizeVal = sizeCol ? String(data[sizeCol] || '').trim().toUpperCase() : '';

        if (isBranding) {
            return [
                { type: 'rect', x: 0, y: 0, width, height, fill: '#ffffff' },
                logoImg ? { type: 'image', x: 0, y: 0, width, height, image: logoImg, zIndex: 10 } : null,
            ].filter(Boolean);
        }

        if (labelType === 'azortee') {
            const circleTextMap = buildAzorteeCircleMap(elements, data);
            return elements.map(el => {
                const elName = (el.name || '').toLowerCase();
                const isSizeCircle = el.type === 'circle' &&
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
                if ((el.type === 'text' || el.type === 'placeholder') && sizeVal && !el.text?.includes('{{')) {
                    const cleanText = (el.text || '').trim().toUpperCase();
                    if (cleanText === sizeVal && cleanText.length < 8) {
                        const padding = 1.5, fsPx = el.fontSize || 12;
                        const charW = fsPx * 0.6, textW = cleanText.length * charW;
                        const rectW = (el.width && el.width > 10 ? el.width : textW) + padding * 2;
                        const rectH = fsPx * 1.4;
                        result.push({
                            id: `__livsmart_rect_${el.id}`, type: 'rect',
                            x: (el.x || 0) - padding, y: (el.y || 0) - padding,
                            width: rectW, height: rectH, fill: '#000000',
                            zIndex: (el.zIndex || 0) - 0.5, visible: true,
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
            if (el.type === 'circle' && (elName.includes('sizeindicator') || elName.includes('sizecircle'))) {
                newEl.visible = false;
            }
            if (el.type === 'text' || el.type === 'placeholder') {
                const cleanV = (newEl.text || '').trim().toUpperCase();
                if (sizeVal && cleanV === sizeVal && cleanV.length < 6) {
                    newEl.fill = '#000000'; newEl.isHighlightedSize = true;
                }
            }
            if (el.type === 'rect') {
                const isSizeBox = elements.some(other => {
                    if (other.type !== 'text' && other.type !== 'placeholder') return false;
                    const ot = (other.text || '').trim().toUpperCase();
                    if (!sizeVal || ot !== sizeVal || ot.length >= 6) return false;
                    return Math.abs((other.x || 0) - (el.x || 0)) <= 8 && Math.abs((other.y || 0) - (el.y || 0)) <= 8;
                });
                if (isSizeBox) newEl.fill = '#000000';
            }
            return newEl;
        });
    }, [elements, data, mapping, modes, isBranding, logoImg, width, height, labelType]);

    const sorted = useMemo(() => [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)), [mergedElements]);
    const dW = designW || 166, dH = designH || 387;
    const s = Math.min(width / dW, height / dH);
    const ox = (width - dW * s) / 2, oy = (height - dH * s) / 2;

    return (
        <Group>
            <Rect width={width} height={height} fill="white" stroke="#e2e8f0" strokeWidth={1} cornerRadius={8} />
            <Group x={ox} y={oy} scaleX={s} scaleY={s}>
                {sorted.map((el, i) => {
                    const key = el.id || `el-${i}`;
                    const common = {
                        x: el.x || 0, y: el.y || 0, rotation: el.rotation || 0,
                        scaleX: el.scaleX || 1, scaleY: el.scaleY || 1,
                        opacity: el.opacity !== undefined ? el.opacity : 1,
                        visible: el.visible !== false,
                    };
                    switch (el.type) {
                        case 'text':
                        case 'placeholder': {
                            const txt = el.text || '';
                            const fs = el.fontSize || 12, ff = el.fontFamily || 'Arial', col = el.fill || '#000000';
                            const isItalic = el.fontStyle === 'italic', weight = el.fontWeight || 'normal';
                            const textAlign = el.textAlign || 'left';
                            const wrapWidth = el.wrap === 'none' || (el.width || 200) < 20 ? undefined : el.width || 200;
                            if (!txt.includes('₹')) {
                                return (
                                    <Group key={key} {...common}>
                                        <Text text={txt} fontSize={fs} fontFamily={ff}
                                            fontStyle={`${isItalic ? 'italic' : 'normal'} ${weight}`}
                                            align={textAlign} fill={col} width={wrapWidth}
                                            wrap={wrapWidth ? 'word' : 'none'}
                                            letterSpacing={el.letterSpacing || 0}
                                            lineHeight={el.lineHeight || 1.2}
                                            textDecoration={el.underline ? 'underline' : 'none'} />
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
                                        const rH = fs * 0.85, rW = fs * 0.72, rY = fs * 0.05;
                                        parts.forEach((p, i) => {
                                            if (p) {
                                                items.push(<Text key={`p-${i}`} x={currentX} y={0} text={p} fontSize={fs} fontFamily={ff} fontStyle={`${isItalic ? 'italic' : 'normal'} ${weight}`} fill={col} letterSpacing={el.letterSpacing || 0} />);
                                                const canvas = document.createElement('canvas');
                                                const context = canvas.getContext('2d');
                                                context.font = `${fs}px ${ff}`;
                                                currentX += context.measureText(p).width + (el.letterSpacing || 0);
                                            }
                                            if (i < parts.length - 1) {
                                                items.push(<KImage key={`r-${i}`} x={currentX} y={rY} image={rupeeImg} width={rW} height={rH} />);
                                                currentX += rW + 4;
                                            }
                                        });
                                        if (textAlign === 'center' && wrapWidth) return <Group x={(wrapWidth - currentX) / 2}>{items}</Group>;
                                        if (textAlign === 'right' && wrapWidth) return <Group x={wrapWidth - currentX}>{items}</Group>;
                                        return items;
                                    })()}
                                </Group>
                            );
                        }
                        case 'rect':
                            return <Rect key={key} {...common} width={el.width || 0} height={el.height || 0} fill={el.fill || 'transparent'} cornerRadius={el.cornerRadius || 0} stroke={el.stroke || 'transparent'} strokeWidth={el.strokeWidth || 0} />;
                        case 'line':
                            return <Line key={key} {...common} points={el.points || [0, 0, 100, 0]} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth || 1} />;
                        case 'circle':
                            return <Circle key={key} {...common} radius={el.radius || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                        case 'ellipse':
                            return <Ellipse key={key} {...common} radiusX={el.radiusX || 10} radiusY={el.radiusY || 10} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
                        case 'barcode':
                            return <BarcodeElement key={key} {...common} el={el} onSelect={() => { }} />;
                        case 'qrcode':
                            return <QRElement key={key} {...common}
                                el={{ ...el, qrValue: el.qrValue || '' }}
                                onSelect={() => { }} />;
                        case 'image':
                            if (el.image) return <KImage key={key} {...common} image={el.image} width={el.width} height={el.height} />;
                            return <ImageElement key={key} {...common} el={el} />;
                        default:
                            return null;
                    }
                })}
            </Group>
        </Group>
    );
};

// ─── resolveElement helper ────────────────────────────────────────────────────
function resolveElement(el, data, mapping, modes = {}) {
    let newEl = { ...el };
    const elName = (el.name || '').toLowerCase();
    const manualMapped = mapping[el.id];
    const isPlaceholder = el.type === 'placeholder' || (el.text && el.text.includes('{{'));
    const isBarcodeQR = el.type === 'barcode' || el.type === 'qrcode';
    const isRect = el.type === 'rect';

    // ── EPC override: if this element is mapped to __epc ───────────────────
    // For QR elements, EPC always wins regardless of mapping
    if (el.type === 'qrcode') {
        if (data.__epc) { newEl.qrValue = data.__epc; return newEl; }
        if (manualMapped && data[manualMapped] !== undefined) {
            newEl.qrValue = String(data[manualMapped] ?? '').replace(/^[₹\s]+/, '').trim();
            return newEl;
        }
        // Fallback: look for EPC column in row data
        const epcCol = Object.keys(data || {}).find(c =>
            c.toLowerCase() === 'epc' || c.toLowerCase() === 'epc code'
        );
        if (epcCol && data[epcCol]) { newEl.qrValue = String(data[epcCol]).trim(); return newEl; }
        // Do NOT fall through to EAN/barcode — leave qrValue as template default
        return newEl;
    }

    // ── EAN barcode override ───────────────────────────────────────────────
    if (manualMapped === '__ean' || (el.type === 'barcode' && !manualMapped && data.__ean)) {
        if (el.type === 'barcode') { newEl.barcodeValue = data.__ean || ''; return newEl; }
    }

    if (manualMapped && data[manualMapped] !== undefined && (isPlaceholder || isBarcodeQR || isRect)) {
        const raw = String(data[manualMapped] ?? '').replace(/^[₹\s]+/, '').trim();
        const forcedMode = modes[el.id];
        if (forcedMode === 'qrcode') { newEl.type = 'qrcode'; newEl.qrValue = data.__epc || raw; return newEl; }
        if (forcedMode === 'ean13') { newEl.type = 'barcode'; newEl.barcodeValue = raw; newEl.barcodeFormat = 'EAN13'; return newEl; }
        if (forcedMode === 'barcode') { newEl.type = 'barcode'; newEl.barcodeValue = raw; newEl.barcodeFormat = 'CODE128'; return newEl; }
        if (forcedMode === 'text') { newEl.type = 'text'; newEl.text = raw; return newEl; }
        if (el.type === 'text' || el.type === 'placeholder') {
            newEl.text = formatNetQty(isPriceColumn(manualMapped) ? formatPrice(raw) : raw);
        } else if (el.type === 'barcode') { newEl.barcodeValue = raw; }
        else if (el.type === 'qrcode') { newEl.qrValue = data.__epc || raw; }
        else if (el.type === 'rect') { const mc = resolveStripColor(raw.trim()); if (mc) newEl.fill = mc; }
        return newEl;
    }

    if (el.type === 'barcode' && !manualMapped) {
        const eanCol = Object.keys(data || {}).find(c => c.toLowerCase().includes('ean'));
        if (eanCol && data[eanCol] !== undefined) {
            newEl.barcodeValue = String(data[eanCol] ?? '').replace(/^[₹\s]+/, '').trim();
        } else if (data.__ean) {
            newEl.barcodeValue = data.__ean;
        }
    }

    if (el.type === 'qrcode') {
        // EPC is the ONLY valid data source for QR elements.
        // Priority: __epc > forced manual mapping > EPC column in row data.
        // If __ean is set (row came from expandLabelRows) but __epc is empty,
        // return empty rather than falling through to the static el.qrValue (which is an EAN).
        if (data.__epc && String(data.__epc).trim()) {
            newEl.qrValue = String(data.__epc).trim();
            return newEl;
        }
        if (manualMapped && data[manualMapped] !== undefined) {
            newEl.qrValue = String(data[manualMapped] ?? '').replace(/^[₹\s]+/, '').trim();
            return newEl;
        }
        // Check for an EPC column directly in the row (label Excel has EPC col)
        const epcCol = Object.keys(data || {}).find(c =>
            c.toLowerCase() === 'epc' || c.toLowerCase().includes('epc')
        );
        if (epcCol && data[epcCol]) {
            newEl.qrValue = String(data[epcCol]).trim();
            return newEl;
        }
        // Row was expanded (has __ean) but no EPC assigned → render blank QR
        if ('__ean' in data) {
            newEl.qrValue = '';
            return newEl;
        }
    }

    if (el.type === 'text' || el.type === 'placeholder') {
        let t = el.text || '';
        Object.keys(data).forEach(col => {
            if (col.startsWith('__')) return;
            const ph = `{{${col}}}`;
            if (t.includes(ph)) {
                const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
                t = t.replaceAll(ph, isPriceColumn(col) ? formatPrice(raw) : raw);
            }
        });
        newEl.text = formatNetQty(t);
    }

    if (el.type === 'rect') {
        const isStrip = elName.includes('strip') || elName.includes('color') ||
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

// ─── QR value resolver ────────────────────────────────────────────────────────
function resolveQRValue(el, data, mapping) {
    // __qr is ALWAYS highest priority for QR codes, falling back to __epc
    if (data.__qr) return data.__qr;
    if (data.__epc) return data.__epc;

    const mp = mapping[el.id];
    if (mp === '__epc') return data.__epc || '';
    if (mp && data[mp] !== undefined)
        return String(data[mp] ?? '').replace(/^[₹\s]+/, '').trim();

    // Check for EPC column directly in row data
    const epcCol = Object.keys(data || {}).find(c =>
        c.toLowerCase() === 'epc' || c.toLowerCase().includes('epc')
    );
    if (epcCol && data[epcCol])
        return String(data[epcCol]).trim();

    const fieldKey = (el.fieldName || el.name || '').toLowerCase();
    if (fieldKey) {
        const matchedCol = Object.keys(data || {}).find(c => c.toLowerCase() === fieldKey);
        if (matchedCol && data[matchedCol] !== undefined)
            return String(data[matchedCol] ?? '').replace(/^[₹\s]+/, '').trim();
    }

    const qrCol = Object.keys(data || {}).find(c => c.toLowerCase().includes('qr'));
    if (qrCol && data[qrCol] !== undefined)
        return String(data[qrCol] ?? '').replace(/^[₹\s]+/, '').trim();

    // Static fallback only if no data mapping possible
    const direct = el.qrValue || el.value || el.data || '';
    if (direct && direct !== 'QR' && direct !== '') return String(direct).trim();

    return '';
}

// ─── Download Modal ───────────────────────────────────────────────────────────
function DownloadModal({ onClose, selectedTemplate, manualMapping, mappingModes, drawVectorLabel }) {
    const [step, setStep] = useState(1);
    const [labelFile, setLabelFile] = useState(null);
    const [epcFile, setEpcFile] = useState(null);
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const labelInputRef = useRef();
    const epcInputRef = useRef();

    const handleValidate = () => {
        if (!labelFile) { setError('Please upload the label file.'); return; }
        setError('');
        try {
            const reader1 = new FileReader();
            reader1.onload = (e) => {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const labelRows = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
                
                if (epcFile) {
                    const reader2 = new FileReader();
                    reader2.onload = (evt) => {
                        const epcWb = XLSX.read(evt.target.result, { type: 'binary' });
                        const epcWs = epcWb.Sheets['EPC_Data'] || epcWb.Sheets[epcWb.SheetNames[0]];
                        const rfidRows = XLSX.utils.sheet_to_json(epcWs, { defval: '' });
                        const epcMap = buildEpcMap(rfidRows);
                        const expanded = expandLabelRows(labelRows, epcMap);
                        finishValidation(expanded, epcMap);
                    };
                    reader2.readAsBinaryString(epcFile);
                } else {
                    const expanded = expandLabelRows(labelRows, {});
                    finishValidation(expanded, null);
                }
            };
            reader1.readAsBinaryString(labelFile);
        } catch (err) { setError('Validation failed: ' + err.message); }
    };

    const finishValidation = (expanded, epcMap) => {
        let total = 0, matched = 0;
        const validRows = expanded.filter(r => !r.__blank);
        validRows.forEach(r => {
            total++;
            if (r.__epc) matched++;
        });
        setSummary({ totalLabels: total, matched, unmatched: total - matched, validRows });
        setStep(2);
    };

    const handleGenerate = async (mode = 'full') => {
        setStep(3);
        try {
            const _unit2 = selectedTemplate.canvasUnit || 'px';
            const _dW2 = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const _dH2 = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const lW = _unit2 === 'mm' ? _dW2 : _dW2 * PX_TO_MM;
            const lH = _unit2 === 'mm' ? _dH2 : _dH2 * PX_TO_MM;
            const ori = lW > lH ? 'landscape' : 'portrait';

            if (mode === 'rowwise') {
                const grouped = {};
                summary.validRows.forEach(row => {
                    if (!grouped[row.__originalRowIndex]) grouped[row.__originalRowIndex] = [];
                    grouped[row.__originalRowIndex].push(row);
                });

                const groupKeys = Object.keys(grouped);
                for (let g = 0; g < groupKeys.length; g++) {
                    const groupRows = grouped[groupKeys[g]];
                    const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });
                    let first = true;
                    for (let i = 0; i < groupRows.length; i++) {
                        if (!first) pdf.addPage([lW, lH], ori);
                        first = false;
                        await drawVectorLabel(pdf, selectedTemplate.elements, groupRows[i], manualMapping, 0, 0, lW, lH, false, true, mappingModes);
                    }
                    const eanVal = groupRows[0].__ean || `row_${g+1}`;
                    pdf.save(`Labels_${eanVal}.pdf`);
                    setProgress(Math.round(((g + 1) / groupKeys.length) * 100));
                    await new Promise(r => setTimeout(r, 300)); // allow browser to handle download
                }
            } else {
                const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });
                let first = true;
                for (let i = 0; i < summary.validRows.length; i++) {
                    if (!first) pdf.addPage([lW, lH], ori);
                    first = false;
                    await drawVectorLabel(pdf, selectedTemplate.elements, summary.validRows[i], manualMapping, 0, 0, lW, lH, false, true, mappingModes);
                    if (i % 20 === 0) {
                        setProgress(Math.round(((i + 1) / summary.validRows.length) * 100));
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
                pdf.save(`Batch_Labels_${Date.now()}.pdf`);
            }

            setProgress(100);
            setStep(4);
        } catch (err) { setError('Generation failed: ' + err.message); setStep(2); }
    };

    const sectionStyle = {
        background: 'var(--bg-card, white)',
        border: '1px solid var(--border-light, #e2e8f0)',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 14,
    };

    const uploadZone = (label, hint, ref, fileState, setFile, icon) => (
        <div
            onClick={() => ref.current?.click()}
            style={{
                border: `2px dashed ${fileState ? '#10b981' : 'var(--border-light, #e2e8f0)'}`,
                borderRadius: 10,
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: fileState ? '#f0fdf4' : 'var(--bg-subtle, #f8fafc)',
                transition: 'all 0.2s',
            }}
        >
            <input
                type="file"
                ref={ref}
                hidden
                accept=".xlsx,.xls"
                onChange={e => { setFile(e.target.files[0]); e.target.value = ''; }}
            />
            <div style={{ color: fileState ? '#059669' : 'var(--text-muted, #64748b)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                {icon}
            </div>
            <div style={{ fontSize: 14, fontWeight: '600', color: fileState ? '#065f46' : 'var(--text-main, #1e293b)' }}>
                {fileState ? fileState.name : label}
            </div>
            <div style={{ fontSize: 12, color: fileState ? '#34d399' : 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                {fileState ? 'Click to change file' : hint}
            </div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div style={{ background: 'white', borderRadius: 16, width: 600, maxWidth: '95vw', padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ background: '#f5f3ff', color: '#8b5cf6', padding: 10, borderRadius: 12 }}><Layers size={22} /></div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, color: '#1e293b', fontWeight: '700' }}>Generate batch labels</h2>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Upload label and EPC data files</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, position: 'relative' }}>
                    <div style={{ height: 2, background: '#f1f5f9', position: 'absolute', left: 0, right: 0, top: 12, zIndex: 0 }} />
                    {[
                        { num: 1, label: 'Upload files' },
                        { num: 2, label: 'Review' },
                        { num: 3, label: 'Generate' }
                    ].map((s, i) => (
                        <div key={s.num} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 1, background: 'white', padding: '0 8px', justifyContent: i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s.num ? '#8b5cf6' : '#e2e8f0', color: step >= s.num ? 'white' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{s.num}</div>
                            <span style={{ fontSize: 12, fontWeight: '600', color: step >= s.num ? '#8b5cf6' : '#94a3b8' }}>{s.label}</span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                {step === 1 && (
                    <div className="modal-step-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <div style={sectionStyle}>
                            <div style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>A — LABEL GENERATION FILE</div>
                            {uploadZone('Upload label file (.xlsx)', 'Data required for the layout', labelInputRef, labelFile, setLabelFile, <FileSpreadsheet size={24} />)}
                        </div>

                        <div style={sectionStyle}>
                            <div style={{ fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>B — EPC-QR MAPPING FILE (OPTIONAL)</div>
                            {uploadZone('Upload EPC mapping file (.xlsx)', 'Barcode + EPC codes', epcInputRef, epcFile, setEpcFile, <Link2 size={24} />)}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                            <button className="btn btn-primary px-6" onClick={handleValidate} disabled={!labelFile}>Validate & continue</button>
                        </div>
                    </div>
                )}

                {step === 2 && summary && (
                    <div className="modal-step-content">
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20 }}>
                            <div style={{ fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 4 }}>{summary.totalLabels.toLocaleString()}</div>
                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Total labels to generate</div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: '600', fontSize: 13, marginBottom: 4 }}><CheckCircle2 size={14} /> EPC Matched</div>
                                    <div style={{ fontSize: 20, fontWeight: '700', color: '#1e293b' }}>{summary.matched.toLocaleString()}</div>
                                </div>
                                <div style={{ background: 'white', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: summary.unmatched > 0 ? '#dc2626' : '#64748b', fontWeight: '600', fontSize: 13, marginBottom: 4 }}>{summary.unmatched > 0 ? <AlertCircle size={14} /> : <div style={{ width: 14 }} />} EPC Missing</div>
                                    <div style={{ fontSize: 20, fontWeight: '700', color: '#1e293b' }}>{summary.unmatched.toLocaleString()}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
                            <button className="btn btn-secondary px-4 gap-2" onClick={() => handleGenerate('rowwise')}>
                                <Layers size={16} /> Row Wise ({new Set(summary.validRows.map(r => r.__originalRowIndex)).size} PDFs)
                            </button>
                            <button className="btn btn-primary px-6 gap-2" onClick={() => handleGenerate('full')}>
                                <Cpu size={16} /> Full ({summary.totalLabels} labels)
                            </button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="modal-step-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Cpu size={32} className="animate-pulse" />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>Generating PDF…</h3>
                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', margin: '20px auto', maxWidth: 300 }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: '#8b5cf6', transition: 'width 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{progress}% completed. Please don't close this window.</div>
                    </div>
                )}

                {step === 4 && (
                    <div className="modal-step-content" style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={32} />
                        </div>
                        <h3 style={{ fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 8 }}>Download Complete!</h3>
                        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Your labels have been successfully generated and saved.</div>
                        <button className="btn btn-primary px-8" onClick={onClose}>Done</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Layout() {
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useUIStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [excelData, setExcelData] = useState([]);           // raw label rows
    const [rfidData, setRfidData] = useState([]);             // raw RFID rows
    const [epcMap, setEpcMap] = useState({});                 // { ean: [epc, ...] }
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [expandedData, setExpandedData] = useState([]);     // final expanded rows
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
    const [epcStats, setEpcStats] = useState(null); // { total, matched, unmatched }
    const stageRef = useRef();

    useEffect(() => {
        const img = new window.Image();
        img.src = logo;
        img.onload = () => setLogoImg(img);
        fetchStripColors();
        fetchDesigns();
    }, []);

    // ── Re-expand whenever source data or epcMap changes ─────────────────────
    useEffect(() => {
        if (excelData.length === 0) { setExpandedData([]); return; }
        const exp = expandLabelRows(excelData, epcMap);
        setExpandedData(exp);

        // Compute EPC stats
        if (Object.keys(epcMap).length > 0) {
            let total = 0, matched = 0;
            exp.forEach(row => {
                if (row.__blank) return;
                total++;
                if (row.__epc) matched++;
            });
            setEpcStats({ total, matched, unmatched: total - matched });
        } else {
            setEpcStats(null);
        }
    }, [excelData, epcMap]);

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
        { name: 'Process Magenta', cmyk: '0,100,0,0', hex: '#EC008C' },
        { name: 'Purple', cmyk: '60,60,0,0', hex: '#92278F' },
        { name: 'Process Cyan', cmyk: '100,0,0,0', hex: '#00AEEF' },
        { name: 'Royal Blue', cmyk: '100,60,0,0', hex: '#2E3192' },
        { name: 'Navy Blue', cmyk: '100,100,0,40', hex: '#000080' },
        { name: 'Teal', cmyk: '100,0,40,0', hex: '#00A99D' },
        { name: 'Press Green', cmyk: '100,0,100,0', hex: '#00A651' },
        { name: 'Forest Green', cmyk: '100,0,100,40', hex: '#006837' },
        { name: 'White', cmyk: '0,0,0,0', hex: '#FFFFFF' },
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

    const [cmykInput, setCmykInput] = useState({ name: '', c: 0, m: 0, y: 0, k: 0 });

    const handleDeleteColor = async (e, colorId) => {
        e.stopPropagation();
        try {
            const updated = stripColors.filter(c => c._id !== colorId);
            setStripColors(updated);
            const map = {};
            updated.forEach(c => { map[c.name.toLowerCase()] = c.hex; });
            STRIP_COLOR_MAP = map;
            toast.success('Color removed');
            if (!String(colorId).startsWith('custom-') && !String(colorId).startsWith('def-')) {
                await stripColorsAPI.delete(colorId);
            }
        } catch (err) { toast.error('Failed to delete color'); }
    };

    const handleAddCMYKColor = async () => {
        if (!cmykInput.name.trim()) return toast.error('Enter a color name');
        const c = cmykInput.c / 100, m = cmykInput.m / 100, y = cmykInput.y / 100, k = cmykInput.k / 100;
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        const rgbToHex = v => v.toString(16).padStart(2, '0');
        const hex = `#${rgbToHex(r)}${rgbToHex(g)}${rgbToHex(b)}`.toUpperCase();
        const newColor = { _id: `custom-${Date.now()}`, name: cmykInput.name.trim(), hex, cmyk: `${cmykInput.c},${cmykInput.m},${cmykInput.y},${cmykInput.k}` };
        const updatedColors = [...stripColors, newColor];
        setStripColors(updatedColors);
        STRIP_COLOR_MAP[newColor.name.toLowerCase()] = hex;
        setCmykInput({ name: '', c: 0, m: 0, y: 0, k: 0 });
        toast.success(`${newColor.name} added with Hex ${hex}`);
        try { await stripColorsAPI.create({ name: newColor.name, hex }); } catch (e) { }
    };

    const handleSelectTemplate = async designId => {
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
                        fields.push({ id: el.id, name: el.fieldName || el.name || 'strip', type: 'rect', label: el.fieldName || el.name || 'Strip Color' });
                    }
                    return;
                }
                const matches = el.text?.match(/{{(.*?)}}/g);
                if (matches) {
                    matches.forEach(m => {
                        const name = m.replace(/{{|}}/g, '');
                        if (!fields.find(f => f.name === name)) fields.push({ id: el.id, name, type: 'placeholder', label: `{{${name}}}` });
                    });
                } else if (el.type !== 'text') {
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

    // ── Label Excel Upload ─────────────────────────────────────────────────────
    const handleFileUpload = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            let bestSheet = wb.Sheets[wb.SheetNames[0]], bestColCount = 0;
            wb.SheetNames.forEach(name => {
                const sheet = wb.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                if (rows.length === 0) return;
                const headerCount = rows[0].filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
                if (headerCount > bestColCount) { bestColCount = headerCount; bestSheet = sheet; }
            });
            const data = XLSX.utils.sheet_to_json(bestSheet, { defval: '', blankrows: true });
            if (data.length > 0) {
                setExcelData(data);
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

    // ── RFID / EPC Excel Upload ───────────────────────────────────────────────
    const handleRfidFileUpload = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = evt => {
            const wb = XLSX.read(evt.target.result, { type: 'binary' });
            let sheet = wb.Sheets['EPC_Data'] || wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (rows.length === 0) { toast.error('No data found in RFID file'); return; }

            setRfidData(rows);
            const map = buildEpcMap(rows);
            setEpcMap(map);

            // Debug: show first key and value so you can verify matching
            const firstKey = Object.keys(map)[0];
            if (firstKey) {
                console.log(`EPC Map sample — Barcode: "${firstKey}" → EPC[0]: "${map[firstKey][0]}"`);
                toast(`Sample: ${firstKey} → ${map[firstKey][0]?.substring(0, 12)}…`, { icon: '🔍', duration: 4000 });
            }

            const totalEpcs = rows.length;
            const uniqueEans = Object.keys(map).length;

            if (uniqueEans === 0) {
                toast.error(`RFID loaded but no Barcode/EPC columns matched. Found: ${detectedCols.join(', ')}`);
            } else {
                toast.success(`RFID loaded: ${totalEpcs} EPCs across ${uniqueEans} barcodes`);
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

    // ─── Unified text value resolver ──────────────────────────────────────────
    const resolveTextValue = (el, data, mapping) => {
        let val = el.text || '';
        const mapped = mapping[el.id];
        const isPlaceholder = el.type === 'placeholder' || (el.text && el.text.includes('{{'));
        const isBarcodeQR = el.type === 'barcode' || el.type === 'qrcode';
        const isRect = el.type === 'rect';

        if (mapped && data[mapped] !== undefined && (isPlaceholder || isBarcodeQR || isRect)) {
            const raw = String(data[mapped] ?? '').replace(/^[₹\s]+/, '').trim();
            return formatNetQty(isPriceColumn(mapped) ? formatPrice(raw) : raw);
        }

        let hadPh = false;
        Object.keys(data).forEach(col => {
            if (col.startsWith('__')) return;
            const ph = `{{${col}}}`;
            if (val.includes(ph)) {
                hadPh = true;
                const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
                val = val.replaceAll(ph, isPriceColumn(col) ? formatPrice(raw) : raw);
            }
        });

        if (!hadPh && el.fieldName && (isBarcodeQR || isRect || el.type === 'placeholder')) {
            const ac = Object.keys(data).find(col => col.toLowerCase() === el.fieldName.toLowerCase());
            if (ac && data[ac] !== undefined) val = String(data[ac] ?? '').replace(/^[₹\s]+/, '').trim();
        }

        while (/₹\s*₹/.test(val)) val = val.replace(/₹\s*₹/g, '₹');
        return formatNetQty(val);
    };

    const renderQRAtPos = async (pdf, qv, qx, qy, qsz, fill = '#000000') => {
        try {
            const dataUrl = await QRCode.toDataURL(qv, {
                margin: 1, errorCorrectionLevel: 'M', width: 512,
                color: { dark: fill || '#000000', light: '#ffffff' },
            });
            pdf.addImage(dataUrl.split(',')[1], 'PNG', qx, qy, qsz, qsz);
        } catch (e) { console.warn('QR render failed:', e); }
    };

    const drawVectorBarcode = async (pdf, value, x, y, w, h, format, fill, isProduction = false) => {
        try {
            const fmt = (format || 'CODE128').toUpperCase();
            if (fmt === 'QRCODE') {
                const qsz = Math.min(w, h);
                await renderQRAtPos(pdf, value, x + (w - qsz) / 2, y + (h - qsz) / 2, qsz, fill);
                return;
            }
            const isEAN13 = fmt === 'EAN13';
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
                const fsPt = isProduction ? 9 : 6, fsMM = fsPt * 0.352778;
                const barZoneH = h - fsMM - 0.1, guardH = barZoneH + 1.2;
                const unitW = w / 109, bsX = x + unitW * 7;
                const isG = i => i < 3 || (i >= 45 && i < 50) || i >= 92;
                pdf.setFillColor(fill || '#000000');
                let cx = bsX;
                for (let i = 0; i < 95;) {
                    if (bits[i] === '1') {
                        let sp = 1;
                        while (i + sp < 95 && bits[i + sp] === '1' && isG(i + sp) === isG(i)) sp++;
                        pdf.rect(cx, y, unitW * sp, isG(i) ? guardH : barZoneH, 'F');
                        cx += unitW * sp; i += sp;
                    } else { cx += unitW; i++; }
                }
                try { pdf.setFont('OCR-BT', 'normal'); } catch (e) { pdf.setFont('courier', 'normal'); }
                pdf.setFontSize(fsPt);
                const ty = y + barZoneH + fsMM * 1.0 - 2 * PX_TO_MM;
                pdf.text(s[0], x + unitW * 2.5, ty, { align: 'center' });
                for (let i = 0; i < 6; i++) pdf.text(s[i + 1], bsX + unitW * (3 + i * 7 + 3.5), ty, { align: 'center' });
                for (let i = 0; i < 6; i++) pdf.text(s[i + 7], bsX + unitW * (50 + i * 7 + 3.5), ty, { align: 'center' });
            } else {
                const bd = {};
                JsBarcode(bd, String(value || '123456789'), { format: fmt.replace(/\s/g, ''), margin: 0 });
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
                            pdf.rect(cx, y, unitW * sp, barH, 'F'); cx += unitW * sp; i += sp;
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
    const drawVectorLabel = async (pdf, elements, data, mapping, mmX, mmY, mmW, mmH, isBranding = false, isProduction = false, modes = {}) => {
        await loadCustomFonts(pdf);
        const labelType = getLabelType(selectedTemplate);
        const unit = selectedTemplate?.canvasUnit || 'px';
        const rawW = selectedTemplate?.canvasWidth || selectedTemplate?.width || 166;
        const rawH = selectedTemplate?.canvasHeight || selectedTemplate?.height || 387;
        const dWmm = unit === 'mm' ? rawW : rawW * PX_TO_MM;
        const dHmm = unit === 'mm' ? rawH : rawH * PX_TO_MM;
        const cs = Math.min(mmW / dWmm, mmH / dHmm);
        const offX = mmX + (mmW - dWmm * cs) / 2, offY = mmY + (mmH - dHmm * cs) / 2;
        const canvasRadius = selectedTemplate?.canvasRadius || 10;
        const tagR = isProduction ? 0 : Math.min(4, canvasRadius * PX_TO_MM * cs);

        pdf.setFillColor('#ffffff');
        tagR > 0 ? pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F') : pdf.rect(mmX, mmY, mmW, mmH, 'F');

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
                    const drawW = mmW * 0.85, drawH = drawW * aspect;
                    pdf.addImage(bImg, 'PNG', mmX + (mmW - drawW) / 2, mmY + (mmH - drawH) / 2, drawW, drawH);
                } catch (e) { }
            }
            return;
        }

        pdf.saveGraphicsState();
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, null);
        pdf.internal.write('W n');

        const sizeCol = Object.keys(data).find(k => k.toLowerCase() === 'size' || k.toLowerCase().includes('size'));
        const sizeVal = String(data[sizeCol] || '').trim().toUpperCase();

        const azorteeVisibleCircles = new Set();
        if (labelType === 'azortee' && sizeVal) {
            const circleTextMap = buildAzorteeCircleMap(elements, data);
            circleTextMap.forEach((pairedText, circleId) => { if (pairedText === sizeVal) azorteeVisibleCircles.add(circleId); });
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
                    if (Math.abs((rectEl.x || 0) - (textEl.x || 0)) <= 8 && Math.abs((rectEl.y || 0) - (textEl.y || 0)) <= 8) sizeHighlightRectIds.add(rectEl.id);
                });
            });
        }

        const livsmartHighlightTextIds = new Set();
        if (labelType === 'livsmart' && sizeVal) {
            elements.forEach(el => {
                if (el.type !== 'text' && el.type !== 'placeholder') return;
                if (el.text?.includes('{{')) return;
                const cleanText = (el.text || '').trim().toUpperCase();
                if (cleanText === sizeVal && cleanText.length < 8) livsmartHighlightTextIds.add(el.id);
            });
        }

        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const el of sorted) {
            if (el.visible === false) continue;
            pdf.saveGraphicsState();
            const elSX = el.scaleX || 1, elSY = el.scaleY || 1, elRot = el.rotation || 0;
            const unitScale = unit === 'mm' ? 1 : PX_TO_MM;
            let ex = offX + (el.x || 0) * unitScale * cs;
            let ey = offY + (el.y || 0) * unitScale * cs;
            const ew = (el.width || 0) * unitScale * cs * elSX;
            const eh = (el.height || 0) * unitScale * cs * elSY;
            const elName = (el.name || '').toLowerCase();

            const forcedMode = modes[el.id] || mappingModes[el.id];

            // ── QR CODE: EPC is the ONLY source — never fall back to EAN ─────
            if (el.type === 'qrcode' || forcedMode === 'qrcode') {
                let qv = resolveQRValue(el, data, mapping);
                // Only render if we have a value — skip silently if no EPC assigned
                if (qv) {
                    let qsz = isProduction ? Math.min(ew, eh) : 6;
                    let qx = ex + (ew - qsz) / 2, qy = ey + (eh - qsz) / 2;
                    if (!isProduction) { qx -= 2 * PX_TO_MM; qy -= 10 * PX_TO_MM; }
                    await renderQRAtPos(pdf, qv, qx, qy, qsz);
                }
                pdf.restoreGraphicsState(); continue;
            }

            // ── BARCODE: always use EAN ────────────────────────────────────────
            if (el.type === 'barcode' || forcedMode === 'ean13' || forcedMode === 'barcode') {
                let bv = data.__ean || el.barcodeValue || '123456789';
                const mp = mapping[el.id];
                if (mp && data[mp] !== undefined) bv = String(data[mp]);
                else {
                    const ac = Object.keys(data || {}).find(c => c.toLowerCase() === (el.fieldName || el.name || '').toLowerCase());
                    if (ac) bv = String(data[ac] ?? bv);
                    else {
                        const eanCol = Object.keys(data || {}).find(c => c.toLowerCase().includes('ean'));
                        if (eanCol && data[eanCol] !== undefined) bv = String(data[eanCol] ?? bv).replace(/^[₹\s]+/, '').trim();
                        else if (data.__ean) bv = data.__ean;
                    }
                }
                const format = forcedMode === 'ean13' ? 'EAN13' : (el.barcodeFormat || 'CODE128').toUpperCase();
                let bw = ew, bh = eh * 0.9, bx = ex, by = ey;
                if (isProduction && format === 'EAN13') {
                    bw = 26.2; bh = 10.4; bx = ex + (ew - bw) / 2; by = ey + (eh - bh) / 2 + 5 * PX_TO_MM;
                } else if (!isProduction) {
                    const targetH = 32 * PX_TO_MM;
                    if (bh < targetH) { const diff = targetH - bh; by -= diff / 2; bh = targetH; }
                    by += 2.4 * PX_TO_MM;
                }
                await drawVectorBarcode(pdf, bv, bx, by, bw, bh, format, el.fill, isProduction);
                pdf.restoreGraphicsState(); continue;
            }

            if (forcedMode === 'text') {
                const val = String(data[mapping[el.id]] || '');
                const fs = Math.max(2, (el.fontSize || 12) * 0.75 * elSY * cs);
                const fsMM = fs * 0.352778;
                pdf.setFontSize(fs); pdf.text(val, ex, ey + fsMM * 0.85);
                pdf.restoreGraphicsState(); continue;
            }

            if (el.type === 'circle' && (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'))) {
                if (labelType === 'azortee' && azorteeVisibleCircles.has(el.id)) {
                    const rx = (el.radius || 10) * unitScale * cs * (el.scaleX || 1);
                    const ry = (el.radius || 10) * unitScale * cs * (el.scaleY || 1);
                    pdf.setDrawColor(el.stroke || el.fill || '#000000');
                    pdf.setLineWidth(Math.max(0.2, (el.strokeWidth || 1.5) * unitScale * cs * (el.scaleX || 1)));
                    pdf.ellipse(ex, ey, rx, ry, 'D');
                }
                pdf.restoreGraphicsState(); continue;
            }

            if (el.type === 'text' || el.type === 'placeholder') {
                let val = resolveTextValue(el, data, mapping);
                if (!val || val === 'Text') { pdf.restoreGraphicsState(); continue; }
                const fs = Math.max(2, (el.fontSize || 12) * 0.75 * elSY * cs);
                const fsMM = fs * 0.352778;
                const cleanV = val.trim().toUpperCase();
                if (labelType === 'livsmart' && livsmartHighlightTextIds.has(el.id)) {
                    const measuredW = pdf.getTextWidth(val) || 0;
                    const rectW = (ew > 2 ? ew : measuredW) + 1;
                    pdf.setFillColor('#000000');
                    pdf.rect(ex - 0.5, ey - 0.5, rectW, fsMM * 1.5, 'F');
                }
                let textColor = el.fill || '#000000';
                if (labelType === 'livsmart' && livsmartHighlightTextIds.has(el.id)) textColor = '#ffffff';
                else if (labelType === 'normal' && sizeVal && cleanV === sizeVal && cleanV.length < 6) textColor = '#000000';
                pdf.setFontSize(fs); pdf.setTextColor(textColor);
                const bold = String(el.fontWeight || '').includes('bold') || el.fontWeight === '700' || el.fontWeight === 700;
                const italic = el.fontStyle === 'italic';
                const pdfStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
                const pdfFont = resolvePdfFont(el.fontFamily || '');
                try {
                    const fontExists = pdf.getFontList()[pdfFont];
                    pdf.setFont(fontExists ? pdfFont : 'helvetica', pdfStyle);
                } catch (e) { try { pdf.setFont('helvetica', 'normal'); } catch (e2) { } }
                const align = el.textAlign || 'left';
                const wrapW = (el.width || 0) * unitScale * cs;
                if (!isProduction && elRot !== 0) {
                    if (val.trim().startsWith('SG')) { ex += 3 * PX_TO_MM; ey += 2 * PX_TO_MM; }
                    else if (val.toUpperCase().includes('SARAVANA')) { ey += 9 * PX_TO_MM; }
                }
                if (elRot !== 0) {
                    const safeVal = val.replace(/₹/g, 'Rs.');
                    const lines = wrapW > 10 ? pdf.splitTextToSize(safeVal, wrapW) : [safeVal];
                    let rotAnchorX = ex;
                    if (align === 'center' && wrapW > 0) rotAnchorX = ex + wrapW / 2;
                    else if (align === 'right' && wrapW > 0) rotAnchorX = ex + wrapW;
                    pdf.text(lines.join('\n'), rotAnchorX, ey + fsMM * 0.85, { align, angle: -elRot, lineHeightFactor: el.lineHeight || 1.2 });
                    pdf.restoreGraphicsState(); continue;
                }
                const tabPos = el.tabPos || 0;
                if (tabPos > 0 && val.includes(':')) {
                    const lh = fs * 0.352778 * (el.lineHeight || 1.2);
                    val.split('\n').forEach((line, i) => {
                        const ci = line.indexOf(':'), ly = ey + fsMM * 0.85 + i * lh;
                        if (ci !== -1) { drawRupeeText(pdf, line.substring(0, ci).trim(), ex, ly, elSX); drawRupeeText(pdf, line.substring(ci).trim(), ex + tabPos * unitScale * cs, ly, elSX); }
                        else drawRupeeText(pdf, line, ex, ly, elSX);
                    });
                    pdf.restoreGraphicsState(); continue;
                }
                if (elSX !== 1 && elSX > 0) pdf.internal.write(`${(elSX * 100).toFixed(1)} Tz`);
                const ty = ey + fsMM * 0.85;
                const explicitLines = val.split('\n');
                const rawLines = [];
                explicitLines.forEach(seg => {
                    const segClean = seg.trim();
                    if (!segClean) return;
                    if (wrapW > 10 && el.wrap !== 'none') { pdf.splitTextToSize(segClean, wrapW).forEach(l => rawLines.push(l.trim())); }
                    else rawLines.push(segClean);
                });
                const lh = fsMM * (el.lineHeight || 1.2);
                const effectiveW = wrapW > 10 ? wrapW : (() => {
                    let maxW = 0;
                    rawLines.forEach(l => { const w = pdf.getTextWidth(l.replace(/\s*₹\s*/g, '').trim()); if (w > maxW) maxW = w; });
                    return maxW;
                })();
                rawLines.forEach((line, li) => {
                    const lineY = ty + li * lh, trimmedLine = line.trim();
                    if (!trimmedLine) return;
                    if (!trimmedLine.includes('₹')) {
                        let anchorX = ex, textOpts = {};
                        if (align === 'center') { anchorX = ex + effectiveW / 2; textOpts = { align: 'center' }; }
                        else if (align === 'right') { anchorX = ex + effectiveW; textOpts = { align: 'right' }; }
                        pdf.text(trimmedLine, anchorX, lineY, textOpts);
                    } else {
                        const safeTextForWidth = trimmedLine.replace(/\s*₹\s*/g, '');
                        let lineW = 0;
                        try { lineW = pdf.getTextWidth(safeTextForWidth); } catch (e) { lineW = safeTextForWidth.length * (fs * 0.2); }
                        const rupeeCount = (trimmedLine.match(/₹/g) || []).length;
                        const imgW = fsMM * 0.95 * (elSX || 1);
                        const visualLineW = (lineW * (elSX || 1)) + (rupeeCount * (imgW + 3 * PX_TO_MM));
                        let lineX = ex;
                        if (align === 'center') lineX = ex + (effectiveW - visualLineW) / 2;
                        else if (align === 'right') lineX = ex + effectiveW - visualLineW;
                        drawRupeeText(pdf, trimmedLine, lineX, lineY, elSX);
                    }
                });
                if (elSX !== 1 && elSX > 0) pdf.internal.write('100 Tz');

            } else if (el.type === 'rect') {
                let fill = el.fill;
                const isStrip = elName.includes('strip') || elName.includes('color') || ((el.width || 0) > 80 && (el.height || 0) < 50);
                if (isProduction && isStrip) { pdf.restoreGraphicsState(); continue; }
                if (isStrip) {
                    const manualMapped = mapping[el.id];
                    if (manualMapped && data[manualMapped] !== undefined) { const mc = resolveStripColor(String(data[manualMapped] ?? '').trim()); if (mc) fill = mc; }
                    else {
                        const sc = Object.keys(data || {}).find(col => { const norm = col.toLowerCase().replace(/[\s_-]/g, ''); return norm.includes('stripcolor') || norm === 'strip'; });
                        if (sc && data[sc]) { const mc = resolveStripColor(String(data[sc]).trim()); if (mc) fill = mc; }
                    }
                }
                if (sizeHighlightRectIds.has(el.id)) fill = '#000000';
                const isLabelBorder = Math.abs(ew - mmW) < 3 && Math.abs(eh - mmH) < 3;
                const r = el.cornerRadius ? Math.max(0, el.cornerRadius * unitScale * cs) : isLabelBorder ? tagR : 0;
                if (fill && fill !== 'transparent') { pdf.setFillColor(fill); r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'F') : pdf.rect(ex, ey, ew, eh, 'F'); }
                if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0 && !isLabelBorder) {
                    pdf.setDrawColor(el.stroke); pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                    r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'D') : pdf.rect(ex, ey, ew, eh, 'D');
                }

            } else if (el.type === 'image') {
                const src = el.image || el.src || el.url;
                let iw = ew, ih = eh, ix = ex, iy = ey;
                if (!isProduction) {
                    if (src && (src.toLowerCase().includes('azorte') || src.toLowerCase().includes('azortee'))) {
                        ih = 20 * PX_TO_MM; iw = ih * (ew / (eh || 1));
                        ix = ex + (ew - iw) / 2; iy = ey + (eh - ih) / 2;
                    } else { iw = 6; ih = 6; ix = ex + (ew - iw) / 2; iy = ey + (eh - ih) / 2; }
                }
                if (src) { try { pdf.addImage(src, 'PNG', ix, iy, iw, ih); } catch (e) { } }

            } else if (el.type === 'line') {
                const pts = el.points || [0, 0, 100, 0];
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                pdf.line(ex + pts[0] * unitScale * cs, ey + pts[1] * unitScale * cs, ex + pts[2] * unitScale * cs, ey + pts[3] * unitScale * cs);

            } else if (el.type === 'circle') {
                const rx = (el.radius || 10) * unitScale * cs * (el.scaleX || 1);
                const ry = (el.radius || 10) * unitScale * cs * (el.scaleY || 1);
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs * (el.scaleX || 1)));
                if (el.fill && el.fill !== 'transparent') { pdf.setFillColor(el.fill); pdf.ellipse(ex, ey, rx, ry, 'FD'); }
                else pdf.ellipse(ex, ey, rx, ry, 'D');
            }

            pdf.restoreGraphicsState();
        }
        pdf.restoreGraphicsState();
    };

    // ─── Shared header renderer ───────────────────────────────────────────────
    const drawBrandingHeader = (pdf, pageNum, totalPages, PAGE_W) => {
        pdf.saveGraphicsState();
        const bImg = brandingImg || logoImg;
        if (bImg) {
            try {
                const aspect = bImg.height / bImg.width;
                const imgW = 28, imgH = imgW * aspect;
                pdf.addImage(bImg, 'PNG', 10, 6, imgW, imgH);
            } catch (e) { }
        }
        pdf.setFontSize(16); pdf.setFont('Arial', 'bold'); pdf.setTextColor('#000080');
        pdf.text('DESIGN PROOF APPROVAL SHEET', PAGE_W - 10, 13, { align: 'right' });
        pdf.setFontSize(9); pdf.setFont('Arial', 'normal'); pdf.setTextColor('#777777');
        pdf.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - 10, 19, { align: 'right' });
        pdf.text(`Date: ${new Intl.DateTimeFormat('en-IN').format(new Date())}`, PAGE_W - 10, 24, { align: 'right' });
        pdf.setDrawColor('#e2e8f0'); pdf.setLineWidth(0.4);
        pdf.line(10, 32, PAGE_W - 10, 32);
        pdf.restoreGraphicsState();
    };

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
            const cols = 5, rows = 2, hGap = 6, vGap = 8, HEADER_H = 35;
            const usableW = PAGE_W - 25, usableH = PAGE_H - 30 - HEADER_H;
            const scaleX = (usableW - (cols - 1) * hGap) / (cols * origW);
            const scaleY = (usableH - (rows - 1) * vGap) / (rows * origH);
            const masterScale = Math.min(0.95, scaleX, scaleY);
            const labelW = origW * masterScale, labelH = origH * masterScale;
            const maxPP = cols * rows;
            const gridW = cols * labelW + (cols - 1) * hGap, gridH = rows * labelH + (rows - 1) * vGap;
            const startX = (PAGE_W - gridW) / 2, startY = HEADER_H + 5 + (usableH - gridH) / 2;

            // Use expandedData (Final Qty × EPC expanded)
            const sourceRows = expandedData.filter(r => !r.__blank);

            const pages = [];
            let currentPage = [{ isBranding: true, data: null }];
            for (const row of sourceRows) {
                if (currentPage.length >= maxPP) { pages.push(currentPage); currentPage = []; }
                currentPage.push({ isBranding: false, data: row });
            }
            if (currentPage.length > 0) pages.push(currentPage);

            for (let pIdx = 0; pIdx < pages.length; pIdx++) {
                const pgItems = pages[pIdx];
                if (pIdx > 0) pdf.addPage();
                drawBrandingHeader(pdf, pIdx + 1, pages.length, PAGE_W);
                for (let i = 0; i < pgItems.length; i++) {
                    const item = pgItems[i];
                    const c = i % cols, r = Math.floor(i / cols);
                    const x = startX + c * (labelW + hGap), y = startY + r * (labelH + vGap);
                    if (item.isBranding) await drawVectorLabel(pdf, [], {}, {}, x, y, labelW, labelH, true);
                    else await drawVectorLabel(pdf, selectedTemplate.elements, item.data, manualMapping, x, y, labelW, labelH, false, false, mappingModes);
                }
            }
            pdf.save(`Proof_Sheet_${Date.now()}.pdf`);
            toast.success('Downloaded!', { id: 'pdf' });
        } catch (err) { console.error(err); toast.error('Failed to generate PDF', { id: 'pdf' }); }
    };

    // ─── Save Proof Sheet ─────────────────────────────────────────────────────
    const saveProofSheet = async () => {
        if (!selectedTemplate) return;
        const fileNameInput = window.prompt('Enter a name for the Proof Sheet:', 'Proof_Sheet');
        if (!fileNameInput) return;
        const finalFileName = fileNameInput.endsWith('.pdf') ? fileNameInput : `${fileNameInput}.pdf`;
        try {
            toast.loading('Saving Proof Sheet…', { id: 'save_pdf' });
            const PAGE_W = 297, PAGE_H = 210;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const _unit = selectedTemplate.canvasUnit || 'px';
            const _dW = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
            const _dH = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
            const origW = _unit === 'mm' ? _dW : _dW * PX_TO_MM;
            const origH = _unit === 'mm' ? _dH : _dH * PX_TO_MM;
            const cols = 5, rows = 2, hGap = 6, vGap = 8, HEADER_H = 35;
            const usableW = PAGE_W - 25, usableH = PAGE_H - 30 - HEADER_H;
            const masterScale = Math.min(0.95, (usableW - (cols - 1) * hGap) / (cols * origW), (usableH - (rows - 1) * vGap) / (rows * origH));
            const labelW = origW * masterScale, labelH = origH * masterScale, maxPP = cols * rows;
            const gridW = cols * labelW + (cols - 1) * hGap, gridH = rows * labelH + (rows - 1) * vGap;
            const startX = (PAGE_W - gridW) / 2, startY = HEADER_H + 5 + (usableH - gridH) / 2;
            const sourceRows = expandedData.filter(r => !r.__blank);
            const pages = [];
            let currentPage = [{ isBranding: true, data: null }];
            for (const row of sourceRows) {
                if (currentPage.length >= maxPP) { pages.push(currentPage); currentPage = []; }
                currentPage.push({ isBranding: false, data: row });
            }
            if (currentPage.length > 0) pages.push(currentPage);
            for (let pIdx = 0; pIdx < pages.length; pIdx++) {
                const pgItems = pages[pIdx];
                if (pIdx > 0) pdf.addPage();
                drawBrandingHeader(pdf, pIdx + 1, pages.length, PAGE_W);
                for (let i = 0; i < pgItems.length; i++) {
                    const item = pgItems[i];
                    const c = i % cols, r = Math.floor(i / cols);
                    const x = startX + c * (labelW + hGap), y = startY + r * (labelH + vGap);
                    if (item.isBranding) await drawVectorLabel(pdf, [], {}, {}, x, y, labelW, labelH, true);
                    else await drawVectorLabel(pdf, selectedTemplate.elements, item.data, manualMapping, x, y, labelW, labelH, false, false, mappingModes);
                }
            }
            const blob = pdf.output('blob');
            const formData = new FormData();
            formData.append('file', blob, finalFileName);
            await filesAPI.upload(formData);
            toast.success('Saved successfully!', { id: 'save_pdf' });
        } catch (err) { console.error(err); toast.error('Failed to save PDF', { id: 'save_pdf' }); }
    };

    // ─── Download Individual Labels (expanded) ────────────────────────────────
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

            // Use expandedData — each row is one label
            const sourceRows = expandedData.filter(r => !r.__blank);

            for (const row of sourceRows) {
                if (!first) pdf.addPage([lW, lH], ori);
                first = false;
                await drawVectorLabel(pdf, selectedTemplate.elements, row, manualMapping, 0, 0, lW, lH, false, true);
            }
            pdf.save(`Labels_${Date.now()}.pdf`);
            toast.success('Downloaded!', { id: 'ind' });
        } catch (err) { console.error(err); toast.error('Failed to generate labels', { id: 'ind' }); }
    };

    const getDesignPx = () => {
        if (!selectedTemplate) return { w: 166, h: 387 };
        const unit = selectedTemplate.canvasUnit || 'px';
        const w = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
        const h = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
        return { w: unit === 'px' ? w : unitToPx(w, unit), h: unit === 'px' ? h : unitToPx(h, unit) };
    };

    const { w: itemW, h: itemH } = getDesignPx();
    const colsCount = 6, spacing = 6, marginSide = 50;

    // Preview uses expandedData (limited for performance)
    const previewRows = expandedData.filter(r => !r.__blank).slice(0, 60);

    let requiredRows = 1, tempCol = 1, tempRow = 0;
    previewRows.forEach(() => {
        if (tempCol >= colsCount) { tempRow++; tempCol = 0; }
        tempCol++;
    });
    // account for branding slot
    if (tempCol >= colsCount) tempRow++;
    requiredRows = Math.max(1, tempRow + 1);

    const sheetW = (itemW + spacing) * colsCount + marginSide * 2;
    const sheetH = (itemH + spacing) * requiredRows + 160;
    const currentLabelType = getLabelType(selectedTemplate);

    const totalExpandedCount = expandedData.filter(r => !r.__blank).length;

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            {showGenerateModal && (
                <DownloadModal
                    onClose={() => setShowGenerateModal(false)}
                    selectedTemplate={selectedTemplate}
                    manualMapping={manualMapping}
                    mappingModes={mappingModes}
                    drawVectorLabel={drawVectorLabel}
                />
            )}
            <Sidebar />
            <main className="db-main">

                {/* ─── Header ─────────────────────────────────────────────── */}
                <div className="layout-header-simple">
                    {/* Left: back + title + steps */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button className="lh-btn lh-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={15} />
                        </button>
                        <div>
                            <h1>Artwork Page</h1>
                        </div>
                        <div className="lh-steps">
                            {[
                                { n: 1, label: 'Design', done: !!selectedTemplate },
                                { n: 2, label: 'Data', done: excelData.length > 0 },
                                { n: 3, label: 'RFID', done: rfidData.length > 0 },
                                { n: 4, label: 'Review', done: expandedData.length > 0 },
                            ].map((s, i) => (
                                <React.Fragment key={s.n}>
                                    {i > 0 && <div className="lh-sep" />}
                                    <div className={`lh-step ${s.done ? 'done' : ''}`}>
                                        <div className="lh-step-num">{s.done ? '✓' : s.n}</div>
                                        {s.label}
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>

                    {/* Right: badges + action buttons */}
                    <div className="lh-actions">
                        {epcStats && (
                            <div className={`lh-badge ${epcStats.unmatched === 0 ? 'success' : 'warn'}`}>
                                {epcStats.unmatched === 0 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                {epcStats.matched}/{epcStats.total} EPC
                                {epcStats.unmatched > 0 && ` · ${epcStats.unmatched} missing`}
                            </div>
                        )}
                        {totalExpandedCount > 0 && (
                            <div className="lh-badge neutral">
                                {totalExpandedCount} labels
                            </div>
                        )}
                        {excelData.length > 0 && (
                            <>
                                <button className="lh-btn lh-btn-ghost" onClick={() => setShowExplorer(!showExplorer)}>
                                    <Search size={13} /> {showExplorer ? 'Hide' : 'Inspect'}
                                </button>
                                <button className="lh-btn lh-btn-secondary" onClick={() => setShowGenerateModal(true)}>
                                    <Download size={13} /> Download Labels
                                </button>
                                <button className="lh-btn lh-btn-primary" onClick={downloadPDF}>
                                    <Download size={13} /> Proof Sheet
                                </button>
                                <button className="lh-btn lh-btn-save" onClick={saveProofSheet}>
                                    <Save size={13} /> Save
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ─── Content ─────────────────────────────────────────────── */}
                <div className="layout-content-grid">

                    {/* ── Toolbar ── */}
                    <div className="layout-toolbar-horizontal">

                        {/* 1. Design */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">1 · Design</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <select
                                    className="ts-select"
                                    value={selectedTemplate?._id || selectedTemplate?.id || ''}
                                    onChange={e => handleSelectTemplate(e.target.value)}
                                >
                                    <option value="">— Choose Design —</option>
                                    {templates.map(t => (
                                        <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>
                                    ))}
                                </select>
                                {selectedTemplate && (
                                    <span className="ts-type-badge"
                                        style={{
                                            background: currentLabelType === 'azortee' ? '#dbeafe' : currentLabelType === 'livsmart' ? '#dcfce7' : '#f1f5f9',
                                            color: currentLabelType === 'azortee' ? '#1d4ed8' : currentLabelType === 'livsmart' ? '#15803d' : '#64748b',
                                        }}>
                                        {currentLabelType}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="toolbar-divider" />

                        {/* 2. Logo */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">2 · Logo</div>
                            <button className={`ts-btn ${brandingImg ? 'active' : ''}`} onClick={() => document.getElementById('branding-upload').click()}>
                                <Wand2 size={13} /> {brandingImg ? 'Logo ✓' : 'Add Logo'}
                            </button>
                            <input type="file" id="branding-upload" hidden accept="image/*" onChange={handleBrandingLogoUpload} />
                        </div>

                        <div className="toolbar-divider" />

                        {/* 3. Palette */}
                        <div className="toolbar-section" style={{ position: 'relative' }}>
                            <div className="section-label-mini">3 · Palette</div>
                            <button className="ts-btn" onClick={() => setShowStripManager(!showStripManager)}>
                                <Palette size={13} /> Colors
                            </button>
                            {showStripManager && (
                                <div className="strip-popup">
                                    <div className="strip-popup-header">
                                        <span>CMYK Color Palette</span>
                                        <button onClick={() => setShowStripManager(false)} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold', lineHeight: 1 }}>×</button>
                                    </div>
                                    <div style={{ display: 'flex', minHeight: '400px' }}>
                                        <div style={{ flex: '1.2', padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '1px', background: '#cbd5e1', border: '1px solid #cbd5e1', marginBottom: '14px', maxHeight: '160px', overflowY: 'auto', borderRadius: 4 }}>
                                                {corelPalette.map(cp => (
                                                    <div key={cp.name} style={{ background: cp.hex, height: '18px', cursor: 'pointer' }} title={`${cp.name} (${cp.cmyk})`}
                                                        onClick={() => { const [c, m, y, k] = cp.cmyk.split(',').map(Number); setCmykInput({ name: cp.name, c, m, y, k }); }} />
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[{ label: 'C', key: 'c', gradient: 'linear-gradient(to right, #fff, #00FFFF)' }, { label: 'M', key: 'm', gradient: 'linear-gradient(to right, #fff, #FF00FF)' }, { label: 'Y', key: 'y', gradient: 'linear-gradient(to right, #fff, #FFFF00)' }, { label: 'K', key: 'k', gradient: 'linear-gradient(to right, #fff, #000)' }].map(s => (
                                                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', width: '12px', color: '#334155' }}>{s.label}</span>
                                                        <div style={{ flex: '1', height: '10px', border: '1px solid #cbd5e1', borderRadius: 3, position: 'relative', background: s.gradient }}>
                                                            <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', width: '4px', background: 'white', border: '1px solid #475569', borderRadius: 2, left: `${cmykInput[s.key]}%`, transform: 'translateX(-50%)', pointerEvents: 'none' }} />
                                                            <input type="range" style={{ position: 'absolute', inset: '0', opacity: '0', cursor: 'pointer', width: '100%' }} min="0" max="100" value={cmykInput[s.key]} onChange={e => setCmykInput(p => ({ ...p, [s.key]: Number(e.target.value) }))} />
                                                        </div>
                                                        <input type="number" min="0" max="100" style={{ width: '35px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center', padding: '2px' }} value={cmykInput[s.key]} onChange={e => { let v = Math.min(100, Math.max(0, Number(e.target.value))); setCmykInput(p => ({ ...p, [s.key]: v })); }} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                                                <input type="text" placeholder="Color Name" style={{ width: '100%', fontSize: '11px', border: '1.5px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', marginBottom: '6px', boxSizing: 'border-box', outline: 'none' }} value={cmykInput.name} onChange={e => setCmykInput(p => ({ ...p, name: e.target.value }))} />
                                                <button style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontSize: '11px', padding: '7px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', letterSpacing: '0.05em' }} onClick={handleAddCMYKColor}>ADD TO PALETTE</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                                            <div style={{ background: '#f1f5f9', padding: '8px 12px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Strip Colors</div>
                                            <div style={{ flex: '1', overflowY: 'auto', padding: '6px' }}>
                                                {stripColors.length === 0 ? (
                                                    <div style={{ padding: '24px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No colors added yet</div>
                                                ) : stripColors.map(sc => (
                                                    <div key={sc._id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: '1px solid #e2e8f0', background: 'white', marginBottom: '4px', cursor: 'pointer', borderRadius: '6px', transition: 'border-color 0.2s' }}
                                                        onClick={() => { if (sc.cmyk) { const [c, m, y, k] = sc.cmyk.split(',').map(Number); setCmykInput({ name: sc.name, c, m, y, k }); } }}>
                                                        <div style={{ width: '14px', height: '14px', border: '1px solid #cbd5e1', borderRadius: 3, background: sc.hex, flexShrink: 0 }} />
                                                        <div style={{ flex: '1', fontSize: '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{sc.name}</div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{sc.cmyk ? sc.cmyk.split(',').map((v, i) => `${['C', 'M', 'Y', 'K'][i]}:${v}`).join(' ') : sc.hex}</div>
                                                        <button onClick={e => handleDeleteColor(e, sc._id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#94a3b8', lineHeight: 1 }}><Trash2 size={11} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="toolbar-divider" />

                        {/* 4. Label Data */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">4 · Label Data</div>
                            <div className={`excel-drop-horizontal ${excelData.length ? 'has-data' : ''}`}
                                onClick={() => document.getElementById('excel-input').click()}>
                                <FileSpreadsheet size={14} style={{ color: excelData.length ? '#16a34a' : '#94a3b8', flexShrink: 0 }} />
                                <span style={{ color: excelData.length ? '#15803d' : '#64748b' }}>
                                    {excelData.length ? `${excelData.length} Rows` : 'Upload Excel'}
                                </span>
                            </div>
                            <input type="file" id="excel-input" hidden accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </div>

                        <div className="toolbar-divider" />

                        {/* 5. RFID */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">5 · RFID / EPC</div>
                            <div className={`excel-drop-horizontal ${rfidData.length ? 'has-rfid' : ''}`}
                                onClick={() => document.getElementById('rfid-input').click()}>
                                <Cpu size={14} style={{ color: rfidData.length ? '#6366f1' : '#94a3b8', flexShrink: 0 }} />
                                <span style={{ color: rfidData.length ? '#4f46e5' : '#64748b' }}>
                                    {rfidData.length ? `${rfidData.length} EPCs` : 'Upload RFID File'}
                                </span>
                            </div>
                            <input type="file" id="rfid-input" hidden accept=".xlsx,.xls,.csv" onChange={handleRfidFileUpload} />
                        </div>

                        {/* 6. Mapping */}
                        {selectedTemplate && excelData.length > 0 && templateFields.length > 0 && (
                            <div className="mapping-section">
                                <div className="section-label-mini">6 · Field Mapping</div>
                                <div className="mapping-row-toolbar">
                                    {templateFields.map(field => (
                                        <div key={field.id} className="mapping-item-compact">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <label title={field.label}>{field.label?.length > 12 ? field.label.slice(0, 12) + '…' : field.label}</label>
                                                <select className="mapping-mode-select"
                                                    value={mappingModes[field.id] || ''}
                                                    onChange={e => setMappingModes(prev => ({ ...prev, [field.id]: e.target.value }))}>
                                                    <option value="">Auto</option>
                                                    <option value="text">Text</option>
                                                    <option value="barcode">BC</option>
                                                    <option value="ean13">EAN13</option>
                                                    <option value="qrcode">QR</option>
                                                </select>
                                            </div>
                                            <select className="mapping-select-toolbar"
                                                value={manualMapping[field.id] || ''}
                                                onChange={e => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}>
                                                <option value="">Auto</option>
                                                {columns.map(col => <option key={col} value={col}>{col}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Preview ── */}
                    <div className="layout-preview-main">
                        {!selectedTemplate || !excelData.length ? (
                            <div className="empty-preview-state">
                                <div style={{ width: 72, height: 72, borderRadius: 20, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                                    <Layers size={30} style={{ color: '#cbd5e1' }} />
                                </div>
                                <h3>Ready to Generate Proofs</h3>
                                <p>Select a design and upload Label Data.<br />Optionally upload an RFID file for EPC mapping.</p>
                            </div>
                        ) : (
                            <div className="canvas-viewport">
                                {/* Excel Inspector */}
                                {showExplorer && (
                                    <div className="explorer-overlay">
                                        <div className="explorer-card-simple">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                                                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#4f46e5' }}>Excel Inspector</h4>
                                                <button onClick={() => setShowExplorer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}><X size={16} /></button>
                                            </div>
                                            {totalExpandedCount > 0 && (
                                                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: '#eef2ff', border: '1px solid #c7d2fe', fontSize: 10, fontWeight: 700, color: '#4338ca', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Link2 size={11} />
                                                    {excelData.filter(r => !Object.values(r).every(v => v === '' || v == null)).length} rows → {totalExpandedCount} labels
                                                    {epcStats && <span style={{ color: '#15803d' }}>· {epcStats.matched} EPC assigned</span>}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, overflowY: 'auto', maxHeight: 380 }}>
                                                {columns.map(col => (
                                                    <div key={col} title={col} className={`header-chip-mini ${Object.values(manualMapping).includes(col) ? 'mapped' : ''}`}>{col}</div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Konva Sheet */}
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
                                                <Group x={0} y={0}>
                                                    <LayoutLabel width={itemW} height={itemH} isBranding logoImg={brandingImg || logoImg} />
                                                </Group>
                                                {(() => {
                                                    let col = 1, row = 0;
                                                    return previewRows.map((rowData, i) => {
                                                        if (col >= colsCount) { row++; col = 0; }
                                                        const gx = col * (itemW + spacing), gy = row * (itemH + spacing);
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

                                {/* Zoom Bar */}
                                <div className="zoom-bar">
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}><ZoomOut size={15} /></button>
                                    <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
                                    <button className="btn btn-ghost btn-xs" onClick={() => setZoom(z => Math.min(3, z + 0.1))}><ZoomIn size={15} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

