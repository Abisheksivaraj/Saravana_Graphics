import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, File as FileIcon, Search, Eye, X, Tag, Upload, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import * as XLSX from 'xlsx';
import { filesAPI, BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';

// ─── Constants ─────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 200; // labels per PDF file — tune up/down based on perf
const PAGE_W_PT = 595.28; // A4 landscape width in points (210mm)
const PAGE_H_PT = 419.53; // A4 landscape height in points (148mm)

// ─── Yield helper — lets browser breathe between chunks ───────────────────────
const yieldFrame = () => new Promise(r => setTimeout(r, 0));

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
async function buildChunk(rows, onSubProgress) {
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();

    const MM_TO_PT = 2.83465;

    // ─── Load Fonts ─────────────────────────────────────
    let fontBold, fontReg, fontOCR, fontRupee, fontCalibri;
    try {
        const [ocrBuf, arialBuf, arialBoldBuf, rupeeBuf, calibriBuf] = await Promise.all([
            fetch('/fonts/OCRB.ttf').then(r => r.arrayBuffer()),
            fetch('/fonts/Arial.ttf').then(r => r.arrayBuffer()),
            fetch('/fonts/Arial-Bold.ttf').then(r => r.arrayBuffer()),
            fetch('/fonts/RupeeForbidan.ttf').then(r => r.arrayBuffer()),
            fetch('/fonts/Calibri-Bold.ttf').then(r => r.arrayBuffer())
        ]);

        fontOCR = await pdfDoc.embedFont(ocrBuf);
        fontReg = await pdfDoc.embedFont(arialBuf);
        fontBold = await pdfDoc.embedFont(arialBoldBuf);
        fontRupee = await pdfDoc.embedFont(rupeeBuf);
        fontCalibri = await pdfDoc.embedFont(calibriBuf);

    } catch {
        fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
        fontOCR = await pdfDoc.embedFont(StandardFonts.CourierBold);
        fontCalibri = fontBold;
        fontRupee = null;
    }

    // ─── Label Size ─────────────────────────────────────
    const tW = 124.72;
    const tH = 290.55;

    // ─── Barcode Size (Exact) ───────────────────────────
    const bcW = 26.2 * MM_TO_PT;
    const bcH = 10.4 * MM_TO_PT;

    // ─── QR / RFID Size (7mm) ───────────────────────────
    const iconSize = 7 * MM_TO_PT;

    // ─── Line thickness (0.35mm ≈ 1pt) ──────────────────
    const lineT = 1;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const page = pdfDoc.addPage([tW, tH]);

        // ────────────────────────────────────────────────
        // MRP HEADER (Arial Bold 6.8)
        // ────────────────────────────────────────────────
        const mh = "MRP (Incl. of all taxes)";
        const mhS = 6.8;

        page.drawText(mh, {
            x: (tW - fontBold.widthOfTextAtSize(mh, mhS)) / 2,
            y: tH - 25,
            size: mhS,
            font: fontBold
        });

        // ────────────────────────────────────────────────
        // PRICE (₹ + VALUE)
        // ────────────────────────────────────────────────
        const price = String(row.mrp || "00.00").replace(/[₹Rs.]/gi, '').trim();

        const rS = 15.758;
        const pS = 17.9;

        const rW = rS * 0.7;
        const pW = fontCalibri.widthOfTextAtSize(price, pS);

        const startX = (tW - (rW + 4 + pW)) / 2;

        drawRupee(page, startX, tH - 44, rS, rgb, fontRupee);

        page.drawText(price, {
            x: startX + rW + 4,
            y: tH - 46,
            size: pS,
            font: fontCalibri
        });

        // ❌ REMOVED TOP BLUE LINE (as requested)

        // ────────────────────────────────────────────────
        // SIZE
        // ────────────────────────────────────────────────
        page.drawText(`Size : ${row.size || ''}`, {
            x: 10,
            y: tH - 65,
            size: 9.9,
            font: fontReg
        });

        page.drawText(row.sizeNum || '', {
            x: tW - 20,
            y: tH - 65,
            size: 9.9,
            font: fontBold
        });

        // Divider
        page.drawLine({
            start: { x: 5, y: tH - 72 },
            end: { x: tW - 5, y: tH - 72 },
            thickness: lineT,
            color: rgb(0, 0, 0)
        });

        // ────────────────────────────────────────────────
        // PRODUCT DETAILS (Arial 5.5)
        // ────────────────────────────────────────────────
        const dS = 5.5;

        const details = [
            [`${row.brand}`, `ART : ${row.art}`],
            [`${row.color}`, `MFD ON : ${row.mfd}`],
            [`${row.style}`, `NET QTY : ${row.netQty}`],
        ];

        let y = tH - 82;

        details.forEach(([l, r]) => {
            page.drawText(l, { x: 10, y, size: dS, font: fontReg });
            page.drawText(r, { x: tW / 2, y, size: dS, font: fontReg });
            y -= 8;
        });

        // ────────────────────────────────────────────────
        // BARCODE
        // ────────────────────────────────────────────────
        await drawBarcode(page, row.barcode, (tW - bcW) / 2, tH - 140, bcW, bcH, rgb, fontOCR);

        // ────────────────────────────────────────────────
        // ADDRESS (Arial 6pt)
        // ────────────────────────────────────────────────
        const aS = 6;

        const address = [
            "RELIANCE RETAIL LIMITED",
            "SHED NO.77/80, INDIAN CORPORATION",
            "GODOWN, MANKOLI NAKA,",
            "VILLAGE: DAPODE, TALUKA: BHIWANDI,",
            "DIST: THANE, MAHARASHTRA, PIN: 421302"
        ];

        let ay = tH - 160;

        address.forEach(line => {
            page.drawText(line, {
                x: (tW - fontReg.widthOfTextAtSize(line, aS)) / 2,
                y: ay,
                size: aS,
                font: fontReg
            });
            ay -= 7;
        });

        // Divider
        page.drawLine({
            start: { x: 5, y: ay },
            end: { x: tW - 5, y: ay },
            thickness: lineT,
            color: rgb(0, 0, 0)
        });

        // ────────────────────────────────────────────────
        // CONTACT (Arial 6pt)
        // ────────────────────────────────────────────────
        const contact = [
            "FOR COMPLAINTS/FEEDBACK, PLS WRITE TO OUR",
            "CUSTOMER CARE EXECUTIVE AT THE ABOVE ADDRESS OR",
            "customerservice@ril.com or",
            "CALL 1800 891 0001 / 1800 102 7382"
        ];

        ay -= 8;

        contact.forEach(line => {
            page.drawText(line, {
                x: (tW - fontReg.widthOfTextAtSize(line, aS)) / 2,
                y: ay,
                size: aS,
                font: fontReg
            });
            ay -= 6;
        });

        // ────────────────────────────────────────────────
        // FOOTER (RFID + QR + SARAVANA)
        // ────────────────────────────────────────────────
        const fy = 10;

        // SARAVANA (Near RFID)
        page.drawText("SARAVANA", {
            x: 10,
            y: fy + 4,
            size: 4.5,
            font: fontBold
        });

        // RFID (7mm)
        page.drawRectangle({
            x: 35,
            y: fy,
            width: iconSize,
            height: iconSize,
            borderWidth: 0.5,
            borderColor: rgb(0, 0, 0)
        });

        page.drawText("RFID", {
            x: 35 + 4,
            y: fy + 4,
            size: 5,
            font: fontBold
        });

        // QR (7mm)
        await drawQR(page, row.qrCode || row.barcode, tW - iconSize - 10, fy, iconSize, rgb);

        if (i % 50 === 0) {
            onSubProgress && onSubProgress(i / rows.length);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    return pdfDoc.save();
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

// ─── Generate Modal Component ─────────────────────────────────────────────────

function GenerateModal({ file, onClose }) {
    const [step, setStep] = useState(1); // 1 = upload, 2 = summary, 3 = generating, 4 = done
    const [labelFile, setLabelFile] = useState(null);
    const [epcFile, setEpcFile] = useState(null);
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
        setStep(3);
        try {
            const { labelRows, epcMap } = summary;
            const outputRows = [];
            let serialCounter = INITIAL_SERIAL;

            for (const row of labelRows) {
                if (epcMap) {
                    // Use normalised barcode key for lookup
                    const epcs = epcMap[row.barcode] || epcMap[normBC(row.barcode)];
                    if (!epcs) continue;
                    for (let i = 0; i < row.qty; i++) {
                        const epcEntry = epcs[i % epcs.length];
                        outputRows.push({ ...row, epc: epcEntry.epc, qrCode: epcEntry.qr });
                    }
                } else {
                    // Auto-generate EPCs if no mapping file provided
                    for (let i = 0; i < row.qty; i++) {
                        const epc = encodeSGTIN96(row.barcode, serialCounter);
                        outputRows.push({ ...row, epc, qrCode: epc });
                        serialCounter--;
                    }
                }
            }

            await generateAllLabels(
                outputRows,
                (pct) => setProgress(pct),
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
                                    A — Label generation file
                                </div>
                                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                    Required columns: <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#0284c7' }}>EAN</code> + <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, color: '#0284c7' }}>Final qty</code>
                                </div>
                                {uploadZone('Upload label file (.xlsx)', 'EAN + Final qty', labelInputRef, labelFile, setLabelFile, Upload)}
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                    B — EPC–QR mapping file (Optional)
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

    useEffect(() => { fetchFiles(); }, []);

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

    const filteredFiles = files.filter(f =>
        f.originalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.filename?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc', padding: 24 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text-primary)' }}>Saved proof sheets</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Select a proof sheet to generate single tag labels</p>
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
                                    {filteredFiles.map(file => (
                                        <tr key={file._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, background: '#e0f2fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                                        <FileIcon size={18} />
                                                    </div>
                                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                        {file.originalName || file.filename}
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
                                                    {/* Generate Single Tag Label — PRIMARY new action */}
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

                                                    {/* View inline */}
                                                    <button
                                                        onClick={() => setPreviewFile(file.url)}
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        title="View inline"
                                                        style={{ color: '#10b981', background: '#d1fae5' }}
                                                    >
                                                        <Eye size={16} />
                                                    </button>

                                                    {/* Download */}
                                                    <a
                                                        href={`${BASE_URL}${file.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        title="Download"
                                                        style={{ color: '#0284c7', background: '#e0f2fe' }}
                                                    >
                                                        <Download size={16} />
                                                    </a>

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => handleDelete(file._id)}
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        title="Delete"
                                                        style={{ color: '#ef4444', background: '#fee2e2' }}
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
                        />
                    </div>
                </div>
            )}
        </div>
    );
}