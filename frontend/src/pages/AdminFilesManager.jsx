import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Download, Trash2, File as FileIcon, Search, Eye, X, Tag, Upload, CheckCircle, AlertTriangle, Loader, FolderOpen, ArrowLeft, Folder, Home, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { filesAPI, designsAPI, BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';
import './AdminFilesManager.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 200; // labels per PDF file — tune up/down based on perf
const PAGE_W_PT = 595.28; // A4 landscape width in points (210mm)
const PAGE_H_PT = 419.53; // A4 landscape height in points (148mm)
const PX_TO_MM = 0.264583;

// ─── Yield helper — lets browser breathe between chunks ───────────────────────
const yieldFrame = () => new Promise(r => setTimeout(r, 0));


// ─── Font & Image Caches ──────────────────────────────────────────────────────
const _fontCache = {};
const rupeeImageCache = {};

const getLabelType = (design) => {
    const title = (design?.title || '').toLowerCase();
    if (title.includes('azortee')) return 'azortee';
    if (title.includes('livsmart')) return 'livsmart';
    if (title.includes('reliance')) return 'reliance';
    return 'generic';
};

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

const resolvePdfFont = (fontFamily = '') => {
    const ff = fontFamily.toLowerCase();
    if (ff.includes('calibri')) return 'Calibri';
    if (ff.includes('ocr')) return 'OCR-BT';
    if (ff.includes('rupee') || ff.includes('forbidan')) return 'RupeeForbidan';
    if (ff.includes('times')) return 'times';
    if (ff.includes('courier')) return 'courier';
    return 'Arial';
};

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

const drawRupeeText = (pdf, rawText, x, y, scaleX = 1) => {
    if (!rawText) return;
    const text = String(rawText);
    if (!text.includes('₹')) { pdf.text(text, x, y, {}); return; }
    const fs = pdf.getFontSize();
    const fsMM = fs * 0.352778;
    const PX_TO_MM = 0.264583;
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

const resolveDynamicText = (templateText, data) => {
    let t = templateText || '';
    let hadPh = false;

    if (data.__epc) {
        const old = t;
        t = t.replaceAll('{{EPC}}', String(data.__epc).trim());
        t = t.replaceAll('{{EPC_CODE}}', String(data.__epc).trim());
        if (t !== old) hadPh = true;
    }

    if (data.__labelIndex !== undefined) {
        const seqStr = String(data.__labelIndex).padStart(5, '0');
        const old = t;
        t = t.replaceAll('{{SEQ}}', seqStr);
        if (t !== old) hadPh = true;

        if (t === old && /SG\s*\d+/i.test(t)) {
            t = t.replace(/(SG\s*)(\d+)/i, (match, prefix, num) => {
                hadPh = true;
                return prefix + String(data.__labelIndex).padStart(num.length, '0');
            });
        }
    }

    Object.keys(data).forEach(col => {
        if (col.startsWith('__')) return;
        const ph = `{{${col}}}`;
        if (t.includes(ph)) {
            hadPh = true;
            const raw = String(data[col] ?? '').replace(/^[₹\s]+/, '').trim();
            t = t.replaceAll(ph, isPriceColumn(col) ? formatPrice(raw) : raw);
        }
    });

    while (/₹\s*₹/.test(t)) t = t.replace(/₹\s*₹/g, '₹');

    return { text: formatNetQty(t), hadPh };
};

function resolveQRValue(el, data, mapping, forcedMode = null) {
    const elName = (el.fieldName || el.name || el.text || el.qrValue || '').toLowerCase();
    const mp = mapping[el.id];

    if (mp === '__empty') return ' ';
    if (data.__qr && String(data.__qr).trim()) return String(data.__qr).trim();
    if (data.__epc && String(data.__epc).trim()) return String(data.__epc).trim();
    if ('__ean' in data) return '';
    if (mp === '__epc') return data.__epc || '';
    if (mp && data[mp] !== undefined) return String(data[mp]).trim();
    return '';
}

const resolveTextValue = (el, data, mapping) => {
    const mapped = mapping[el.id];
    const isPlaceholder = el.type === 'placeholder' || (el.text && el.text.includes('{{'));
    const isBarcodeQR = el.type === 'barcode' || el.type === 'qrcode';
    const isRect = el.type === 'rect';

    if (mapped && data[mapped] !== undefined && (isPlaceholder || isBarcodeQR || isRect)) {
        const raw = String(data[mapped] ?? '').replace(/^[₹\s]+/, '').trim();
        return formatNetQty(isPriceColumn(mapped) ? formatPrice(raw) : raw);
    }

    const { text, hadPh } = resolveDynamicText(el.text, data);

    if (!hadPh && el.fieldName && (isBarcodeQR || isRect || el.type === 'placeholder')) {
        const ac = Object.keys(data).find(col => col.toLowerCase() === el.fieldName.toLowerCase());
        if (ac && data[ac] !== undefined) return String(data[ac] ?? '').replace(/^[₹\s]+/, '').trim();
    }

    return text;
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

const drawVectorLabel = async (pdf, design, data, mapping, mmX, mmY, mmW, mmH, isBranding = false, isProduction = false, modes = {}) => {
    await loadCustomFonts(pdf);
    const elements = design?.elements || [];
    const labelType = getLabelType(design);
    const unit = design?.canvasUnit || 'px';
    const rawW = design?.canvasWidth || design?.width || 166;
    const rawH = design?.canvasHeight || design?.height || 387;
    const dWmm = unit === 'mm' ? rawW : rawW * PX_TO_MM;
    const dHmm = unit === 'mm' ? rawH : rawH * PX_TO_MM;
    const cs = Math.min(mmW / dWmm, mmH / dHmm);
    const offX = mmX + (mmW - dWmm * cs) / 2, offY = mmY + (mmH - dHmm * cs) / 2;
    const canvasRadius = design?.canvasRadius || 10;
    const tagR = isProduction ? 0 : Math.min(4, canvasRadius * PX_TO_MM * cs);

    pdf.setFillColor('#ffffff');
    tagR > 0 ? pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F') : pdf.rect(mmX, mmY, mmW, mmH, 'F');

    if (isBranding) {
        pdf.setFillColor('#000000');
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'F');
        pdf.setDrawColor('#ffffff');
        pdf.setLineWidth(0.4);
        pdf.roundedRect(mmX, mmY, mmW, mmH, tagR, tagR, 'D');
        // No branding logo for now in this context
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

    const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    for (const el of sorted) {
        if (el.visible === false) continue;
        pdf.saveGraphicsState();
        const elSX = el.scaleX || 1, elSY = el.scaleY || 1;
        const unitScale = unit === 'mm' ? 1 : PX_TO_MM;
        let ex = offX + (el.x || 0) * unitScale * cs;
        let ey = offY + (el.y || 0) * unitScale * cs;
        const ew = (el.width || 0) * unitScale * cs * elSX;
        const eh = (el.height || 0) * unitScale * cs * elSY;

        const forcedMode = modes[el.id];

        if (el.type === 'qrcode' || forcedMode === 'qrcode') {
            let qv = resolveQRValue(el, data, mapping, forcedMode);
            if (qv && String(qv).trim()) {
                const qsz = Math.min(ew, eh);
                const qx = ex + (ew - qsz) / 2, qy = ey + (eh - qsz) / 2;
                await renderQRAtPos(pdf, String(qv).trim(), qx, qy, qsz);
            }
            pdf.restoreGraphicsState(); continue;
        }

        if (el.type === 'barcode' || forcedMode === 'ean13' || forcedMode === 'barcode') {
            let bv = data.__ean || el.barcodeValue || '123456789';
            const mp = mapping[el.id];
            if (mp && data[mp] !== undefined) bv = String(data[mp]);
            const format = forcedMode === 'ean13' ? 'EAN13' : (el.barcodeFormat || 'CODE128').toUpperCase();
            let bw = ew, bh = eh, bx = ex, by = ey;
            if (isProduction && format === 'EAN13') {
                bw = 26.2; bh = 10.4; bx = ex + (ew - bw) / 2; by = ey + (eh - bh) / 2;
            }
            await drawVectorBarcode(pdf, bv, bx, by, bw, bh, format, el.fill, isProduction);
            pdf.restoreGraphicsState(); continue;
        }

        if (el.type === 'text' || el.type === 'placeholder') {
            let val = resolveTextValue(el, data, mapping);
            if (!val || val === 'Text') { pdf.restoreGraphicsState(); continue; }
            const fs = Math.max(2, (el.fontSize || 12) * 0.75 * elSY * cs);
            pdf.setFontSize(fs);
            pdf.setFont(resolvePdfFont(el.fontFamily), el.fontStyle || 'normal');
            pdf.setTextColor(el.fill || '#000000');
            drawRupeeText(pdf, val, ex, ey + (fs * 0.352778) * 0.85);
            pdf.restoreGraphicsState(); continue;
        }

        if (el.type === 'rect') {
            pdf.setFillColor(el.fill || '#000000');
            pdf.rect(ex, ey, ew, eh, 'F');
            pdf.restoreGraphicsState(); continue;
        }

        if (el.type === 'circle') {
            const rx = (el.radius || 10) * unitScale * cs * elSX;
            const ry = (el.radius || 10) * unitScale * cs * elSY;
            if (labelType === 'azortee') {
                if (azorteeVisibleCircles.has(el.id)) {
                    pdf.setDrawColor(el.stroke || el.fill || '#000000');
                    pdf.setLineWidth(0.2);
                    pdf.ellipse(ex, ey, rx, ry, 'D');
                }
            } else {
                pdf.setFillColor(el.fill || '#000000');
                pdf.ellipse(ex, ey, rx, ry, 'F');
            }
            pdf.restoreGraphicsState(); continue;
        }

        pdf.restoreGraphicsState();
    }
    pdf.restoreGraphicsState();
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

// ─── SGTIN-96 Encoding Logic ──────────────────────────────────────────────────
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

// ─── QR Code rendering helper ──────────────────────────────────────────────────
async function drawQR(page, value, x, y, size, rgb) {
    if (!value) return;
    try {
        const QRCode = await import('qrcode');
        const qrData = QRCode.create(value, { errorCorrectionLevel: 'M' });
        const modules = qrData.modules;
        const moduleCount = modules.size;
        const cellSize = size / moduleCount;

        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (modules.get(row, col)) {
                    page.drawRectangle({
                        x: x + col * cellSize,
                        y: y + (moduleCount - row - 1) * cellSize,
                        width: cellSize,
                        height: cellSize,
                        color: rgb(0, 0, 0),
                    });
                }
            }
        }
    } catch (err) { console.error("QR Error:", err); }
}


// ─── Rupee Symbol rendering helper ──────────────────────────────────────────
function drawRupee(page, x, y, size, rgb, customFont) {
    if (customFont) {
        page.drawText('₹', { x, y: y + (size * 0.05), size: size * 1.1, font: customFont });
        return;
    }
    const w = size * 0.55;
    const h = size * 0.75;
    const thickness = size / 11;
    page.drawLine({ start: { x, y: y + h }, end: { x: x + w, y: y + h }, thickness, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x, y: y + h * 0.65 }, end: { x: x + w * 0.9, y: y + h * 0.65 }, thickness, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x + w * 0.1, y: y + h }, end: { x: x + w * 0.1, y: y + h * 0.5 }, thickness, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x + w * 0.1, y: y + h * 0.5 }, end: { x: x + w * 0.8, y: y }, thickness: thickness * 1.1, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: x + w * 0.8, y: y + h * 0.85 }, end: { x: x + w * 0.8, y: y + h * 0.65 }, thickness, color: rgb(0, 0, 0) });
}

// ─── Barcode rendering helper (Matches Layout page EAN-13 style) ──────────────
async function drawBarcode(page, text, x, y, width, height, rgb, font) {
    const code = String(text).padStart(13, '0').slice(0, 13);
    const JsBarcode = (await import('jsbarcode')).default;
    const barcodeObj = {};
    JsBarcode(barcodeObj, code, { format: 'EAN13', margin: 0, displayValue: false });

    const encodings = barcodeObj.encodings || [];
    if (encodings.length === 0) return;

    let totalUnits = 0;
    encodings.forEach(e => (totalUnits += e.data.length));

    const quietZoneW = width * 0.08;
    const drawW = width - quietZoneW;
    const unitW = drawW / totalUnits;

    let curX = x + quietZoneW;
    encodings.forEach((enc, encIdx) => {
        const data = enc.data;
        const isGuard = (encIdx === 0 || encIdx === 2 || encIdx === 4);
        const barH = isGuard ? height : height * 0.82;
        const barY = y + (isGuard ? 0 : height * 0.18); // Align to top, gap at bottom

        for (let i = 0; i < data.length; i++) {
            if (data[i] === '1') {
                let span = 1;
                while (i + span < data.length && data[i + span] === '1') span++;
                page.drawRectangle({
                    x: curX, y: barY,
                    width: unitW * span,
                    height: barH,
                    color: rgb(0, 0, 0)
                });
                curX += unitW * span;
                i += span - 1;
            } else {
                curX += unitW;
            }
        }
    });

    // Human Readable Text (Below the bars)
    const fs = 10; // Exactly 10 PT as per spec
    const ty = y - 2;
    const p1 = code[0];
    const p2 = code.substring(1, 7);
    const p3 = code.substring(7, 13);

    // Part 1: Left of barcode
    page.drawText(p1, { x: x + 2, y: ty, size: fs, font });
    // Part 2: First group
    const p2W = font.widthOfTextAtSize(p2, fs);
    page.drawText(p2, { x: x + quietZoneW + (unitW * 3) + (unitW * 42 - p2W) / 2, y: ty, size: fs, font });
    // Part 3: Second group
    const p3W = font.widthOfTextAtSize(p3, fs);
    page.drawText(p3, { x: x + quietZoneW + (unitW * 50) + (unitW * 42 - p3W) / 2, y: ty, size: fs, font });
}

// ─── Main Label Builder ────────────────────────────────────────────────────────
async function buildChunk(rows, design, onSubProgress) {
    if (!design) throw new Error('No design template selected');
    
    const unit = design.canvasUnit || 'px';
    const rawW = design.canvasWidth || design.width || 166;
    const rawH = design.canvasHeight || design.height || 387;
    const lW = unit === 'mm' ? rawW : rawW * PX_TO_MM;
    const lH = unit === 'mm' ? rawH : rawH * PX_TO_MM;
    const ori = lW > lH ? 'landscape' : 'portrait';
    
    const pdf = new jsPDF({ orientation: ori, unit: 'mm', format: [lW, lH] });
    
    const manualMapping = {}; 
    design.elements?.forEach(el => {
        if (el.fieldName) manualMapping[el.id] = el.fieldName;
    });
    for (let i = 0; i < rows.length; i++) {
        if (i > 0) pdf.addPage([lW, lH], ori);
        await drawVectorLabel(pdf, design, rows[i], manualMapping, 0, 0, lW, lH, false, true);
        if (i % 10 === 0) {
            onSubProgress && onSubProgress(i / rows.length);
            await yieldFrame();
        }
    }
    return pdf.output('arraybuffer');
}

async function generateAllLabels(rows, design, onProgress, onDone) {
    if (!design) throw new Error('No design template selected');
    const total = rows.length;
    let combinedBytes = null;
    const CHUNK_SIZE = 50; // Smaller chunk size for jsPDF to prevent memory pressure

    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const pdfBytes = await buildChunk(chunk, design, (pct) => {
            const overallPct = Math.round(((i + (pct * chunk.length)) / total) * 100);
            onProgress(overallPct);
        });

        if (i === 0) {
            combinedBytes = pdfBytes;
        } else {
            const { PDFDocument } = await import('pdf-lib');
            const mainDoc = await PDFDocument.load(combinedBytes);
            const chunkDoc = await PDFDocument.load(pdfBytes);
            const copiedPages = await mainDoc.copyPages(chunkDoc, chunkDoc.getPageIndices());
            copiedPages.forEach((page) => mainDoc.addPage(page));
            combinedBytes = await mainDoc.save();
        }
        
        onProgress(Math.round(((i + chunk.length) / total) * 100));
        await yieldFrame();
    }

    onDone(combinedBytes, `Labels_${new Date().getTime()}.pdf`);
}

function parseLabelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
                const rows = json.map(row => {
                    const rawSize = String(row['Size'] || row['size'] || row['SIZE'] || '').trim();
                    const slashIdx = rawSize.indexOf('/');
                    const sizePart = slashIdx >= 0 ? rawSize.slice(0, slashIdx).trim() : rawSize;
                    const sizeNumPart = slashIdx >= 0 ? rawSize.slice(slashIdx + 1).trim() : String(row['Size Num'] || row['Size Number'] || row['Shoe Size'] || row['SIZE NUM'] || '').trim();
                    return {
                        barcode: (() => {
                            const keys = Object.keys(row);
                            const bk = keys.find(k => {
                                const l = k.toLowerCase().replace(/[\s_-]/g, '');
                                return l === 'ean' || l === 'ean13' || l === 'barcode' ||
                                    l === 'eancode' || l === 'gtin' || l.includes('ean') || l.includes('barcode');
                            });
                            return bk ? String(row[bk] || '').trim() : '';
                        })(),
                        qty: parseInt(getCol(row, 'Final qty', 'Final Qty', 'FINAL QTY', 'qty', 'Qty', 'Quantity') || 0),
                        mrp: String(row['MRP'] || row['mrp'] || row['Price'] || row['PRICE'] || row['MRP Incl Taxes'] || '').trim(),
                        size: sizePart, sizeNum: sizeNumPart,
                        brand: String(row['Brand'] || row['brand'] || row['Category'] || row['BRAND'] || '').trim(),
                        art: String(row['Art'] || row['ART'] || row['Art No'] || row['ART NO'] || '').trim(),
                        mfd: String(row['MFD'] || row['Mfd On'] || row['mfd'] || row['MFD ON'] || '').trim(),
                        color: String(row['Color'] || row['color'] || row['COLOR'] || '').trim(),
                        style: String(row['Style'] || row['style'] || row['STYLE'] || '').trim(),
                        netQty: String(row['Net Qty'] || row['qty'] || row['NET QTY'] || '1 NUMBER').trim(),
                    };
                }).filter(r => r.barcode && r.qty > 0);
                resolve(rows);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject; reader.readAsBinaryString(file);
    });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Returns value from a row using case-insensitive key matching */
const getCol = (row, ...names) => {
    const keys = Object.keys(row);
    for (const name of names) {
        const lower = name.toLowerCase().replace(/[\s_-]/g, '');
        const key = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '') === lower);
        if (key !== undefined && row[key] !== undefined && String(row[key]).trim() !== '') {
            return String(row[key]).trim();
        }
    }
    return '';
};
/** Normalise barcode to digits-only for fuzzy matching */
const normBC = (v) => String(v || '').replace(/\D/g, '');


function parseEPCFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
                const map = {};

                const addEntry = (key, entry) => {
                    if (!key) return;
                    if (!map[key]) map[key] = [];
                    map[key].push(entry);
                    // Also index by pure-digits key
                    const norm = normBC(key);
                    if (norm && norm !== key && !map[norm]) map[norm] = map[key];
                };

                json.forEach(row => {
                    const keys = Object.keys(row);
                    // Find EPC column (case-insensitive)
                    const epcKey = keys.find(k => k.toLowerCase().replace(/[\s_-]/g, '') === 'epc'
                        || k.toLowerCase().includes('epc'));
                    const epc = epcKey ? String(row[epcKey] || '').trim() : '';
                    if (!epc) return;

                    const qrKey = keys.find(k => {
                        const l = k.toLowerCase().replace(/[\s_-]/g, '');
                        return l === 'qr' || l === 'qrcode' || l === 'qrvalue';
                    });
                    const qr = (qrKey ? String(row[qrKey] || '').trim() : '') || epc;

                    // Index by ALL barcode/EAN column values
                    const barcodeKeys = keys.filter(k => {
                        const l = k.toLowerCase().replace(/[\s_-]/g, '');
                        return l === 'barcode' || l === 'ean' || l === 'ean13' ||
                            l === 'gtin' || l.includes('barcode') || l.includes('ean');
                    });
                    barcodeKeys.forEach(bk => {
                        const val = String(row[bk] || '').trim();
                        if (val) addEntry(val, { epc, qr });
                    });
                });
                resolve(map);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

function GenerateModal({ file, onClose, designs }) {
    const [step, setStep] = useState(1); // 1 = upload, 2 = summary, 3 = generating, 4 = done
    const [labelFile, setLabelFile] = useState(null);
    const [epcFile, setEpcFile] = useState(null);
    const [selectedDesignId, setSelectedDesignId] = useState('');
    const [summary, setSummary] = useState(null);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');
    const labelInputRef = useRef();
    const epcInputRef = useRef();

    const handleValidate = async () => {
        if (!labelFile) { setError('Please upload the label file.'); return; }
        setError('');
        try {
            const labelRows = await parseLabelFile(labelFile);
            let epcMap = null;
            if (epcFile) {
                epcMap = await parseEPCFile(epcFile);
            }

            let matched = 0, totalLabels = 0, unmatched = [];
            labelRows.forEach(r => {
                // Normalise barcode for lookup (handles leading-zero stripping by Excel)
                const lookupKey = (epcMap && (epcMap[r.barcode] ? r.barcode : (epcMap[normBC(r.barcode)] ? normBC(r.barcode) : null)));
                if (!epcMap || lookupKey) { matched++; totalLabels += r.qty; }
                else { unmatched.push(r.barcode); }
            });
            setSummary({ totalLabels, matched, unmatched, labelRows, epcMap });
            setStep(2);
        } catch (err) { setError('Parsing failed: ' + err.message); }
    };

    const handleGenerate = async () => {
        if (!selectedDesignId) {
            setError('Please select a design template.');
            return;
        }
        const design = designs.find(d => (d._id || d.id) === selectedDesignId);
        if (!design) {
            setError('Invalid design selected.');
            return;
        }

        setStep(3);
        try {
            const { labelRows, epcMap } = summary;
            const outputRows = [];
            let serialCounter = INITIAL_SERIAL;

            for (const row of labelRows) {
                if (epcMap) {
                    const epcs = epcMap[row.barcode] || epcMap[normBC(row.barcode)];
                    if (!epcs) continue;
                    for (let i = 0; i < row.qty; i++) {
                        const epcEntry = epcs[i % epcs.length];
                        outputRows.push({ ...row, epc: epcEntry.epc, qrCode: epcEntry.qr });
                    }
                } else {
                    for (let i = 0; i < row.qty; i++) {
                        const epc = encodeSGTIN96(row.barcode, serialCounter);
                        outputRows.push({ ...row, epc, qrCode: epc });
                        serialCounter--;
                    }
                }
            }

            await generateAllLabels(
                outputRows,
                design,
                (p) => setProgress(p),
                (pdfBytes, filename) => {
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    link.click();
                    URL.revokeObjectURL(url);
                }
            );
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
            <div style={{ color: fileState ? '#10b981' : '#94a3b8', marginBottom: 6 }}>
                {fileState
                    ? <CheckCircle size={24} />
                    : <Upload size={24} />}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, color: fileState ? '#065f46' : 'var(--text-primary, #1e293b)' }}>
                {fileState ? fileState.name : label}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{fileState ? 'Click to change' : hint}</div>
        </div>
    );

    return (
        <div style={{
            minHeight: 520,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 12,
            padding: 20,
        }}>
            <div style={{
                background: 'white',
                borderRadius: 14,
                width: '100%',
                maxWidth: 520,
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                overflow: 'hidden',
            }}>
                {/* Modal header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, background: '#ede9fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Tag size={16} color="#7c3aed" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Generate single tag labels</div>
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>{file.originalName || file.filename}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Step indicator */}
                <div style={{ display: 'flex', padding: '12px 20px', gap: 6, borderBottom: '1px solid #f1f5f9' }}>
                    {['Upload files', 'Review', 'Generate'].map((s, i) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: step > i + 1 ? '#10b981' : step === i + 1 ? '#7c3aed' : '#e2e8f0',
                                color: step >= i + 1 ? 'white' : '#94a3b8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, flexShrink: 0,
                            }}>
                                {step > i + 1 ? '✓' : i + 1}
                            </div>
                            <span style={{ fontSize: 12, color: step === i + 1 ? '#7c3aed' : '#94a3b8', fontWeight: step === i + 1 ? 600 : 400 }}>{s}</span>
                            {i < 2 && <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />}
                        </div>
                    ))}
                </div>

                <div style={{ padding: '20px' }}>

                    {/* ── Step 1: Upload ── */}
                    {step === 1 && (
                        <>
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                    A — Select Design Template
                                </div>
                                <select 
                                    value={selectedDesignId}
                                    onChange={(e) => setSelectedDesignId(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: 'white' }}
                                >
                                    <option value="">— Choose Design —</option>
                                    {designs.map(d => (
                                        <option key={d._id || d.id} value={d._id || d.id}>{d.title}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                    B — Label generation file
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                    Required columns: <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#0284c7' }}>EAN</code> + <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#0284c7' }}>Final qty</code>
                                </div>
                                {uploadZone('Upload label file (.xlsx)', 'EAN + Final qty', labelInputRef, labelFile, setLabelFile, Upload)}
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                    C — EPC–QR mapping file (Optional)
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                    If skipped, unique EPCs will be <strong>automatically integrated</strong>.
                                </div>
                                {uploadZone('Upload EPC mapping file (.xlsx)', 'EAN + EPC codes', epcInputRef, epcFile, setEpcFile, Upload)}
                            </div>

                            {error && (
                                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#b91c1c' }}>
                                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                                <button onClick={onClose} style={btnSecondary}>Cancel</button>
                                <button
                                    onClick={handleValidate}
                                    disabled={!labelFile}
                                    style={{ ...btnPrimary, opacity: (!labelFile) ? 0.5 : 1 }}
                                >
                                    Validate & continue
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 2: Summary / Review ── */}
                    {step === 2 && summary && (
                        <>
                            <div style={sectionStyle}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: summary.unmatched.length > 0 ? 14 : 0 }}>
                                    {[
                                        { label: 'Total labels', value: summary.totalLabels, color: '#1e293b' },
                                        { label: 'Matched barcodes', value: summary.matched, color: '#059669' },
                                        { label: 'Unmatched', value: summary.unmatched.length, color: summary.unmatched.length > 0 ? '#dc2626' : '#94a3b8' },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{s.label}</div>
                                            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value.toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>

                                {summary.unmatched.length > 0 && (
                                    <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#b91c1c' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Unmatched barcodes (no EPC data):</div>
                                        <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{summary.unmatched.join(', ')}</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                                A PDF with <strong style={{ color: '#1e293b' }}>{summary.totalLabels.toLocaleString()} pages</strong> will be generated. Each page = one label with barcode + EPC (as QR).
                            </div>

                            {error && (
                                <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#b91c1c' }}>
                                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                                <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={summary.matched === 0}
                                    style={{ ...btnGreen, opacity: summary.matched === 0 ? 0.5 : 1 }}
                                >
                                    <Tag size={14} /> Generate PDF labels
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Step 3: Generating ── */}
                    {step === 3 && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid #ede9fe', borderTopColor: '#7c3aed', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>Generating labels...</div>
                            <div style={{ fontSize: 13, color: '#94a3b8' }}>{progress}% complete</div>
                            <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, marginTop: 16, overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: '#7c3aed', transition: 'width 0.3s ease' }} />
                            </div>
                            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                        </div>
                    )}

                    {/* ── Step 4: Done ── */}
                    {step === 4 && (
                        <div style={{ textAlign: 'center', padding: '30px 0' }}>
                            <div style={{ width: 56, height: 56, background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                <CheckCircle size={28} color="#059669" />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>Labels generated!</div>
                            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
                                {summary?.totalLabels?.toLocaleString()} label pages saved as PDF
                            </div>
                            <button onClick={onClose} style={btnPrimary}>Close</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Shared button styles
const btnSecondary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: 'white', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 500,
};
const btnPrimary = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#7c3aed', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
const btnGreen = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#059669', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminFilesManager() {
    const { isSidebarCollapsed } = useUIStore();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewFile, setPreviewFile] = useState(null);
    const [generateTarget, setGenerateTarget] = useState(null); // file object to generate labels for
    const [currentFolder, setCurrentFolder] = useState(null); // null = root
    const [designs, setDesigns] = useState([]);

    useEffect(() => { 
        fetchFiles(); 
        fetchDesigns();
    }, []);

    const fetchDesigns = async () => {
        try {
            const res = await designsAPI.getAll();
            setDesigns(res.data?.designs || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchFiles = async () => {
        try {
            const res = await filesAPI.getAll();
            setFiles(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;
        try {
            await filesAPI.delete(id);
            setFiles(files.filter(f => f._id !== id));
            toast.success('File deleted');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete file');
        }
    };

    const handleDeleteFolder = async (folderName) => {
        if (!window.confirm(`Are you sure you want to delete the folder "${folderName}" and ALL files inside it?`)) return;
        try {
            const folderFiles = files.filter(f => f.folder === folderName);
            // Delete files one by one (or implement backend folder delete)
            toast.loading('Deleting folder content...', { id: 'del_folder' });
            for (const f of folderFiles) {
                await filesAPI.delete(f._id);
            }
            setFiles(files.filter(f => f.folder !== folderName));
            toast.success('Folder deleted', { id: 'del_folder' });
            if (currentFolder === folderName) setCurrentFolder(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete folder', { id: 'del_folder' });
        }
    };

    const filteredFiles = files.filter(f =>
        f.originalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.filename?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping logic
    const allFolders = Array.from(new Set(files.map(f => f.folder).filter(Boolean)));
    
    // In search mode, show flat list. Otherwise show folder view.
    const isSearching = searchTerm.trim().length > 0;
    
    let displayItems = [];
    if (isSearching) {
        displayItems = filteredFiles.map(f => ({ ...f, isFolder: false }));
    } else if (currentFolder === null) {
        // Root view: show files with NO folder (folders are rendered separately via allFolders)
        displayItems = files.filter(f => !f.folder).map(f => ({ ...f, isFolder: false }));
    } else {
        // Subfolder view: show files in current folder
        displayItems = files.filter(f => f.folder === currentFolder).map(f => ({ ...f, isFolder: false }));
    }

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc', padding: 24 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {currentFolder ? currentFolder : 'My Folders'}
                        </h1>
                    </div>
                </div>

                <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 14 }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                    ) : (
                        <>
                            {/* Breadcrumb Navigation */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 20 }}>
                                <Home size={12} className="cursor-pointer" onClick={() => setCurrentFolder(null)} />
                                <ChevronRight size={10} />
                                <span 
                                    className={!currentFolder ? 'font-bold' : 'cursor-pointer'} 
                                    style={{ color: !currentFolder ? '#7c3aed' : 'inherit' }}
                                    onClick={() => setCurrentFolder(null)}
                                >
                                    All Folders
                                </span>
                                {currentFolder && (
                                    <>
                                        <ChevronRight size={10} />
                                        <span style={{ color: '#7c3aed' }}>{currentFolder}</span>
                                    </>
                                )}
                            </div>

                            {/* Folders Grid (Only in Root or Search) */}
                            {!currentFolder && !isSearching && allFolders.length > 0 && (
                                <div style={{ marginBottom: 32 }}>
                                    <h3 style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Folders</h3>
                                    <div className="folder-grid">
                                        {allFolders.map(name => {
                                            const folderFiles = files.filter(f => f.folder === name);
                                            return (
                                                <div key={name} className="folder-card" onClick={() => setCurrentFolder(name)}>
                                                    <div className="folder-icon-wrapper">
                                                        <Folder size={40} className="folder-icon" />
                                                        <div className="folder-actions" onClick={e => e.stopPropagation()}>
                                                            <button 
                                                                className="btn btn-ghost btn-icon btn-xs" 
                                                                style={{ padding: 4, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}
                                                                onClick={() => handleDeleteFolder(name)}
                                                            >
                                                                <Trash2 size={12} color="#ef4444" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="folder-info">
                                                        <div className="folder-name">{name}</div>
                                                        <div className="folder-count">{folderFiles.length} proof sheets</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Files List */}
                            <div style={{ marginTop: currentFolder ? 0 : 12 }}>
                                <h3 style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                                    {currentFolder ? 'Files' : isSearching ? 'Search Results' : 'Recent Files'}
                                </h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                                <th style={{ padding: 12, fontWeight: 600 }}>File name</th>
                                                <th style={{ padding: 12, fontWeight: 600 }}>Date saved</th>
                                                <th style={{ padding: 12, fontWeight: 600 }}>Uploaded by</th>
                                                <th style={{ padding: 12, fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayItems.filter(i => !i.isFolder).map(file => (
                                                <tr key={file._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                                    <td style={{ padding: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ width: 36, height: 36, background: '#e0f2fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                                                <FileIcon size={18} />
                                                            </div>
                                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                {file.originalName || file.filename}
                                                                {file.folder && isSearching && (
                                                                    <span style={{ marginLeft: 8, fontSize: 10, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#64748b' }}>in {file.folder}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                                                        {new Date(file.createdAt).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                                                        {file.uploadedBy?.name || 'Admin'}
                                                    </td>
                                                    <td style={{ padding: 12, textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => setGenerateTarget(file)}
                                                                className="btn btn-ghost btn-sm"
                                                                title="Generate single tag label"
                                                                style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                                    color: '#7c3aed', background: '#ede9fe',
                                                                    padding: '6px 12px', borderRadius: 7,
                                                                    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                                                                }}
                                                            >
                                                                <Tag size={13} /> Generate labels
                                                            </button>

                                                            <button
                                                                onClick={() => setPreviewFile(file.url)}
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="View inline"
                                                                style={{ color: '#10b981', background: '#d1fae5', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
                                                            >
                                                                <Eye size={16} />
                                                            </button>

                                                            <a
                                                                href={`${BASE_URL}${file.url}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="Download"
                                                                style={{ color: '#0284c7', background: '#e0f2fe', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <Download size={16} />
                                                            </a>

                                                            <button
                                                                onClick={() => handleDelete(file._id)}
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="Delete"
                                                                style={{ color: '#ef4444', background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                        </tr>
                                    ))}
                                    {filteredFiles.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                No saved files found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                            </div>
                        </div>
                    </>
                )}
                </div>
            </main>

            {/* ── PDF Preview Modal ── */}
            {previewFile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 20 }}>
                    <div style={{ background: 'white', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Proof sheet preview</h3>
                            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
                            <iframe src={`${BASE_URL}${previewFile}`} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Generate Labels Modal ── */}
            {generateTarget && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div style={{ width: '100%', maxWidth: 560 }}>
                        <GenerateModal
                            file={generateTarget}
                            onClose={() => setGenerateTarget(null)}
                            designs={designs}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}