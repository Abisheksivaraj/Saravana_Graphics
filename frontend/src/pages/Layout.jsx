import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, FileSpreadsheet, Download, ArrowLeft,
    Search, ZoomIn, ZoomOut, Palette, X, Wand2,
    Save, FolderOpen, FileText, Trash2, Cpu,
    Link2, AlertCircle, CheckCircle2,
    Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Line, Circle, Ellipse } from 'react-konva';
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
import logo from '../assets/artwork.png';
import './Layout.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const PX_TO_MM = 0.264583;

// ─── Font Cache & Loading ─────────────────────────────────────────────────────
const _fontCache = {};

const loadCustomFonts = async (pdf) => {
    const fontFiles = [
        { name: 'Arial', style: 'normal', file: '/fonts/Arial.ttf' },
        { name: 'Arial', style: 'bold', file: '/fonts/Arial Bold.ttf' },
        { name: 'Arial', style: 'italic', file: '/fonts/Arial-Italic.ttf' },
        { name: 'Arial', style: 'bolditalic', file: '/fonts/Arial-Bold-Italic.ttf' },
        { name: 'Calibri', style: 'normal', file: '/fonts/calibri.ttf' },
        { name: 'Calibri', style: 'bold', file: '/fonts/Calibri Bold.ttf' },

        { name: 'OCR-BT', style: 'normal', file: '/fonts/ocrb.ttf' },
        { name: 'OCR-B', style: 'normal', file: '/fonts/ocrb.ttf' },
        { name: 'RupeeForbidan', style: 'normal', file: '/fonts/RupeeForbidan.ttf' },
    ];
    for (const font of fontFiles) {
        const fileName = font.file.split('/').pop();
        try {
            if (!_fontCache[fileName]) {
                const res = await fetch(font.file);
                if (!res.ok) continue;
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('text/html') || ct.includes('text/plain')) continue;
                
                const buf = await res.arrayBuffer();
                const bytes = new Uint8Array(buf);
                // Basic TTF validation (magic numbers: 0x00010000 or 'true')
                const magic = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
                const isTTF = magic === 0x00010000 || magic === 0x74727565 || magic === 0x4F54544F; // OTTO
                if (!isTTF) {
                    console.warn(`Skipping invalid font file: ${font.file}`);
                    continue;
                }

                let bin = '';
                for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
                _fontCache[fileName] = btoa(bin);
            }
            if (_fontCache[fileName]) {
                pdf.addFileToVFS(fileName, _fontCache[fileName]);
                pdf.addFont(fileName, font.name, font.style);
            }
        } catch (e) { console.warn(`Font load failed: ${font.name}`, e); }
    }
};

const resolvePdfFont = (fontFamily = '') => {
    const ff = fontFamily.toLowerCase();
    if (ff.includes('calibri')) return 'Calibri';
    if (ff.includes('ocr')) return 'OCR-B';
    if (ff.includes('rupee') || ff.includes('forbidan')) return 'RupeeForbidan';
    return 'Arial';
};

// ─── Strip Color Map ──────────────────────────────────────────────────────────
let STRIP_COLOR_MAP = {};
const resolveStripColor = (name) => STRIP_COLOR_MAP[String(name).trim().toLowerCase()] || null;

// ─── Text Helpers ─────────────────────────────────────────────────────────────
const isPriceColumn = (col) => {
    const l = (col || '').toLowerCase();
    return l.includes('mrp') || l.includes('price');
};

const formatPrice = (raw) =>
    /^\d+(\.\d+)?$/.test(String(raw).trim())
        ? parseFloat(raw).toFixed(2)
        : String(raw).trim();

const formatNetQty = (val) => {
    const s = String(val || '').trim();
    if (!s) return s;
    if (/TOP/i.test(s) && /BOTTOM/i.test(s)) return s.replace(/\s{1,}(BOTTOM)/i, '\n$1');
    return s;
};

// ─── Rupee Symbol Rendering ───────────────────────────────────────────────────
// ─── Rupee Symbol Rendering ───────────────────────────────────────────────────
// FIXED: Unified rupee rendering - no label-type-specific offsets
const rupeeImgCache = {};
const getRupeeImage = (fontSizePt, color = '#000000') => {
    const key = `${fontSizePt}_${color}`;
    if (rupeeImgCache[key]) return rupeeImgCache[key];
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
    rupeeImgCache[key] = canvas;
    return canvas;
};


// NEW — replace with this:
const drawRupeeText = (pdf, rawText, x, y, scaleX = 1, fs = 12.758, fsMM = 12.758 * 0.352778) => {
    if (!rawText) return;
    const text = String(rawText);
    if (!text.includes('₹')) { pdf.text(text, x, y); return; }

    const tc = pdf.getTextColor();
    const colorHex = typeof tc === 'string' && tc.startsWith('#') ? tc : '#000000';
    const rupeeImg = getRupeeImage(fs, colorHex);

    const refCharW = pdf.getTextWidth('1');
    const imgH = fsMM * 1.1;
    const imgW = refCharW * 1.35 * (scaleX || 1);
    const imgY = y - fsMM * 0.95;

    const parts = text.split('₹');
    let curX = x;

    parts.forEach((part, i) => {
        if (part) {
            pdf.text(part, curX, y);
            curX += pdf.getTextWidth(part);
        }
        if (i < parts.length - 1) {
            // Render ONLY the rupee image, no ₹ character text
            try { pdf.addImage(rupeeImg, 'PNG', curX, imgY, imgW, imgH); } catch { }
            curX += imgW; // no extra gap — image width is already sized to one character
        }
    });
};

const normBarcode = (val) => String(val || '').replace(/\D/g, '');


const buildEpcMap = (rfidRows, customQrCol = null) => {
    const map = {};
    if (!rfidRows?.length) return map;

    rfidRows.forEach(row => {
        const keys = Object.keys(row);

        const epcKey = keys.find(k =>
            k.toLowerCase().replace(/[\s_-]/g, '') === 'epc' ||
            k.toLowerCase().includes('epc')
        );
        const epc = epcKey ? String(row[epcKey] || '').trim() : '';
        if (!epc) return;

        const qr = (customQrCol && row[customQrCol] !== undefined)
            ? String(row[customQrCol]).trim()
            : epc;

        const barcodeKeys = keys.filter(k => {
            const l = k.toLowerCase().replace(/[\s_-]/g, '');
            return l === 'barcode' || l === 'ean' || l === 'ean13' ||
                l === 'gtin' || l.includes('barcode') || l.includes('ean');
        });

        barcodeKeys.forEach(bk => {
            const val = String(row[bk] || '').trim();
            if (!val) return;
            if (!map[val]) map[val] = [];
            map[val].push({ epc, qr });

            // ALWAYS store the digits-only normalized version too
            const norm = normBarcode(val);
            if (norm && norm !== val) {
                if (!map[norm]) map[norm] = map[val]; // alias
            }
        });
    });

    return map;
};

// ─── SGTIN-96 Encoding Logic (Auto-generation fallback) ──────────────────────
const PARTITIONS = {
    '0': { bits_m: 40, bits_n: 4 }, '1': { bits_m: 37, bits_n: 7 },
    '2': { bits_m: 34, bits_n: 10 }, '3': { bits_m: 30, bits_n: 14 },
    '4': { bits_m: 27, bits_n: 17 }, '5': { bits_m: 24, bits_n: 20 },
    '6': { bits_m: 20, bits_n: 24 },
};

function encodeSGTIN96(barcode, serial, filter = 1, partition = 5) {
    try {
        const header = 0x30;
        const part = PARTITIONS[String(partition)] || PARTITIONS['5'];
        const gtin14 = String(barcode).padStart(14, '0');
        const indicator = gtin14[0];
        const companyPrefix = gtin14.substring(1, 8);
        const itemRef = indicator + gtin14.substring(8, 13);

        let epcBinary = header.toString(2).padStart(8, '0');
        epcBinary += (parseInt(filter) & 0x07).toString(2).padStart(3, '0');
        epcBinary += (parseInt(partition) & 0x07).toString(2).padStart(3, '0');
        epcBinary += BigInt(companyPrefix).toString(2).padStart(part.bits_m, '0');
        epcBinary += BigInt(itemRef).toString(2).padStart(part.bits_n, '0');
        epcBinary += BigInt(serial).toString(2).padStart(38, '0');

        let epcHex = '';
        for (let i = 0; i < epcBinary.length; i += 4) {
            epcHex += parseInt(epcBinary.substring(i, i + 4), 2).toString(16).toUpperCase();
        }
        return epcHex;
    } catch (e) { return 'ERROR'; }
}

const INITIAL_SERIAL = 274655906933n;

/**
 * Expand label rows: each row with qty N becomes N separate rows,
 * each assigned one EPC from the pool.
 */
const expandLabelRows = (labelData, epcMap) => {
    const expanded = [];
    const consumedIdx = {};
    let serialCounter = INITIAL_SERIAL;

    labelData.forEach((row, rowIndex) => {
        // Blank row pass-through
        if (Object.values(row).every(v => v === '' || v == null)) {
            expanded.push({ ...row, __blank: true, __originalRowIndex: rowIndex });
            return;
        }

        const keys = Object.keys(row);
        const eanKey = keys.find(k => {
            const l = k.toLowerCase().replace(/[\s_-]/g, '');
            return l === 'ean' || l === 'ean13' || l === 'barcode' || l === 'gtin';
        }) || keys.find(k => k.toLowerCase() === 'epc');

        const qtyKey = Object.keys(row).find(k => {
            const l = k.toLowerCase().replace(/\s/g, '');
            return l === 'finalqty' || l === 'qty' || l === 'quantity';
        });

        const ean = eanKey ? String(row[eanKey] || '').trim() : '';
        const qty = qtyKey ? parseInt(row[qtyKey], 10) : 1;
        const safeQty = isNaN(qty) || qty < 1 ? 1 : qty;

        // Does the source row already have an explicit EPC column?
        const explicitEpcCol = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '') === 'epc');
        const explicitEpc = explicitEpcCol ? String(row[explicitEpcCol] || '').trim() : '';

        // Lookup: try exact → normalized → prefix/suffix trim → fuzzy digit match
        let epcs = epcMap[ean] || [];
        if (!epcs.length && ean) {
            const norm = normBarcode(ean);
            epcs = epcMap[norm] || [];
            if (!epcs.length) {
                // Try every key in the map — find first whose digits match
                const matchKey = Object.keys(epcMap).find(k =>
                    normBarcode(k) === norm
                );
                if (matchKey) epcs = epcMap[matchKey];
            }
        }

        // Debug: log the lookup result for the first row to diagnose mismatches
        if (rowIndex === 0) {
            console.log('[EPC Lookup]', {
                ean, norm: normBarcode(ean),
                found: epcs.length, mapKeys: Object.keys(epcMap).slice(0, 5)
            });
        }

        if (!(ean in consumedIdx)) consumedIdx[ean] = 0;

        for (let i = 0; i < safeQty; i++) {
            let entry = epcs[consumedIdx[ean]];

            // If no RFID mapping, check for explicit EPC in the data row
            let isAuto = false;
            if (!entry || !entry.epc) {
                if (explicitEpc) {
                    entry = { epc: explicitEpc, qr: explicitEpc };
                    isAuto = false; // It's real data from the Excel
                } else {
                    const autoEpc = encodeSGTIN96(ean || '0000000000000', serialCounter);
                    entry = { epc: autoEpc, qr: autoEpc };
                    serialCounter -= 1n;
                    isAuto = true; // It's auto-generated
                }
            } else {
                isAuto = false; // It's from the RFID map
            }

            consumedIdx[ean]++;
            expanded.push({
                ...row,
                __epc: entry.epc,
                __qr: entry.qr || entry.epc,
                __ean: ean,
                __isAutoEpc: isAuto,
                __labelIndex: i + 1,
                __totalForEan: safeQty,
                __originalRowIndex: rowIndex,
            });
        }
    });

    return expanded;
};

// ─── Dynamic Text Resolution ──────────────────────────────────────────────────
const resolveDynamicText = (templateText, data) => {
    let t = templateText || '';
    let hadPh = false;

    // EPC placeholders
    if (data.__epc) {
        const before = t;
        t = t.replaceAll('{{EPC}}', String(data.__epc).trim())
            .replaceAll('{{EPC_CODE}}', String(data.__epc).trim());
        if (t !== before) hadPh = true;
    }

    // Sequential number
    if (data.__labelIndex !== undefined) {
        const seqStr = String(data.__labelIndex).padStart(5, '0');
        const before = t;
        t = t.replaceAll('{{SEQ}}', seqStr);
        if (t !== before) hadPh = true;
    }

    // All other column placeholders
    Object.keys(data).forEach(col => {
        if (col.startsWith('__')) return;
        const ph = `{{${col}}}`;
        if (t.includes(ph)) {
            hadPh = true;
            const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
            t = t.replaceAll(ph, isPriceColumn(col) ? formatPrice(raw) : raw);
        }
    });

    // Clean up double rupee symbols
    while (/₹\s*₹/.test(t)) t = t.replace(/₹\s*₹/g, '₹');

    return { text: formatNetQty(t), hadPh };
};

// ─── QR Value Resolution ──────────────────────────────────────────────────────
/**
 * QR code elements always show EPC data.
 * mapping[el.id] === '__empty'  → render nothing
 * mapping[el.id] === '__epc'    → use __qr / __epc from expanded row
 * Otherwise fall back to __qr → __epc → template static value
 */
const resolveQRValue = (el, data, mapping) => {
    const mp = mapping[el.id];
    if (mp === '__empty') return '';

    // Check ALL string properties of the element for keywords
    const allProps = Object.keys(el)
        .filter(k => typeof el[k] === 'string')
        .map(k => el[k].toUpperCase())
        .join(' ');

    const isExplicitEpc = allProps.includes('EPC') || allProps.includes('RFID');
    const isExplicitEan = (allProps.includes('EAN') || allProps.includes('OLD') || allProps.includes('BARCODE')) && !isExplicitEpc;

    // 1. Explicit EAN QR Code (Always shows Barcode)
    if (isExplicitEan) {
        return String(data.__ean || '').trim();
    }

    // 2. Explicit EPC QR Code (Always shows RFID EPC)
    if (isExplicitEpc) {
        // If we have matched RFID data or auto-gen is allowed, use it
        if (data.__qr && String(data.__qr).trim())
            return String(data.__qr).trim();
        return '';
    }

    // 3. Dual-mode / Standard QR Code (Existing Logic)
    // RFID file was uploaded and this row has a real matched EPC — always top priority
    if (data.__isAutoEpc === false && data.__qr && String(data.__qr).trim())
        return String(data.__qr).trim();

    // Explicit column mapping (not the __epc sentinel)
    if (mp && mp !== '__epc' && data[mp] !== undefined)
        return String(data[mp]).trim();

    // Look for a real EPC column in the Excel row itself
    if (mp === '__epc' || !mp) {
        const epcCol = Object.keys(data).find(k =>
            k.toLowerCase().replace(/[\s_-]/g, '') === 'epc'
        );
        if (epcCol && String(data[epcCol] ?? '').trim())
            return String(data[epcCol]).trim();
    }

    // No RFID matched — fall back to EAN so QR is never blank
    if (data.__ean && String(data.__ean).trim())
        return String(data.__ean).trim();

    return String(data.__qr || '').trim();
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
const resolveBarcodeValue = (el, data, mapping) => {
    const mp = mapping[el.id];

    // If it's a QR-format barcode, use QR resolution logic
    const fmt = (el.barcodeFormat || '').toUpperCase();
    if (fmt === 'QRCODE' || fmt === 'EPC') {
        return resolveQRValue(el, data, mapping);
    }

    if (mp && mp !== '__epc' && data[mp] !== undefined)
        return String(data[mp] ?? '').replace(/^[₹\s]+/, '').trim();
    if (mp === '__ean' || data.__ean) return data.__ean || '';
    // Auto-detect EAN column
    const keys = Object.keys(data);
    const eanCol = keys.find(k => {
        const l = k.toLowerCase().replace(/[\s_-]/g, '');
        return l === 'ean' || l === 'ean13' || l === 'barcode' || l === 'gtin';
    }) || keys.find(k => k.toLowerCase() === 'epc');
    if (eanCol && data[eanCol] !== undefined)
        return String(data[eanCol] ?? '').replace(/^[₹\s]+/, '').trim();
    if (data.__ean) return data.__ean;
    return el.barcodeValue || '123456789';
};

// ─── Element Resolver for Canvas Preview ─────────────────────────────────────
const resolveElement = (el, data, mapping) => {
    const newEl = { ...el };

    if (el.type === 'qrcode') {
        newEl.qrValue = resolveQRValue(el, data, mapping);
        return newEl;
    }

    if (el.type === 'barcode') {
        newEl.barcodeValue = resolveBarcodeValue(el, data, mapping);
        return newEl;
    }

    if (el.type === 'text' || el.type === 'placeholder') {
        const mp = mapping[el.id];
        if (mp && mp !== '__epc' && data[mp] !== undefined) {
            const raw = String(data[mp] ?? '').replace(/^[₹\s]+/, '').trim();
            newEl.text = formatNetQty(isPriceColumn(mp) ? formatPrice(raw) : raw);
        } else {
            const { text } = resolveDynamicText(el.text, data);
            newEl.text = text;
        }
        return newEl;
    }

    if (el.type === 'rect') {
        const elName = (el.name || '').toLowerCase();
        const isStrip = elName.includes('strip') || elName.includes('color') ||
            ((el.width || 0) > 80 && (el.height || 0) < 50);
        if (isStrip) {
            const mp = mapping[el.id];
            if (mp && data[mp] !== undefined) {
                const mc = resolveStripColor(String(data[mp]).trim());
                if (mc) newEl.fill = mc;
            } else {
                const sc = Object.keys(data).find(c => {
                    const n = c.toLowerCase().replace(/[\s_-]/g, '');
                    return n.includes('stripcolor') || n === 'strip';
                });
                if (sc && data[sc]) {
                    const mc = resolveStripColor(String(data[sc]).trim());
                    if (mc) newEl.fill = mc;
                }
            }
        }
        return newEl;
    }

    return newEl;
};

// ─── Label Type Helpers ───────────────────────────────────────────────────────
const getLabelType = (design) => {
    if (!design) return 'normal';
    if (design.labelType) return design.labelType.toLowerCase();
    const title = (design.title || '').toLowerCase();
    if (title.includes('azortee') || title.includes('azorte')) return 'azortee';
    if (title.includes('livsmart')) return 'livsmart';
    return 'normal';
};

// ─── Canvas Label Component ───────────────────────────────────────────────────
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
                // Removed black background tinting for size
            }
            if (el.type === 'rect') {
                // Removed black background tinting for size boxes
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
                            // Inside LayoutLabel, replace the ₹ text rendering block:
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
                                        const rH = fs * 0.85;
                                        const rW = fs * 0.65;
                                        const rY = fs * 0.02;
                                        // Approximate px width per character for this font/size
                                        const charPxW = fs * 0.55;

                                        parts.forEach((part, i) => {
                                            if (part) {
                                                items.push(
                                                    <Text
                                                        key={`t-${i}`}
                                                        x={currentX}
                                                        y={0}
                                                        text={part}
                                                        fontSize={fs}
                                                        fontFamily={ff}
                                                        fontStyle={`${isItalic ? 'italic' : 'normal'} ${weight}`}
                                                        fill={col}
                                                        wrap="none"
                                                        letterSpacing={el.letterSpacing || 0}
                                                    />
                                                );
                                                currentX += part.length * charPxW;
                                            }
                                            if (i < parts.length - 1) {
                                                items.push(
                                                    <KImage key={`r-${i}`} x={currentX} y={rY} image={rupeeImg} width={rW} height={rH} />
                                                );
                                                currentX += rW + 1;
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
                        case 'qrcode': {
                            const resolvedQR = el.qrValue;
                            if (!resolvedQR) {
                                const boxW = el.width || 40, boxH = el.height || 40;
                                return (
                                    <Group key={key} {...common}>
                                        <Rect width={boxW} height={boxH} fill="#f8f8f8" stroke="#d1d5db" strokeWidth={1} dash={[3, 2]} cornerRadius={2} />
                                        <Text
                                            text="EPC"
                                            fontSize={Math.max(7, boxW * 0.18)}
                                            fontFamily="Arial"
                                            fill="#9ca3af"
                                            width={boxW}
                                            align="center"
                                            y={boxH * 0.28}
                                        />
                                        <Text
                                            text="PENDING"
                                            fontSize={Math.max(5, boxW * 0.13)}
                                            fontFamily="Arial"
                                            fill="#9ca3af"
                                            width={boxW}
                                            align="center"
                                            y={boxH * 0.55}
                                        />
                                    </Group>
                                );
                            }

                            return <QRElement key={key} {...common}
                                el={{ ...el, qrValue: resolvedQR }}
                                onSelect={() => { }} />;
                        }
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

// ─── PDF Vector Rendering ─────────────────────────────────────────────────────
const renderQRAtPos = async (pdf, value, x, y, size) => {
    if (!value || !String(value).trim()) return;
    try {
        const dataUrl = await QRCode.toDataURL(String(value), {
            margin: 1, errorCorrectionLevel: 'M', width: 512,
            color: { dark: '#000000', light: '#ffffff' },
        });
        pdf.addImage(dataUrl.split(',')[1], 'PNG', x, y, size, size);
    } catch (e) { console.warn('QR render failed:', e); }
};

const drawVectorBarcode = async (pdf, value, x, y, w, h, format, fill, isProduction = false, fontFamily = '', fontWeight = 'normal', fontStyle = 'normal', fontSize = 0) => {
    try {
        const fmt = (format || 'CODE128').toUpperCase();

        if (fmt === 'QRCODE' || fmt === 'EPC') {
            const hasValue = value && String(value).trim();
            if (!hasValue) {
                if (!isProduction) {
                    const qsz = Math.min(w, h);
                    pdf.setDrawColor('#9ca3af'); pdf.setLineWidth(0.1);
                    pdf.rect(x + (w - qsz) / 2, y + (h - qsz) / 2, qsz, qsz, 'D');
                    pdf.setFontSize(Math.max(3, qsz * 0.15)); pdf.setTextColor('#9ca3af');
                    pdf.text('QR PENDING', x + w / 2, y + h * 0.6, { align: 'center' });
                }
                return;
            }
            const qsz = Math.min(w, h);
            await renderQRAtPos(pdf, value, x + (w - qsz) / 2, y + (h - qsz) / 2, qsz, fill);
            return;
        }

        if (fmt === 'EAN13') {
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
            const fsPt = fontSize > 0 ? fontSize : (isProduction ? 8.5 : 6);
            const fsMM = fsPt * 0.352778;
            const barZoneH = h - fsMM - 0.2, guardH = barZoneH + 1.2;
            const unitW = w / 109, bsX = x + unitW * 7;
            const isGuard = i => i < 3 || (i >= 45 && i < 50) || i >= 92;
            pdf.setFillColor(fill || '#000000');
            let cx = bsX;
            for (let i = 0; i < 95;) {
                if (bits[i] === '1') {
                    let sp = 1;
                    while (i + sp < 95 && bits[i + sp] === '1' && isGuard(i + sp) === isGuard(i)) sp++;
                    pdf.rect(cx, y, unitW * sp, isGuard(i) ? guardH : barZoneH, 'F');
                    cx += unitW * sp; i += sp;
                } else { cx += unitW; i++; }
            }
            const pdfFont = 'Arial';
            let isBold = String(fontWeight || '').includes('bold') || fontWeight === '700' || fontWeight === 700;
            if (!fontWeight && fmt === 'EAN13') isBold = true;
            const isItalic = fontStyle === 'italic';
            const pdfStyle = (isBold && isItalic) ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';

            const fontList = pdf.getFontList();
            if (fontList[pdfFont]) {
                pdf.setFont(pdfFont, pdfStyle);
            } else {
                pdf.setFont('courier', 'normal');
            }
            pdf.setFontSize(fsPt);
            const ty = y + barZoneH + fsMM * 1.0;
            pdf.text(s[0], x + unitW * 2.5, ty, { align: 'center' });
            for (let i = 0; i < 6; i++) pdf.text(s[i + 1], bsX + unitW * (3 + i * 7 + 3.5), ty, { align: 'center' });
            for (let i = 0; i < 6; i++) pdf.text(s[i + 7], bsX + unitW * (50 + i * 7 + 3.5), ty, { align: 'center' });
            return;
        }

        // CODE128 and others
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
        const pdfFont = resolvePdfFont(fontFamily || '');
        const isBold = String(fontWeight || '').includes('bold') || fontWeight === '700' || fontWeight === 700;
        const isItalic = fontStyle === 'italic';
        const pdfStyle = (isBold && isItalic) ? 'bolditalic' : isBold ? 'bold' : isItalic ? 'italic' : 'normal';

        const fl = pdf.getFontList();
        if (fl[pdfFont]) {
            pdf.setFont(pdfFont, pdfStyle);
        } else {
            pdf.setFont('Arial', isBold ? 'bold' : 'normal');
        }
        const scaledFs = fsPt * (w / 44);
        pdf.setFontSize(scaledFs);
        pdf.text(String(value), x + w / 2, y + barH + 0.5 + (scaledFs * 0.352778) * 0.8, { align: 'center' });

    } catch (e) { console.warn('Barcode PDF error:', e); }
};

// ─── Download Modal ───────────────────────────────────────────────────────────
function DownloadModal({
    onClose, selectedTemplate: parentTemplate, manualMapping: parentMapping,
    drawVectorLabel, templates, onSelectTemplate,
}) {
    const [step, setStep] = useState(1);
    const [labelFile, setLabelFile] = useState(null);
    const [epcFile, setEpcFile] = useState(null);
    const [rfidHeaders, setRfidHeaders] = useState([]);
    const [qrCol, setQrCol] = useState('');
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [modalDesignId, setModalDesignId] = useState(
        parentTemplate?._id || parentTemplate?.id || ''
    );
    const [modalTemplate, setModalTemplate] = useState(parentTemplate);
    const [modalMapping, setModalMapping] = useState(parentMapping || {});

    const labelInputRef = useRef();
    const epcInputRef = useRef();

    const activeTemplate = modalTemplate || parentTemplate;
    const activeMapping = { ...parentMapping, ...modalMapping };

    const handleDesignChange = async (id) => {
        setModalDesignId(id);
        if (!id) { setModalTemplate(null); return; }
        try {
            const res = await designsAPI.getById(id);
            setModalTemplate(res.data.design);
            if (onSelectTemplate) onSelectTemplate(id);
        } catch { setError('Failed to load design'); }
    };

    const autoMap = (template, cols) => {
        const nm = { ...modalMapping };
        (template?.elements || []).forEach(el => {
            if (!['text', 'placeholder', 'barcode', 'qrcode', 'rect'].includes(el.type)) return;
            // QR elements: Map to __epc by default, but respect el.fieldName if set
            const isActuallyQr = el.type === 'qrcode' || (el.type === 'barcode' && (el.barcodeFormat || '').toUpperCase() === 'QRCODE');
            if (isActuallyQr) {
                if (!nm[el.id]) nm[el.id] = el.fieldName || '__epc';
                return;
            }
            const templateValue = el.type === 'barcode' ? el.barcodeValue : el.text;
            const matches = templateValue?.match(/{{(.*?)}}/g);
            const names = matches ? matches.map(m => m.replace(/{{|}}/g, '')) : (el.fieldName ? [el.fieldName] : []);
            names.forEach(name => {
                const col = cols.find(c => c === name) ||
                    cols.find(c => c.toLowerCase() === name.toLowerCase()) ||
                    cols.find(c => c.toLowerCase().replace(/\s/g, '') === name.toLowerCase().replace(/\s/g, ''));
                if (col && !nm[el.id]) nm[el.id] = col;
            });
        });
        return nm;
    };

    const handleValidate = () => {
        if (!activeTemplate) { setError('Please select a design first.'); return; }
        if (!labelFile) { setError('Please upload the label file.'); return; }
        setError('');

        const reader = new FileReader();
        reader.onload = (e) => {
            const wb = XLSX.read(e.target.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const labelRows = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false });
            const cols = labelRows.length ? Object.keys(labelRows[0]) : [];
            setModalMapping(autoMap(activeTemplate, cols));

            if (epcFile) {
                const r2 = new FileReader();
                r2.onload = (ev) => {
                    const wb2 = XLSX.read(ev.target.result, { type: 'binary' });
                    const ws2 = wb2.Sheets['EPC_Data'] || wb2.Sheets[wb2.SheetNames[0]];
                    const rfidRows = XLSX.utils.sheet_to_json(ws2, { defval: '' });
                    const epcMap = buildEpcMap(rfidRows, qrCol || null);
                    const expanded = expandLabelRows(labelRows, epcMap);
                    finishValidation(expanded);
                };
                r2.readAsBinaryString(epcFile);
            } else {
                finishValidation(expandLabelRows(labelRows, {}));
            }
        };
        reader.readAsBinaryString(labelFile);
    };

    const finishValidation = (expanded) => {
        const validRows = expanded.filter(r => !r.__blank);
        const matched = validRows.filter(r => r.__epc).length;
        setSummary({ totalLabels: validRows.length, matched, unmatched: validRows.length - matched, validRows });
        setStep(2);
    };

    const handleGenerate = async (mode = 'full') => {
        setStep(3);
        console.log('Sample row:', summary.validRows[0]);
        console.log('Mapping:', activeMapping);
        try {
            const unit = activeTemplate.canvasUnit || 'px';
            const dW = activeTemplate.canvasWidth || activeTemplate.width || 166;
            const dH = activeTemplate.canvasHeight || activeTemplate.height || 387;
            const lW = unit === 'mm' ? dW : dW * PX_TO_MM;
            const lH = unit === 'mm' ? dH : dH * PX_TO_MM;
            const ori = lW > lH ? 'landscape' : 'portrait';

            if (mode === 'rowwise') {
                const grouped = {};
                summary.validRows.forEach(row => {
                    const k = row.__originalRowIndex;
                    if (!grouped[k]) grouped[k] = [];
                    grouped[k].push(row);
                });
                const keys = Object.keys(grouped);
                for (let g = 0; g < keys.length; g++) {
                    const rows = grouped[keys[g]];
                    const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });
                    let first = true;
                    for (const row of rows) {
                        if (!first) pdf.addPage([lW, lH], ori);
                        first = false;
                        await drawVectorLabel(pdf, activeTemplate.elements, row, activeMapping, 0, 0, lW, lH, false, true);
                    }
                    pdf.save(`Labels_${rows[0].__ean || `row_${g + 1}`}.pdf`);
                    setProgress(Math.round(((g + 1) / keys.length) * 100));
                    await new Promise(r => setTimeout(r, 300));
                }
            } else {
                const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });
                let first = true;
                for (let i = 0; i < summary.validRows.length; i++) {
                    if (!first) pdf.addPage([lW, lH], ori);
                    first = false;
                    await drawVectorLabel(pdf, activeTemplate.elements, summary.validRows[i], activeMapping, 0, 0, lW, lH, false, true);
                    if (i % 20 === 0) {
                        setProgress(Math.round(((i + 1) / summary.validRows.length) * 100));
                        await new Promise(r => setTimeout(r, 0));
                    }
                }
                pdf.save(`Batch_Labels_${Date.now()}.pdf`);
            }
            setProgress(100);
            setStep(4);
        } catch (err) {
            setError('Generation failed: ' + err.message);
            setStep(2);
        }
    };

    const uploadZone = (label, hint, ref, file, setFile, icon, isEpc = false) => (
        <div
            onClick={() => ref.current?.click()}
            style={{
                border: `2px dashed ${file ? '#10b981' : '#e2e8f0'}`,
                borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                background: file ? '#f0fdf4' : '#f8fafc', transition: 'all 0.2s',
            }}
        >
            <input type="file" ref={ref} hidden accept=".xlsx,.xls"
                onChange={e => {
                    const f = e.target.files[0];
                    setFile(f);
                    if (isEpc && f) {
                        const r = new FileReader();
                        r.onload = ev => {
                            const wb = XLSX.read(ev.target.result, { type: 'binary' });
                            const ws = wb.Sheets['EPC_Data'] || wb.Sheets[wb.SheetNames[0]];
                            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                            if (data?.length) {
                                setRfidHeaders(data[0]);
                                setQrCol(data[0].find(h => String(h).toLowerCase().includes('epc')) || data[0][0] || '');
                            }
                        };
                        r.readAsBinaryString(f);
                    } else if (isEpc) {
                        setRfidHeaders([]); setQrCol('');
                    }
                    e.target.value = '';
                }}
            />
            <div style={{ color: file ? '#059669' : '#64748b', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{icon}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: file ? '#065f46' : '#1e293b' }}>{file ? file.name : label}</div>
            <div style={{ fontSize: 12, color: file ? '#34d399' : '#94a3b8', marginTop: 4 }}>{file ? 'Click to change' : hint}</div>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
            <div style={{
                background: 'white',
                borderRadius: 24,
                width: 650,
                maxWidth: '95vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 30px 60px -12px rgba(0,0,0,0.3)',
                position: 'relative',
                overflow: 'hidden',
                animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <style>{`
                    @keyframes modalSlideUp {
                        from { transform: translateY(30px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                    .modal-scroll::-webkit-scrollbar { width: 6px; }
                    .modal-scroll::-webkit-scrollbar-track { background: transparent; }
                    .modal-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .modal-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                `}</style>

                {/* Header Section (Fixed) */}
                <div style={{ padding: '24px 32px 12px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: '#f8fafc', border: 'none', color: '#94a3b8', cursor: 'pointer', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} className="hover-bg-red">
                        <X size={18} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                        <div style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: 'white', padding: 10, borderRadius: 12, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
                            <Layers size={22} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>Generate Batch Labels</h2>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 1, fontWeight: 500 }}>Upload label and EPC data files</div>
                        </div>
                    </div>

                    {/* Step indicators */}
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative', padding: '0 10px' }}>
                        <div style={{ height: 2, background: '#f1f5f9', position: 'absolute', left: 40, right: 40, top: 12, zIndex: 0 }} />
                        {[{ num: 1, label: 'Upload' }, { num: 2, label: 'Review' }, { num: 3, label: 'Generate' }].map((s, i) => (
                            <div key={s.num} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1, background: 'white', padding: '0 8px', justifyContent: i === 0 ? 'flex-start' : i === 2 ? 'flex-end' : 'center' }}>
                                <div style={{
                                    width: 26, height: 26, borderRadius: '50%',
                                    background: step >= s.num ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' : '#f1f5f9',
                                    color: step >= s.num ? 'white' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 12, fontWeight: 800,
                                    boxShadow: step === s.num ? '0 0 0 4px rgba(99,102,241,0.1)' : 'none',
                                    transition: 'all 0.3s'
                                }}>
                                    {step > s.num ? <Check size={14} /> : s.num}
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 700, color: step >= s.num ? '#6366f1' : '#94a3b8' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content Section (Scrollable) */}
                <div className="modal-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
                    {error && (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 12, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AlertCircle size={18} /> {error}
                        </div>
                    )}

                    {/* Step 1 Content */}
                    {step === 1 && (
                        <div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 22px', marginBottom: 18 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>1 — SELECT DESIGN TEMPLATE</div>
                                <select
                                    style={{ width: '100%', padding: '12px 16px', fontSize: 14, fontWeight: 700, border: `2px solid ${activeTemplate ? '#10b981' : '#e2e8f0'}`, borderRadius: 12, background: 'white', color: activeTemplate ? '#065f46' : '#1e293b', cursor: 'pointer', outline: 'none', transition: 'all 0.2s', boxShadow: activeTemplate ? '0 2px 8px rgba(16,185,129,0.05)' : 'none' }}
                                    value={modalDesignId}
                                    onChange={e => handleDesignChange(e.target.value)}
                                >
                                    <option value="">— Choose Design —</option>
                                    {(templates || []).map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>)}
                                </select>
                                {activeTemplate && (
                                    <div style={{ marginTop: 10, fontSize: 12, color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Active Template: {activeTemplate.title}
                                    </div>
                                )}
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 22px', marginBottom: 18 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>2 — LABEL DATA SOURCE (.XLSX)</div>
                                {uploadZone('Upload label file', 'Data for label placeholders', labelInputRef, labelFile, setLabelFile, <FileSpreadsheet size={24} />)}
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 22px' }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>3 — EPC MAPPING FILE (OPTIONAL)</div>
                                {uploadZone('Upload EPC file', 'Barcode to EPC identifier mapping', epcInputRef, epcFile, setEpcFile, <Link2 size={24} />, true)}
                                {rfidHeaders.length > 0 && (
                                    <div style={{ marginTop: 16, padding: '14px 18px', background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Search size={12} /> QR CODE COLUMN (EPC SOURCE):</div>
                                        <select
                                            style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 8, border: '1.5px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, color: '#334155', outline: 'none' }}
                                            value={qrCol}
                                            onChange={e => setQrCol(e.target.value)}
                                        >
                                            {rfidHeaders.map((h, i) => <option key={i} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2 Content */}
                    {step === 2 && summary && (
                        <div>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
                                    <div>
                                        <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{summary.totalLabels.toLocaleString()}</div>
                                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 600 }}>Total labels to generate</div>
                                    </div>
                                    <div style={{ background: '#f1f5f9', padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Summary Statistics
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    <div style={{ background: 'white', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontWeight: 700, fontSize: 13, marginBottom: 8 }}><CheckCircle2 size={16} /> EPC Matched</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{summary.matched.toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: 'white', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: summary.unmatched > 0 ? '#dc2626' : '#64748b', fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                                            {summary.unmatched > 0 ? <AlertCircle size={16} /> : <div style={{ width: 16 }} />} EPC Missing
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{summary.unmatched.toLocaleString()}</div>
                                    </div>
                                </div>

                                <div style={{ marginTop: 24 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Visual Preview (First 15 Items)</div>
                                    <div className="modal-scroll" style={{ display: 'flex', gap: 20, overflowX: 'auto', padding: '16px 4px 24px', minHeight: 180 }}>
                                        {summary.validRows.slice(0, 15).map((row, idx) => (
                                            <div key={idx} style={{ flexShrink: 0, width: 110, height: 240, position: 'relative' }}>
                                                <Stage width={110} height={240} style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 20px -5px rgba(0,0,0,0.15)' }}>
                                                    <Layer>
                                                        <LayoutLabel
                                                            width={110} height={240}
                                                            elements={activeTemplate.elements}
                                                            data={row} mapping={activeMapping}
                                                            designW={activeTemplate.canvasWidth || activeTemplate.width}
                                                            designH={activeTemplate.canvasHeight || activeTemplate.height}
                                                            labelType={getLabelType(activeTemplate)}
                                                        />
                                                    </Layer>
                                                </Stage>
                                                <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: 'white', fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 800, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>#{idx + 1}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {summary.unmatched > 0 && (
                                    <div style={{ marginTop: 20, padding: '12px 18px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: 10, lineHeight: 1.5 }}>
                                        <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                        <span><strong>Attention Needed:</strong> {summary.unmatched} labels are missing EPC mapping. These QR codes will be generated with placeholder data.</span>
                                    </div>
                                )}
                                {summary.matched === summary.totalLabels && summary.totalLabels > 0 && (
                                    <div style={{ marginTop: 20, padding: '12px 18px', borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                                        <CheckCircle2 size={16} /> All {summary.totalLabels} labels successfully mapped with EPC identifiers.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', background: '#f5f3ff', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(139,92,246,0.1)' }}>
                                <Cpu size={40} className="animate-pulse" />
                            </div>
                            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 12 }}>Generating Label Assets</h3>
                            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 30, maxWidth: 300, margin: '0 auto 30px' }}>Your high-fidelity vector labels are being assembled. This may take a moment for large batches.</p>

                            <div style={{ maxWidth: 360, margin: '0 auto' }}>
                                <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden', marginBottom: 14, border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: '#6366f1' }}>{progress}% Complete</div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Please do not close this window</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(16,185,129,0.1)' }}>
                                <CheckCircle2 size={40} />
                            </div>
                            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', marginBottom: 12 }}>Batch Ready for Download</h3>
                            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32, maxWidth: 320, margin: '0 auto 32px' }}>Label generation process successfully completed. Your PDF documents are ready for local storage.</p>

                            <div style={{ background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 32, display: 'inline-block', minWidth: 200 }}>
                                <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Total Generated</div>
                                <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>{summary?.totalLabels} Labels</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section (Fixed) */}
                <div style={{ padding: '20px 32px', borderTop: '1px solid #f1f5f9', background: '#fcfcfd', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {step === 1 && (
                        <>
                            <button className="btn btn-ghost px-6" onClick={onClose} style={{ borderRadius: 10, fontWeight: 700 }}>Cancel</button>
                            <button className="btn btn-primary px-8" onClick={handleValidate} disabled={!labelFile || !activeTemplate} style={{ borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
                                Validate & Continue
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <button className="btn btn-ghost px-6" onClick={() => setStep(1)} style={{ borderRadius: 10, fontWeight: 700 }}>Back</button>
                            <button className="btn btn-secondary px-5 gap-2" onClick={() => handleGenerate('rowwise')} style={{ borderRadius: 10, fontWeight: 700 }}>
                                <Layers size={16} /> Row Wise ({new Set(summary.validRows.map(r => r.__originalRowIndex)).size})
                            </button>
                            <button className="btn btn-primary px-8 gap-2" onClick={() => handleGenerate('full')} style={{ borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>
                                <Cpu size={16} /> Full Batch
                            </button>
                        </>
                    )}

                    {step === 4 && (
                        <button className="btn btn-primary px-12" onClick={onClose} style={{ borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px rgba(99,102,241,0.2)' }}>Done</button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Layout Component ────────────────────────────────────────────────────
export default function Layout() {
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useUIStore();

    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [rfidData, setRfidData] = useState([]);
    const [epcMap, setEpcMap] = useState({});
    const [expandedData, setExpandedData] = useState([]);
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
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveInputs, setSaveInputs] = useState({ folder: '', filename: 'Proof_Sheet' });
    const [existingFolders, setExistingFolders] = useState([]);
    const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
    const [epcStats, setEpcStats] = useState(null);
    const [cmykInput, setCmykInput] = useState({ name: '', c: 0, m: 0, y: 0, k: 0 });
    const stageRef = useRef();

    // ── Init ──
    useEffect(() => {
        const img = new window.Image();
        img.src = logo;
        img.onload = () => setLogoImg(img);
        fetchStripColors();
        fetchDesigns();
    }, []);

    // ── Expand rows when data or epcMap changes ──
    useEffect(() => {
        if (!excelData.length) { setExpandedData([]); setEpcStats(null); return; }
        const exp = expandLabelRows(excelData, epcMap);
        setExpandedData(exp);
        if (Object.keys(epcMap).length > 0) {
            const validRows = exp.filter(r => !r.__blank);
            const matched = validRows.filter(r => r.__epc).length;
            setEpcStats({ total: validRows.length, matched, unmatched: validRows.length - matched });
        } else {
            setEpcStats(null);
        }
    }, [excelData, epcMap]);

    // ── API helpers ──
    const fetchDesigns = async () => {
        try {
            setLoading(true);
            const res = await designsAPI.getAll();
            setTemplates(res?.data?.designs || []);
        } catch { toast.error('Failed to load designs'); }
        finally { setLoading(false); }
    };

    const fetchStripColors = async () => {
        const defaults = [
            { _id: 'def-blue', name: 'Blue', hex: '#0d5ce3', cmyk: '95,64,11,0' },
            { _id: 'def-red', name: 'Red', hex: '#ff0000', cmyk: '0,100,100,0' },
            { _id: 'def-orange', name: 'Orange', hex: '#ff6600', cmyk: '0,60,100,0' },
            { _id: 'def-green', name: 'Green', hex: '#00ff00', cmyk: '100,0,100,0' },
            { _id: 'def-purple', name: 'Purple', hex: '#8526d6', cmyk: '48,85,16,0' },
        ];
        try {
            let colors = [...defaults];
            try {
                const res = await stripColorsAPI.getAll();
                if (res?.data?.colors) colors = [...colors, ...res.data.colors];
            } catch { }
            setStripColors(colors);
            const map = {};
            colors.forEach(c => { map[c.name.toLowerCase()] = c.hex; });
            STRIP_COLOR_MAP = map;
        } catch (err) { console.error(err); }
    };

    // ── Template selection ──
    const handleSelectTemplate = async (designId) => {
        if (!designId) { setSelectedTemplate(null); setTemplateFields([]); return; }
        try {
            setLoading(true);
            const res = await designsAPI.getById(designId);
            const design = res.data.design;
            setSelectedTemplate(design);

            // Extract fields for mapping UI
            const fields = [];
            design.elements.forEach(el => {
                if (!['text', 'placeholder', 'barcode', 'qrcode', 'rect'].includes(el.type)) return;
                const isActuallyQr = el.type === 'qrcode' || (el.type === 'barcode' && (el.barcodeFormat || '').toUpperCase() === 'QRCODE');
                if (isActuallyQr) {
                    const lbl = el.fieldName || el.name || '{{EPC}}';
                    fields.push({ id: el.id, name: '__epc', type: 'qrcode', label: lbl });
                    return;
                }
                if (el.type === 'rect') {
                    const elName = (el.name || '').toLowerCase();
                    if (elName.includes('strip') || elName.includes('color') || ((el.width || 0) > 80 && (el.height || 0) < 50)) {
                        fields.push({ id: el.id, name: el.fieldName || 'strip', type: 'rect', label: el.fieldName || el.name || 'Strip Color' });
                    }
                    return;
                }
                const val = el.type === 'barcode' ? el.barcodeValue : el.text;
                const matches = val?.match(/{{(.*?)}}/g);
                if (matches) {
                    matches.forEach(m => {
                        const name = m.replace(/{{|}}/g, '');
                        if (!fields.find(f => f.name === name))
                            fields.push({ id: el.id, name, type: 'placeholder', label: `{{${name}}}` });
                    });
                } else if (el.type !== 'text') {
                    const lbl = el.fieldName || el.text || el.name || `Field ${el.id.slice(0, 4)}`;
                    fields.push({ id: el.id, name: el.fieldName || el.text, type: el.type, label: lbl.length > 30 ? lbl.slice(0, 30) + '…' : lbl });
                }
            });
            setTemplateFields(fields);

            // Auto-map columns if data already loaded
            if (columns.length > 0) {
                const nm = {};
                fields.forEach(f => {
                    if (f.type === 'qrcode') { nm[f.id] = '__epc'; return; }
                    if (!f.name) return;
                    const col = columns.find(c => c === f.name) ||
                        columns.find(c => c.toLowerCase() === f.name.toLowerCase()) ||
                        columns.find(c => c.toLowerCase().replace(/\s/g, '') === f.name.toLowerCase().replace(/\s/g, ''));
                    if (col) nm[f.id] = col;
                });
                setManualMapping(nm);
            }
        } catch { toast.error('Failed to load design'); }
        finally { setLoading(false); }
    };

    // ── File uploads ──
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target.result, { type: 'binary' });
            // Pick sheet with most columns
            let bestSheet = wb.Sheets[wb.SheetNames[0]], bestCount = 0;
            wb.SheetNames.forEach(name => {
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
                if (!rows.length) return;
                const count = rows[0].filter(c => c !== null && String(c).trim() !== '').length;
                if (count > bestCount) { bestCount = count; bestSheet = wb.Sheets[name]; }
            });
            const data = XLSX.utils.sheet_to_json(bestSheet, { defval: '', blankrows: true });
            if (!data.length) return;
            setExcelData(data);
            const cols = Object.keys(data[0]).filter(c => c && String(c).trim() && c !== '__EMPTY');
            setColumns(cols);
            toast.success(`Loaded ${data.length} records · ${cols.length} columns`);
            // Auto-map
            if (selectedTemplate) {
                const nm = {};
                templateFields.forEach(f => {
                    if (f.type === 'qrcode') { nm[f.id] = '__epc'; return; }
                    if (!f.name) return;
                    const col = cols.find(c => c === f.name) ||
                        cols.find(c => c.toLowerCase() === f.name.toLowerCase()) ||
                        cols.find(c => c.toLowerCase().replace(/\s/g, '') === f.name.toLowerCase().replace(/\s/g, ''));
                    if (col && !nm[f.id]) nm[f.id] = col;
                });
                setManualMapping(nm);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleRfidFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target.result, { type: 'binary' });
            const ws = wb.Sheets['EPC_Data'] || wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
            if (!rows.length) { toast.error('No data found in RFID file'); return; }
            setRfidData(rows);
            const map = buildEpcMap(rows);
            setEpcMap(map);
            toast.success(`RFID loaded: ${rows.length} EPCs across ${Object.keys(map).length} barcodes`);
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

    // ── Strip color management ──
    const handleAddCMYKColor = async () => {
        if (!cmykInput.name.trim()) return toast.error('Enter a color name');
        const c = cmykInput.c / 100, m = cmykInput.m / 100, y = cmykInput.y / 100, k = cmykInput.k / 100;
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
        const newColor = { _id: `custom-${Date.now()}`, name: cmykInput.name.trim(), hex, cmyk: `${cmykInput.c},${cmykInput.m},${cmykInput.y},${cmykInput.k}` };
        const updated = [...stripColors, newColor];
        setStripColors(updated);
        STRIP_COLOR_MAP[newColor.name.toLowerCase()] = hex;
        setCmykInput({ name: '', c: 0, m: 0, y: 0, k: 0 });
        toast.success(`${newColor.name} added`);
        try { await stripColorsAPI.create({ name: newColor.name, hex }); } catch { }
    };

    const handleDeleteColor = async (e, colorId) => {
        e.stopPropagation();
        const updated = stripColors.filter(c => c._id !== colorId);
        setStripColors(updated);
        const map = {};
        updated.forEach(c => { map[c.name.toLowerCase()] = c.hex; });
        STRIP_COLOR_MAP = map;
        toast.success('Color removed');
        if (!String(colorId).startsWith('custom-') && !String(colorId).startsWith('def-'))
            try { await stripColorsAPI.delete(colorId); } catch { }
    };

    // ── PDF: vector label drawing ─────────────────────────────────────────────
    // ── PDF: vector label drawing ─────────────────────────────────────────────
    const drawVectorLabel = async (
        pdf, elements, data, mapping,
        mmX, mmY, mmW, mmH,
        isBranding = false, isProduction = false,
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
        const tagR = isProduction ? 0 : Math.min(4, (selectedTemplate?.canvasRadius || 10) * PX_TO_MM * cs);

        // Background
        pdf.setFillColor('#ffffff');
        tagR > 0 ? pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F')
            : pdf.rect(mmX, mmY, mmW, mmH, 'F');

        // Proof border (non-production only)
        if (!isProduction) {
            pdf.setDrawColor('#FF00FF');
            pdf.setLineWidth(0.15);
            pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'D');
            pdf.circle(mmX + mmW / 2, mmY + 5, 1.5, 'D');
        }

        // Branding page — white background, logo centred
        if (isBranding) {
            const bImg = brandingImg || logoImg;
            if (bImg) {
                try {
                    // Fill the entire tag area with the image (no padding, no outline)
                    pdf.addImage(bImg, 'PNG', mmX, mmY, mmW, mmH, 'FRONT_LOGO', 'FAST');
                } catch { }
            } else {
                pdf.setFillColor('#f1f5f9');
                tagR > 0
                    ? pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F')
                    : pdf.rect(mmX, mmY, mmW, mmH, 'F');
                pdf.setFontSize(7); pdf.setFont('Arial', 'bold'); pdf.setTextColor('#94a3b8');
                pdf.text('BRAND LOGO', mmX + mmW / 2, mmY + mmH / 2, { align: 'center' });
            }
            return;
        }

        pdf.saveGraphicsState();
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, null);
        pdf.internal.write('W n');

        const sizeCol = Object.keys(data).find(k =>
            k.toLowerCase() === 'size' || k.toLowerCase().includes('size')
        );
        const sizeVal = String(data[sizeCol] || '').trim().toUpperCase();

        // ── Azortee: build circle visibility map ──────────────────────────────
        const azorteeVisibleCircles = new Set();
        if (labelType === 'azortee' && sizeVal) {
            const circleTextMap = buildAzorteeCircleMap(elements, data);
            circleTextMap.forEach((pairedText, circleId) => {
                if (pairedText === sizeVal) azorteeVisibleCircles.add(circleId);
            });
        }

        // ── Livsmart: find text elements that should be highlighted ───────────
        const livsmartHighlightTextIds = new Set();
        if (labelType === 'livsmart' && sizeVal) {
            elements.forEach(el => {
                if (el.type !== 'text' && el.type !== 'placeholder') return;
                if (el.text?.includes('{{')) return;
                const cleanText = (el.text || '').trim().toUpperCase();
                if (cleanText === sizeVal && cleanText.length < 8) livsmartHighlightTextIds.add(el.id);
            });
        }

        // ── Normal/livsmart: find rects behind size text to highlight ─────────
        const sizeHighlightRectIds = new Set();
        if ((labelType === 'normal' || labelType === 'livsmart') && sizeVal) {
            elements.forEach(textEl => {
                if (textEl.type !== 'text' && textEl.type !== 'placeholder') return;
                const { text: resolved } = resolveDynamicText(textEl.text, data);
                if (!resolved || resolved.trim().toUpperCase() !== sizeVal || sizeVal.length >= 6) return;
                elements.forEach(rectEl => {
                    if (rectEl.type !== 'rect') return;
                    if (Math.abs((rectEl.x || 0) - (textEl.x || 0)) <= 8 && Math.abs((rectEl.y || 0) - (textEl.y || 0)) <= 8)
                        sizeHighlightRectIds.add(rectEl.id);
                });
            });
        }

        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        for (const el of sorted) {
            if (el.visible === false) continue;
            pdf.saveGraphicsState();

            const unitScale = unit === 'mm' ? 1 : PX_TO_MM;
            const elSX = el.scaleX || 1, elSY = el.scaleY || 1, elRot = el.rotation || 0;
            const ex = offX + (el.x || 0) * unitScale * cs;
            const ey = offY + (el.y || 0) * unitScale * cs;
            const ew = (el.width || 0) * unitScale * cs * elSX;
            const eh = (el.height || 0) * unitScale * cs * elSY;
            const elName = (el.name || '').toLowerCase();

            // ── Size indicator circles (azortee / normal) ──────────────────────
            if (el.type === 'circle' && (elName.includes('sizeindicator') || elName.includes('sizecircle') || elName.includes('circle'))) {
                if (labelType === 'azortee' && azorteeVisibleCircles.has(el.id)) {
                    const rx = (el.radius || 10) * unitScale * cs * (el.scaleX || 1);
                    const ry = (el.radius || 10) * unitScale * cs * (el.scaleY || 1);
                    pdf.setDrawColor(el.stroke || el.fill || '#000000');
                    pdf.setLineWidth(Math.max(0.2, (el.strokeWidth || 1.5) * unitScale * cs * (el.scaleX || 1)));
                    pdf.ellipse(ex, ey, rx, ry, 'D');
                }
                // For non-azortee, skip all size-indicator circles
                pdf.restoreGraphicsState(); continue;
            }

            // ── QR Code ────────────────────────────────────────────────────────
            if (el.type === 'qrcode') {
                const qv = resolveQRValue(el, data, mapping);
                const qsz = Math.min(ew, eh);
                const qx = ex + (ew - qsz) / 2;
                const qy = ey + (eh - qsz) / 2;

                const hasValue = qv && String(qv).trim();

                if (hasValue) {
                    // Show real QR if we have a value, even in proof sheets
                    await renderQRAtPos(pdf, String(qv).trim(), qx, qy, qsz);
                } else if (!isProduction) {
                    pdf.setDrawColor('#9ca3af'); pdf.setLineWidth(0.2);
                    pdf.setLineDashPattern([0.5, 0.5], 0);
                    pdf.rect(qx, qy, qsz, qsz, 'D');
                    pdf.setLineDashPattern([], 0);
                    pdf.setFontSize(Math.max(3, qsz * 0.15)); pdf.setTextColor('#9ca3af');
                    pdf.text('QR CODE', qx + qsz / 2, qy + qsz * 0.45, { align: 'center' });
                    pdf.text('PENDING', qx + qsz / 2, qy + qsz * 0.65, { align: 'center' });
                    pdf.setTextColor('#000000');
                }
                pdf.restoreGraphicsState(); continue;
            }

            // ── Barcode ────────────────────────────────────────────────────────
            if (el.type === 'barcode') {
                const bv = resolveBarcodeValue(el, data, mapping);
                const fmt = (el.barcodeFormat || 'CODE128').toUpperCase();
                let bw = ew, bh = eh * 0.9, bx = ex, by = ey;
                if (fmt === 'EAN13') {
                    bw = 26.2 * cs; bh = 10.4 * cs;
                    bx = ex + (ew - bw) / 2;
                    by = ey + (eh - bh) / 2 + 5 * PX_TO_MM * cs;
                }
                const barFs = Math.max(2, (el.fontSize || 10) * 0.75 * (el.scaleY || 1) * cs);
                await drawVectorBarcode(pdf, bv, bx, by, bw, bh, fmt, el.fill, isProduction, el.fontFamily, el.fontWeight, el.fontStyle, barFs);
                pdf.restoreGraphicsState(); continue;
            }

            // ── Text / Placeholder ─────────────────────────────────────────────
            if (el.type === 'text' || el.type === 'placeholder') {
                const mp = mapping[el.id];
                let val;
                if (mp && mp !== '__epc' && data[mp] !== undefined) {
                    const raw = String(data[mp] ?? '').replace(/^[₹\s]+/, '').trim();
                    val = formatNetQty(isPriceColumn(mp) ? formatPrice(raw) : raw);
                } else {
                    const { text } = resolveDynamicText(el.text, data);
                    val = text;
                }
                if (!val || val === 'Text') { pdf.restoreGraphicsState(); continue; }

                const fs = Math.max(2, (el.fontSize || 12) * 0.75 * elSY * cs);
                const fsMM = fs * 0.352778;
                const bold = String(el.fontWeight || '').includes('bold') || el.fontWeight === '700' || el.fontWeight === 700;
                const italic = el.fontStyle === 'italic';
                const pdfStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
                const pdfFont = resolvePdfFont(el.fontFamily || '');

                const cleanV = val.trim().toUpperCase();

                let textColor = el.fill || '#000000';
                // Removed conditional white text for size highlight

                pdf.setFontSize(fs); pdf.setTextColor(textColor);
                try {
                    const flist = pdf.getFontList();
                    const fontExists = flist[pdfFont];
                    pdf.setFont(fontExists ? pdfFont : 'Arial', pdfStyle);
                } catch { try { pdf.setFont('Arial', 'normal'); } catch { } }

                const align = el.textAlign || 'left';
                const wrapW = (el.width || 0) * unitScale * cs;

                if (elRot !== 0) {
                    const lines = wrapW > 10 ? pdf.splitTextToSize(val.replace(/₹/g, 'Rs.'), wrapW) : [val.replace(/₹/g, 'Rs.')];
                    let ax = ex;
                    if (align === 'center' && wrapW > 0) ax = ex + wrapW / 2;
                    else if (align === 'right' && wrapW > 0) ax = ex + wrapW;
                    pdf.text(lines.join('\n'), ax, ey + fsMM * 0.85, { align, angle: -elRot, lineHeightFactor: el.lineHeight || 1.2 });
                    pdf.restoreGraphicsState(); continue;
                }

                if (elSX !== 1 && elSX > 0) pdf.internal.write(`${(elSX * 100).toFixed(1)} Tz`);

                const explicitLines = val.split('\n');
                const rawLines = [];
                explicitLines.forEach(seg => {
                    if (!seg.trim()) return;
                    if (wrapW > 10 && el.wrap !== 'none') pdf.splitTextToSize(seg.trim(), wrapW).forEach(l => rawLines.push(l.trim()));
                    else rawLines.push(seg.trim());
                });

                const effectiveW = wrapW > 10 ? wrapW : (() => {
                    let maxW = 0;
                    rawLines.forEach(l => { const w = pdf.getTextWidth(l.replace(/\s*₹\s*/g, '')); if (w > maxW) maxW = w; });
                    return maxW;
                })();
                const lh = fsMM * (el.lineHeight || 1.2);

                rawLines.forEach((line, li) => {
                    const lineY = ey + fsMM * 0.85 + li * lh;
                    if (!line.includes('₹')) {
                        let anchorX = ex, opts = {};
                        if (align === 'center') { anchorX = ex + effectiveW / 2; opts = { align: 'center' }; }
                        else if (align === 'right') { anchorX = ex + effectiveW; opts = { align: 'right' }; }
                        pdf.text(line, anchorX, lineY, opts);
                    } else {
                        const rupeeFsMM = 12.758 * 0.352778;
                        const imgW = rupeeFsMM * 0.85 * (elSX || 1);
                        const rupeeCnt = (line.match(/₹/g) || []).length;
                        const visualW = rupeeCnt * (imgW + 5 * PX_TO_MM);
                        let lineX = ex;
                        if (align === 'center') lineX = ex + (effectiveW - visualW) / 2;
                        else if (align === 'right') lineX = ex + effectiveW - visualW;
                        drawRupeeText(pdf, line, lineX, lineY, elSX, fs, fsMM);
                    }
                });

                if (elSX !== 1 && elSX > 0) pdf.internal.write('100 Tz');

                // ── Rect ───────────────────────────────────────────────────────────
            } else if (el.type === 'rect') {
                let fill = el.fill;
                const isStrip = elName.includes('strip') || elName.includes('color') ||
                    ((el.width || 0) > 80 && (el.height || 0) < 50);
                if (isProduction && isStrip) { pdf.restoreGraphicsState(); continue; }
                if (isStrip) {
                    const mp = mapping[el.id];
                    if (mp && data[mp] !== undefined) {
                        const mc = resolveStripColor(String(data[mp]).trim());
                        if (mc) fill = mc;
                    } else {
                        const sc = Object.keys(data).find(c => {
                            const n = c.toLowerCase().replace(/[\s_-]/g, '');
                            return n.includes('stripcolor') || n === 'strip';
                        });
                        if (sc && data[sc]) { const mc = resolveStripColor(String(data[sc]).trim()); if (mc) fill = mc; }
                    }
                }
                // Only apply sizeHighlightRectIds for normal/livsmart, NOT azortee
                // Removed sizeHighlightRectIds check to prevent black tinting
                const isLabelBorder = Math.abs(ew - mmW) < 3 && Math.abs(eh - mmH) < 3;
                const r = el.cornerRadius ? Math.max(0, el.cornerRadius * unitScale * cs) : isLabelBorder ? tagR : 0;
                if (fill && fill !== 'transparent') {
                    pdf.setFillColor(fill);
                    r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'F') : pdf.rect(ex, ey, ew, eh, 'F');
                }
                if (el.stroke && el.stroke !== 'transparent' && (el.strokeWidth || 0) > 0 && !isLabelBorder) {
                    pdf.setDrawColor(el.stroke);
                    pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                    r > 0 ? pdf.roundedRect(ex, ey, ew, eh, r, r, 'D') : pdf.rect(ex, ey, ew, eh, 'D');
                }

                // ── Image ──────────────────────────────────────────────────────────
            } else if (el.type === 'image') {
                const src = el.image || el.src || el.url;
                if (src) {
                    try {
                        const iw = isProduction ? ew : Math.min(ew, 6);
                        const ih = isProduction ? eh : Math.min(eh, 6);
                        const ix = ex + (ew - iw) / 2, iy = ey + (eh - ih) / 2;
                        pdf.addImage(src, 'PNG', ix, iy, iw, ih);
                    } catch { }
                }

                // ── Line ───────────────────────────────────────────────────────────
            } else if (el.type === 'line') {
                const pts = el.points || [0, 0, 100, 0];
                pdf.setDrawColor(el.stroke || '#000000');
                pdf.setLineWidth(Math.max(0.05, (el.strokeWidth || 1) * unitScale * cs));
                pdf.line(ex + pts[0] * unitScale * cs, ey + pts[1] * unitScale * cs, ex + pts[2] * unitScale * cs, ey + pts[3] * unitScale * cs);

                // ── Circle (non-size-indicator) ─────────────────────────────────────
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

    // ── Branding header for proof sheet ──
    const drawBrandingHeader = (pdf, pageNum, totalPages, PAGE_W, labelW, labelH, startY, brandImg, logoImg_) => {
        pdf.saveGraphicsState();

        // Front logo — only rendered if brandImg is provided (page 1 only)
        if (brandImg) {
            try {
                pdf.addImage(brandImg, 'PNG', 3, startY, labelW, labelH, 'FRONT_LOGO', 'FAST');
            } catch { }
        }

        const HEADER_TEXT_Y = startY / 2 + 1.5;

        if (logoImg_) {
            try {
                const aspect = logoImg_.height / logoImg_.width;
                const imgH = 14;
                const imgW = imgH / aspect;
                pdf.addImage(logoImg_, 'PNG', 3, HEADER_TEXT_Y - imgH / 2, imgW, imgH, 'HEADER_LOGO', 'FAST');
            } catch { }
        }

        const dateStr = new Intl.DateTimeFormat('en-IN').format(new Date());
        const rightText = `ARTWORK APPROVAL SHEET   |   Page ${pageNum} of ${totalPages}   |   Date: ${dateStr}`;
        pdf.setFontSize(9);
        pdf.setFont('Arial', 'bold');
        pdf.setTextColor('#000080');
        pdf.text(rightText, PAGE_W - 5, HEADER_TEXT_Y + 1.5, { align: 'right' });

        pdf.setDrawColor('#e2e8f0');
        pdf.setLineWidth(0.4);
        pdf.line(3, startY - 2, PAGE_W - 3, startY - 2);

        pdf.restoreGraphicsState();
    };

    // ── Proof sheet PDF ──
    const buildProofPdf = async (PAGE_W = 297, PAGE_H = 210, groupByStrip = false) => {
        const pdf = new jsPDF({
            orientation: PAGE_W > PAGE_H ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [PAGE_W, PAGE_H]
        });

        const unit = selectedTemplate.canvasUnit || 'px';
        const dW = selectedTemplate.canvasWidth || selectedTemplate.width || 166;
        const dH = selectedTemplate.canvasHeight || selectedTemplate.height || 387;
        const origW = unit === 'mm' ? dW : dW * PX_TO_MM;
        const origH = unit === 'mm' ? dH : dH * PX_TO_MM;

        const MARGIN = 3;
        const HEADER_H = 22;
        const hGap = 2, vGap = 3;
        const COLS = 6;
        const ROWS = 2;
        const SLOTS_PER_PAGE = COLS * ROWS; // 12

        const usableW = PAGE_W - MARGIN * 2;
        const usableH = PAGE_H - MARGIN * 2 - HEADER_H;

        const masterScale = Math.min(
            (usableW - (COLS - 1) * hGap) / (COLS * origW),
            (usableH - (ROWS - 1) * vGap) / (ROWS * origH)
        );
        const labelW = origW * masterScale;
        const labelH = origH * masterScale;
        const startY = MARGIN + HEADER_H;

        // ── Build color groups from expandedData using blank row boundaries ──────
        let colorGroups = [];

        if (groupByStrip) {
            let currentGroup = [];
            for (const r of expandedData) {
                if (r.__blank) {
                    if (currentGroup.length > 0) {
                        colorGroups.push([...currentGroup]);
                        currentGroup = [];
                    }
                } else {
                    currentGroup.push(r);
                }
            }
            if (currentGroup.length > 0) colorGroups.push(currentGroup);
        } else {
            colorGroups = [expandedData.filter(r => !r.__blank)];
        }

        // ── Count total pages ────────────────────────────────────────────────────
        // When groupByStrip=true:
        //   - First group, first page: 11 data slots (logo takes 1)
        //   - First group, overflow pages: 12 slots each
        //   - Every other group: each color gets its OWN page(s), never shared
        // When groupByStrip=false: same packing, no color isolation
        let totalPages = 0;
        colorGroups.forEach((group, gi) => {
            if (groupByStrip) {
                // Each color group always starts fresh — count pages needed for this group
                const firstPageSlots = gi === 0 ? SLOTS_PER_PAGE - 1 : SLOTS_PER_PAGE;
                if (group.length <= firstPageSlots) {
                    totalPages += 1;
                } else {
                    const overflow = group.length - firstPageSlots;
                    totalPages += 1 + Math.ceil(overflow / SLOTS_PER_PAGE);
                }
            } else {
                // No isolation — count across all groups as one stream
                if (gi === 0) {
                    const firstPageSlots = SLOTS_PER_PAGE - 1;
                    if (group.length <= firstPageSlots) totalPages += 1;
                    else totalPages += 1 + Math.ceil((group.length - firstPageSlots) / SLOTS_PER_PAGE);
                } else {
                    totalPages += Math.ceil(group.length / SLOTS_PER_PAGE);
                }
            }
        });

        let pageNum = 0;
        let isVeryFirstPage = true;

        // Helper: render one page of labels
        const renderPage = async (rowsForThisPage, hasLogoSlot, colorLabel) => {
            pageNum++;
            if (pageNum > 1) pdf.addPage([PAGE_W, PAGE_H], PAGE_W > PAGE_H ? 'landscape' : 'portrait');

            drawBrandingHeader(
                pdf, pageNum, totalPages, PAGE_W, labelW, labelH, startY,
                hasLogoSlot ? (brandingImg || logoImg) : null,
                logoImg
            );



            // Draw each label in its slot
            for (let i = 0; i < rowsForThisPage.length; i++) {
                let finalCol, finalRow;
                if (hasLogoSlot) {
                    // Logo at (row=0, col=0); data slots:
                    // i=0..4  → row 0, cols 1-5
                    // i=5..10 → row 1, cols 0-5
                    if (i < COLS - 1) {
                        finalCol = i + 1;
                        finalRow = 0;
                    } else {
                        const offset = i - (COLS - 1);
                        finalCol = offset % COLS;
                        finalRow = 1 + Math.floor(offset / COLS);
                    }
                } else {
                    finalCol = i % COLS;
                    finalRow = Math.floor(i / COLS);
                }

                const x = MARGIN + finalCol * (labelW + hGap);
                const y = startY + finalRow * (labelH + vGap);

                await drawVectorLabel(
                    pdf, selectedTemplate.elements, rowsForThisPage[i],
                    manualMapping, x, y, labelW, labelH, false, false
                );
            }
            // NOTE: remaining slots on this page are intentionally left blank
        };

        for (let gi = 0; gi < colorGroups.length; gi++) {
            const group = colorGroups[gi];

            // Detect color label from first row of this group
            const stripCol = Object.keys(group[0] || {}).find(k => {
                const n = k.toLowerCase().replace(/[\s_-]/g, '');
                return n.includes('stripcolor') || n === 'strip' || n === 'color';
            });
            const colorLabel = stripCol ? String(group[0][stripCol] || '').trim() : '';

            if (groupByStrip) {
                // ── GROUPED MODE: each color gets its own page(s), rest stays blank ──
                let remaining = [...group];

                // First page of this group
                const firstPageSlots = isVeryFirstPage ? SLOTS_PER_PAGE - 1 : SLOTS_PER_PAGE;
                const firstBatch = remaining.splice(0, firstPageSlots);
                await renderPage(firstBatch, isVeryFirstPage, colorLabel);
                isVeryFirstPage = false;

                // Overflow pages for same color (rare: >11 or >12 labels of one color)
                while (remaining.length > 0) {
                    const batch = remaining.splice(0, SLOTS_PER_PAGE);
                    await renderPage(batch, false, colorLabel);
                }
                // ← After all pages for this color are done, the NEXT color
                //   always starts on a fresh page (via pageNum++ in renderPage)

            } else {
                // ── NORMAL MODE: pack labels across pages without isolation ──────────
                let remaining = [...group];

                if (gi === 0) {
                    // First group, first page has logo slot
                    const firstBatch = remaining.splice(0, SLOTS_PER_PAGE - 1);
                    await renderPage(firstBatch, true, colorLabel);
                    isVeryFirstPage = false;
                }

                while (remaining.length > 0) {
                    const batch = remaining.splice(0, SLOTS_PER_PAGE);
                    await renderPage(batch, false, colorLabel);
                }
            }
        }

        return pdf;
    };

    const downloadPDF = () => {
        if (!selectedTemplate) return;
        setShowPaperModal(true);
    };

    const handlePaperDownload = async () => {
        setShowPaperModal(false);
        try {
            toast.loading('Generating Proof Sheet…', { id: 'pdf' });
            const pdf = await buildProofPdf(paperSize.width, paperSize.height, groupByStrip); // ← pass groupByStrip
            pdf.save(`Proof_Sheet_${Date.now()}.pdf`);
            toast.success('Downloaded!', { id: 'pdf' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to generate PDF', { id: 'pdf' });
        }
    };

    const saveProofSheet = async () => {
        if (!selectedTemplate) return toast.error('Please select a design template first');
        if (!expandedData.filter(r => !r.__blank).length) return toast.error('No label data to save');
        
        try {
            const res = await filesAPI.getFolders();
            setExistingFolders(res.data || []);
            setIsCreatingNewFolder(false);
            if (res.data && res.data.length > 0) {
                setSaveInputs(prev => ({ ...prev, folder: res.data[0] }));
            }
        } catch (err) {
            console.error('Failed to fetch folders', err);
        }
        
        setShowSaveModal(true);
    };

    const handleSaveSubmit = async () => {
        const { folder, filename } = saveInputs;
        if (!filename) return toast.error('Please enter a filename');
        const finalFileName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        setShowSaveModal(false);
        try {
            toast.loading('Saving…', { id: 'save_pdf' });
            const pdf = await buildProofPdf();
            const blob = pdf.output('blob');
            const formData = new FormData();
            formData.append('file', blob, finalFileName);
            if (folder.trim()) formData.append('folder', folder.trim());
            await filesAPI.upload(formData);
            toast.success('Saved!', { id: 'save_pdf' });
        } catch (err) { toast.error(`Save failed: ${err.message}`, { id: 'save_pdf' }); }
    };

    // ── Preview canvas layout ──
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
    const previewRows = expandedData.filter(r => !r.__blank).slice(0, 60);

    let tempCol = 1, tempRow = 0;
    previewRows.forEach(() => { if (tempCol >= colsCount) { tempRow++; tempCol = 0; } tempCol++; });
    if (tempCol >= colsCount) tempRow++;
    const requiredRows = Math.max(1, tempRow + 1);

    const sheetW = (itemW + spacing) * colsCount + marginSide * 2;
    const sheetH = (itemH + spacing) * requiredRows + 160;
    const currentLabelType = getLabelType(selectedTemplate);
    const totalExpandedCount = expandedData.filter(r => !r.__blank).length;

    // Corel palette for strip manager
    const corelPalette = [
        { name: 'P Yellow 10', hex: '#FFFBE6' }, { name: 'Process Yellow', hex: '#FFED00' },
        { name: 'Golden Yellow', hex: '#FFCC00' }, { name: 'Orange Yellow', hex: '#FFB300' },
        { name: 'Process Orange', hex: '#F7941E' }, { name: 'Light Red', hex: '#F15A29' },
        { name: 'Press Red', hex: '#ED1C24' }, { name: 'Maroon', hex: '#800000' },
        { name: 'Process Magenta', hex: '#EC008C' }, { name: 'Purple', hex: '#92278F' },
        { name: 'Process Cyan', hex: '#00AEEF' }, { name: 'Royal Blue', hex: '#2E3192' },
        { name: 'Navy Blue', hex: '#000080' }, { name: 'Teal', hex: '#00A99D' },
        { name: 'Press Green', hex: '#00A651' }, { name: 'Forest Green', hex: '#006837' },
        { name: 'White', hex: '#FFFFFF' }, { name: 'Process Black', hex: '#000000' },
    ];

    const [showPaperModal, setShowPaperModal] = useState(false);
    const [paperSize, setPaperSize] = useState({ width: 297, height: 210 });
    const [groupByStrip, setGroupByStrip] = useState(false);

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>

            {/* Generate Modal */}
            {showGenerateModal && (
                <DownloadModal
                    onClose={() => setShowGenerateModal(false)}
                    selectedTemplate={selectedTemplate}
                    manualMapping={manualMapping}
                    drawVectorLabel={drawVectorLabel}
                    templates={templates}
                    onSelectTemplate={handleSelectTemplate}
                />
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000 }}>
                    <div className="save-modal-card">
                        <div className="save-modal-header">
                            <h2>Save Proof Sheet</h2>
                            <p>Organize and store your design on the server</p>
                            <button className="save-modal-close" onClick={() => setShowSaveModal(false)}><X size={18} /></button>
                        </div>
                        <div className="save-modal-body">
                            <div className="save-input-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label className="save-input-label" style={{ margin: 0 }}><FolderOpen size={13} /> Folder Name</label>
                                    <button 
                                        onClick={() => {
                                            setIsCreatingNewFolder(!isCreatingNewFolder);
                                            setSaveInputs(prev => ({ ...prev, folder: '' }));
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                    >
                                        {isCreatingNewFolder ? 'Choose Existing' : '+ Create New'}
                                    </button>
                                </div>
                                <div className="save-input-wrapper">
                                    <FolderOpen size={16} className="save-input-icon" />
                                    {isCreatingNewFolder || existingFolders.length === 0 ? (
                                        <input className="save-input-field" placeholder="New folder name..."
                                            value={saveInputs.folder}
                                            onChange={e => setSaveInputs({ ...saveInputs, folder: e.target.value })}
                                            autoFocus />
                                    ) : (
                                        <select className="save-input-field" style={{ appearance: 'none', background: 'transparent' }}
                                            value={saveInputs.folder}
                                            onChange={e => setSaveInputs({ ...saveInputs, folder: e.target.value })}>
                                            <option value="">— Root Directory —</option>
                                            {existingFolders.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div className="save-input-group" style={{ marginBottom: 28 }}>
                                <label className="save-input-label"><FileText size={13} /> File Name</label>
                                <div className="save-input-wrapper">
                                    <FileText size={16} className="save-input-icon" />
                                    <input className="save-input-field" placeholder="Proof_Sheet"
                                        value={saveInputs.filename}
                                        onChange={e => setSaveInputs({ ...saveInputs, filename: e.target.value })} />
                                </div>
                            </div>
                            <div className="save-modal-footer">
                                <button className="save-btn-cancel" onClick={() => setShowSaveModal(false)}>Cancel</button>
                                <button className="save-btn-confirm" onClick={handleSaveSubmit}><Save size={16} /> Save File</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPaperModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)',
                    backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 99999
                }}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: '32px 36px',
                        width: 400, boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 10, padding: 8, color: 'white' }}>
                                <FileText size={20} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Paper Size</h2>
                                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Set custom sheet dimensions in mm</p>
                            </div>
                        </div>

                        {/* Preset buttons */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                            {[
                                { label: 'A4 Landscape', w: 297, h: 210 },
                                { label: 'A4 Portrait', w: 210, h: 297 },
                                { label: 'A3 Landscape', w: 420, h: 297 },
                                { label: 'Letter', w: 279, h: 216 },
                            ].map(p => (
                                <button key={p.label}
                                    onClick={() => setPaperSize({ width: p.w, height: p.h })}
                                    style={{
                                        padding: '5px 12px', fontSize: 12, fontWeight: 700,
                                        border: `2px solid ${paperSize.width === p.w && paperSize.height === p.h ? '#6366f1' : '#e2e8f0'}`,
                                        borderRadius: 8, cursor: 'pointer',
                                        background: paperSize.width === p.w && paperSize.height === p.h ? '#eef2ff' : 'white',
                                        color: paperSize.width === p.w && paperSize.height === p.h ? '#4f46e5' : '#475569',
                                    }}>
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Width (mm)</label>
                                <input
                                    type="number" min="50" max="1200"
                                    value={paperSize.width}
                                    onChange={e => setPaperSize(p => ({ ...p, width: Number(e.target.value) }))}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 700, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Height (mm)</label>
                                <input
                                    type="number" min="50" max="1200"
                                    value={paperSize.height}
                                    onChange={e => setPaperSize(p => ({ ...p, height: Number(e.target.value) }))}
                                    style={{ width: '100%', padding: '10px 12px', fontSize: 15, fontWeight: 700, border: '2px solid #e2e8f0', borderRadius: 10, outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: 20, padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={groupByStrip}
                                    onChange={e => setGroupByStrip(e.target.checked)}
                                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                                />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>Group by Strip Color</div>
                                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Each color variation starts on a new page</div>
                                </div>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button onClick={() => setShowPaperModal(false)}
                                style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', color: '#64748b' }}>
                                Cancel
                            </button>
                            <button onClick={handlePaperDownload}
                                style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Download size={15} /> Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Sidebar />

            <main className="db-main">
                {/* Header */}
                <div className="layout-header-simple">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button className="lh-btn lh-btn-ghost" style={{ padding: '6px 10px' }} onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={15} />
                        </button>
                        <h1>Artwork Page</h1>
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

                    <div className="lh-actions">
                        {epcStats && (
                            <div className={`lh-badge ${epcStats.unmatched === 0 ? 'success' : 'warn'}`}>
                                {epcStats.unmatched === 0 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                                {epcStats.matched}/{epcStats.total} EPC
                                {epcStats.unmatched > 0 && ` · ${epcStats.unmatched} missing`}
                            </div>
                        )}
                        {totalExpandedCount > 0 && (
                            <div className="lh-badge neutral">{totalExpandedCount} labels</div>
                        )}
                        <button className="lh-btn lh-btn-secondary" onClick={() => setShowGenerateModal(true)}>
                            <Download size={13} /> Generate Labels
                        </button>
                        {excelData.length > 0 && (
                            <>
                                <button className="lh-btn lh-btn-ghost" onClick={() => setShowExplorer(!showExplorer)}>
                                    <Search size={13} /> {showExplorer ? 'Hide' : 'Inspect'}
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

                <div className="layout-content-grid">
                    {/* Toolbar */}
                    <div className="layout-toolbar-horizontal">

                        {/* 1. Design */}
                        <div className="toolbar-section">
                            <div className="section-label-mini">1 · Design</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <select className="ts-select"
                                    value={selectedTemplate?._id || selectedTemplate?.id || ''}
                                    onChange={e => handleSelectTemplate(e.target.value)}>
                                    <option value="">— Choose Design —</option>
                                    {templates.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.title}</option>)}
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
                                <Wand2 size={13} /> {brandingImg ? 'Logo ✓' : 'Add Front Logo'}
                            </button>
                            <input type="file" id="branding-upload" hidden accept="image/*" onChange={handleBrandingLogoUpload} />
                        </div>

                        <div className="toolbar-divider" />

                        {/* 3. Colors */}
                        <div className="toolbar-section" style={{ position: 'relative' }}>
                            <div className="section-label-mini">3 · Palette</div>
                            <button className="ts-btn" onClick={() => setShowStripManager(!showStripManager)}>
                                <Palette size={13} /> Colors
                            </button>
                            {showStripManager && (
                                <div className="strip-popup">
                                    <div className="strip-popup-header">
                                        <span>CMYK Color Palette</span>
                                        <button onClick={() => setShowStripManager(false)} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 'bold' }}>×</button>
                                    </div>
                                    <div style={{ display: 'flex', minHeight: '400px' }}>
                                        <div style={{ flex: '1.2', padding: '12px', borderRight: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: '1px', background: '#cbd5e1', border: '1px solid #cbd5e1', marginBottom: '14px', maxHeight: '120px', overflowY: 'auto', borderRadius: 4 }}>
                                                {corelPalette.map(cp => (
                                                    <div key={cp.name} style={{ background: cp.hex, height: '18px', cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)' }}
                                                        title={cp.name} onClick={() => setCmykInput(p => ({ ...p, name: cp.name }))} />
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {[
                                                    { label: 'C', key: 'c', gradient: 'linear-gradient(to right,#fff,#00FFFF)' },
                                                    { label: 'M', key: 'm', gradient: 'linear-gradient(to right,#fff,#FF00FF)' },
                                                    { label: 'Y', key: 'y', gradient: 'linear-gradient(to right,#fff,#FFFF00)' },
                                                    { label: 'K', key: 'k', gradient: 'linear-gradient(to right,#fff,#000)' },
                                                ].map(s => (
                                                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', fontWeight: 'bold', width: '12px', color: '#334155' }}>{s.label}</span>
                                                        <div style={{ flex: '1', height: '10px', border: '1px solid #cbd5e1', borderRadius: 3, position: 'relative', background: s.gradient }}>
                                                            <div style={{ position: 'absolute', top: '-2px', bottom: '-2px', width: '4px', background: 'white', border: '1px solid #475569', borderRadius: 2, left: `${cmykInput[s.key]}%`, transform: 'translateX(-50%)', pointerEvents: 'none' }} />
                                                            <input type="range" style={{ position: 'absolute', inset: '0', opacity: '0', cursor: 'pointer', width: '100%' }}
                                                                min="0" max="100" value={cmykInput[s.key]}
                                                                onChange={e => setCmykInput(p => ({ ...p, [s.key]: Number(e.target.value) }))} />
                                                        </div>
                                                        <input type="number" min="0" max="100"
                                                            style={{ width: '35px', fontSize: '10px', border: '1px solid #cbd5e1', borderRadius: 4, textAlign: 'center', padding: '2px' }}
                                                            value={cmykInput[s.key]}
                                                            onChange={e => setCmykInput(p => ({ ...p, [s.key]: Math.min(100, Math.max(0, Number(e.target.value))) }))} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                                                <input type="text" placeholder="Color Name"
                                                    style={{ width: '100%', fontSize: '11px', border: '1.5px solid #e2e8f0', borderRadius: 6, padding: '5px 8px', marginBottom: '6px', boxSizing: 'border-box' }}
                                                    value={cmykInput.name}
                                                    onChange={e => setCmykInput(p => ({ ...p, name: e.target.value }))} />
                                                <button style={{ width: '100%', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: 'white', fontSize: '11px', padding: '7px', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' }}
                                                    onClick={handleAddCMYKColor}>ADD TO PALETTE</button>
                                            </div>
                                        </div>
                                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                                            <div style={{ background: '#f1f5f9', padding: '8px 12px', fontSize: '10px', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Strip Colors</div>
                                            <div style={{ flex: '1', overflowY: 'auto', padding: '6px' }}>
                                                {stripColors.length === 0 ? (
                                                    <div style={{ padding: '24px', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No colors yet</div>
                                                ) : stripColors.map(sc => (
                                                    <div key={sc._id}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', border: '1px solid #e2e8f0', background: 'white', marginBottom: '4px', cursor: 'pointer', borderRadius: '6px' }}
                                                        onClick={() => { if (sc.cmyk) { const [c, m, y, k] = sc.cmyk.split(',').map(Number); setCmykInput({ name: sc.name, c, m, y, k }); } }}>
                                                        <div style={{ width: '14px', height: '14px', border: '1px solid #cbd5e1', borderRadius: 3, background: sc.hex, flexShrink: 0 }} />
                                                        <div style={{ flex: '1', fontSize: '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>{sc.name}</div>
                                                        <div style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{sc.cmyk || sc.hex}</div>
                                                        <button onClick={e => handleDeleteColor(e, sc._id)}
                                                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px', color: '#94a3b8' }}>
                                                            <Trash2 size={11} />
                                                        </button>
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

                        {/* 6. Field Mapping — only text/barcode/rect fields; QR is always EPC */}
                        {selectedTemplate && excelData.length > 0 && templateFields.length > 0 && (
                            <div className="mapping-section">
                                <div className="section-label-mini">6 · Field Mapping</div>
                                <div className="mapping-row-toolbar">
                                    {templateFields.map(field => {
                                        // A field is an EPC field if it's type qrcode OR it's a barcode named/formatted as QR
                                        const isEpcField = field.type === 'qrcode' || (field.label || '').toUpperCase().includes('EPC');
                                        return (
                                            <div key={field.id} className={`mapping-item-compact ${isEpcField ? 'is-epc' : ''}`}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                    <label title={field.label}>
                                                        {field.label?.length > 12 ? field.label.slice(0, 12) + '…' : field.label}
                                                    </label>
                                                    {isEpcField && <span className="mapping-mode-static">QR / EPC</span>}
                                                </div>
                                                {isEpcField ? (
                                                    /* QR always maps to EPC — only allow EPC or Empty */
                                                    <select className="mapping-select-toolbar"
                                                        value={manualMapping[field.id] || '__epc'}
                                                        onChange={e => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}>
                                                        <option value="__epc">{'{{EPC}}'}</option>
                                                        <option value="__empty">Empty</option>
                                                    </select>
                                                ) : (
                                                    <select className="mapping-select-toolbar"
                                                        value={manualMapping[field.id] || ''}
                                                        onChange={e => setManualMapping(prev => ({ ...prev, [field.id]: e.target.value }))}>
                                                        <option value="">Auto</option>
                                                        {columns.map(col => <option key={col} value={col}>{col}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview Canvas */}
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
                                                    <div key={col} title={col}
                                                        className={`header-chip-mini ${Object.values(manualMapping).includes(col) ? 'mapped' : ''}`}>
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
                                                {logoImg && <KImage image={logoImg} width={200} height={55} />}
                                                <Rect y={55} width={sheetW - marginSide * 2} height={1} fill="#e2e8f0" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={65} fontSize={10} fontFamily="Arial" fill="#94a3b8" letterSpacing={2} />
                                            </Group>
                                            <Group x={marginSide} y={110}>
                                                {/* Branding label */}
                                                <Group x={0} y={0}>
                                                    <LayoutLabel width={itemW} height={itemH} isBranding logoImg={brandingImg || logoImg} />
                                                </Group>
                                                {/* Data labels */}
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
                                                                    width={itemW} height={itemH}
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
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}