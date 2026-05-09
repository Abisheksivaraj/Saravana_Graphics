import React, { useState, useEffect, useCallback } from 'react';
import {
    Cpu, Save, Play, FileJson, Settings, Info, RefreshCw, Barcode, Hash,
    AlertTriangle, CheckCircle, Activity, Download, Upload, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';

// ─── SGTIN-96 Encoding ──────────────────────────────────────────────────────

const PARTITIONS = {
    '0': { m: 40, n: 4, bits_m: 40, bits_n: 4 },
    '1': { m: 37, n: 7, bits_m: 37, bits_n: 7 },
    '2': { m: 34, n: 10, bits_m: 34, bits_n: 10 },
    '3': { m: 30, n: 14, bits_m: 30, bits_n: 14 },
    '4': { m: 27, n: 17, bits_m: 27, bits_n: 17 },
    '5': { m: 24, n: 20, bits_m: 24, bits_n: 20 },
    '6': { m: 20, n: 24, bits_m: 20, bits_n: 24 },
};

function encodeSGTIN96(barcode, serial, filter = 1, partition = 5) {
    try {
        const header = 0x30;
        const filterVal = parseInt(filter) & 0x07;
        const partitionVal = parseInt(partition) & 0x07;
        const part = PARTITIONS[String(partition)] || PARTITIONS['5'];

        const gtin14 = String(barcode).padStart(14, '0');
        const indicator = gtin14[0];
        const companyPrefix = gtin14.substring(1, 8);
        const itemRef = indicator + gtin14.substring(8, 13);

        const companyPrefixVal = BigInt(companyPrefix);
        const itemRefVal = BigInt(itemRef);
        const serialVal = BigInt(serial);

        let epcBinary = header.toString(2).padStart(8, '0');
        epcBinary += filterVal.toString(2).padStart(3, '0');
        epcBinary += partitionVal.toString(2).padStart(3, '0');
        epcBinary += companyPrefixVal.toString(2).padStart(part.bits_m, '0');
        epcBinary += itemRefVal.toString(2).padStart(part.bits_n, '0');
        epcBinary += serialVal.toString(2).padStart(38, '0');

        let epcHex = '';
        for (let i = 0; i < epcBinary.length; i += 4) {
            epcHex += parseInt(epcBinary.substring(i, i + 4), 2).toString(16).toUpperCase();
        }
        return epcHex;
    } catch (e) {
        return 'ERROR';
    }
}

// ─── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT_SERIAL_START = 274655906933n;
const DEFAULT_SERIAL_END   = 274675906933n;
const LOW_THRESHOLD = 100000;

// ─── Main Component ─────────────────────────────────────────────────────────
export default function RFIDFormat() {
    const { isSidebarCollapsed } = useUIStore();
    const [formData, setFormData] = useState({
        filter: '1',
        partition: '5',
        lockBits: '0',
        head: '48',
    });

    const [importedData, setImportedData]     = useState([]);
    
    // Persistence initialization
    const [serialStart, setSerialStart] = useState(() => {
        const saved = localStorage.getItem('rfid_serial_start');
        return saved ? BigInt(saved) : DEFAULT_SERIAL_START;
    });
    const [serialEnd, setSerialEnd] = useState(() => {
        const saved = localStorage.getItem('rfid_serial_end');
        return saved ? BigInt(saved) : DEFAULT_SERIAL_END;
    });
    const [currentSerial, setCurrentSerial] = useState(() => {
        const saved = localStorage.getItem('rfid_current_serial');
        return saved ? BigInt(saved) : (localStorage.getItem('rfid_serial_start') ? BigInt(localStorage.getItem('rfid_serial_start')) : DEFAULT_SERIAL_START);
    });
    const [usedSerials, setUsedSerials] = useState(() => {
        const saved = localStorage.getItem('rfid_used_serials');
        return saved ? BigInt(saved) : 0n;
    });

    const [generating, setGenerating]         = useState(false);
    const [alert, setAlert]                   = useState(null); // { type, message }
    const [lastFileName, setLastFileName]     = useState('');
    const [previewEPC, setPreviewEPC]         = useState('');

    const totalSerials = Number(serialEnd - serialStart + 1n);
    const remaining = Number(serialEnd - currentSerial + 1n);
    const pct = Math.max(0, Math.min(100, (remaining / (totalSerials || 1)) * 100));

    // Save to localStorage whenever serial states change
    useEffect(() => {
        localStorage.setItem('rfid_serial_start', serialStart.toString());
        localStorage.setItem('rfid_serial_end', serialEnd.toString());
        localStorage.setItem('rfid_current_serial', currentSerial.toString());
        localStorage.setItem('rfid_used_serials', usedSerials.toString());
    }, [serialStart, serialEnd, currentSerial, usedSerials]);

    // Recompute preview EPC whenever params change
    useEffect(() => {
        if (importedData.length > 0) {
            const first = importedData[0];
            setPreviewEPC(encodeSGTIN96(first.barcode, currentSerial, formData.filter, formData.partition));
        }
    }, [importedData, currentSerial, formData.filter, formData.partition]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const showAlert = (type, message) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 6000);
    };

    // ── Import Excel ────────────────────────────────────────────────────────
    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setLastFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                const mapped = json
                    .map(row => ({
                        barcode: String(row['EAN'] || row['Barcode'] || row['barcode'] || '').trim(),
                        qty: parseInt(row['Final qty'] || row['Final Qty'] || row['Qty'] || row['qty'] || 0),
                    }))
                    .filter(r => r.barcode && !isNaN(r.qty) && r.qty > 0);

                if (mapped.length === 0) {
                    showAlert('error', 'No valid rows found. Ensure columns EAN and Final qty exist.');
                    return;
                }

                // Check total qty needed
                const totalNeeded = mapped.reduce((s, r) => s + r.qty, 0);
                if (totalNeeded > remaining) {
                    showAlert('error', `Not enough serial numbers! Need ${totalNeeded.toLocaleString()} but only ${remaining.toLocaleString()} remain.`);
                }

                setImportedData(mapped);
                showAlert('success', `Imported ${mapped.length} rows — Total qty: ${totalNeeded.toLocaleString()}`);
            } catch (err) {
                showAlert('error', 'Failed to parse Excel file: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    // ── Export / Generate ───────────────────────────────────────────────────
    const handleExport = () => {
        if (importedData.length === 0) {
            showAlert('error', 'Please import an Excel file first.');
            return;
        }

        const totalNeeded = importedData.reduce((s, r) => s + r.qty, 0);

        if (remaining < LOW_THRESHOLD) {
            showAlert('warning', `⚠️ Serial numbers are about to exhaust soon! Only ${remaining.toLocaleString()} left.`);
            if (remaining <= 0) return;
        }

        if (totalNeeded > remaining) {
            showAlert('error', `Cannot generate: Need ${totalNeeded.toLocaleString()} serial numbers but only ${remaining.toLocaleString()} remain.`);
            return;
        }

        setGenerating(true);

        setTimeout(() => {
            try {
                const fileName = `RFID_Export_${Date.now()}.xlsx`;
                // FN column: mimic the path format shown in the image
                const fnPath = `C:\\Users\\CLS\\Downloads\\${fileName}`;

                const allRows = [];
                let serial = currentSerial;
                let idCounter = 1;

                importedData.forEach(item => {
                    let itemId = 1;
                    for (let i = 0; i < item.qty; i++) {
                        allRows.push({
                            ID:         idCounter++,
                            Barcode:    item.barcode,
                            EPC:        encodeSGTIN96(item.barcode, serial, formData.filter, formData.partition),
                            TID:        '',
                            'User Mem': '',
                            LockBits:   parseInt(formData.lockBits) || 0,
                            KillCode:   '',
                            AccessCode: '',
                            RSSI:       '',
                            'DIST':     '',
                            Time:       '',
                            Status:     '',
                            SKU:        'A001',
                            FN:         fnPath,
                        });
                        serial--;
                        itemId++;
                    }
                });

                const worksheet = XLSX.utils.json_to_sheet(allRows);

                // Column widths matching the image
                worksheet['!cols'] = [
                    { wch: 6 },  // ID
                    { wch: 16 }, // Barcode
                    { wch: 28 }, // EPC
                    { wch: 10 }, // TID
                    { wch: 10 }, // User Mem
                    { wch: 10 }, // LockBits
                    { wch: 10 }, // KillCode
                    { wch: 12 }, // AccessCode
                    { wch: 8 },  // RSSI
                    { wch: 8 },  // DIST
                    { wch: 10 }, // Time
                    { wch: 8 },  // Status
                    { wch: 8 },  // SKU
                    { wch: 46 }, // FN
                ];

                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'EPC_Data');
                XLSX.writeFile(workbook, fileName);

                // Update serial tracker
                const consumed = BigInt(totalNeeded);
                setUsedSerials(prev => prev + consumed);
                setCurrentSerial(serial);

                const newRemaining = Number(serial - 0n + 1n);
                if (newRemaining < LOW_THRESHOLD) {
                    showAlert('warning', `⚠️ Serial numbers are about to exhaust soon! ${newRemaining.toLocaleString()} remaining.`);
                } else {
                    showAlert('success', `✓ Generated ${allRows.length.toLocaleString()} EPC codes. File: ${fileName}`);
                }
            } catch (err) {
                showAlert('error', 'Export failed: ' + err.message);
            } finally {
                setGenerating(false);
            }
        }, 80);
    };

    // ─── Styles ─────────────────────────────────────────────────────────────
    const s = {
        page: {
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f1117 0%, #1a1f2e 50%, #0d1520 100%)',
            fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
            color: '#e2e8f0',
            padding: '24px',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '28px',
        },
        h1: {
            fontSize: '22px',
            fontWeight: '700',
            color: '#f1f5f9',
            margin: 0,
            letterSpacing: '-0.3px',
        },
        subtitle: {
            color: '#64748b',
            fontSize: '13px',
            marginTop: '4px',
        },
        btnRow: { display: 'flex', gap: '10px' },
        btnSecondary: {
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
        },
        btnPrimary: {
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
        },
        btnDanger: {
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
            opacity: generating ? 0.7 : 1,
        },
        grid: {
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: '20px',
            marginBottom: '20px',
        },
        card: {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            overflow: 'hidden',
        },
        cardHeader: {
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
        },
        cardTitle: { fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: 0 },
        cardBody: { padding: '20px' },
        label: {
            display: 'block', fontSize: '11px', fontWeight: '600',
            color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px',
            marginBottom: '6px',
        },
        input: {
            width: '100%', padding: '9px 12px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e2e8f0', fontSize: '13px', outline: 'none',
            boxSizing: 'border-box',
        },
        row: { display: 'flex', gap: '14px', marginBottom: '16px' },
        paramsGrid: {
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
            marginBottom: '16px',
        },
        divider: {
            height: '1px', background: 'rgba(255,255,255,0.06)',
            margin: '16px 0',
        },
        actionRow: {
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            gap: '12px', marginTop: '16px',
        },
        fieldHint: {
            fontSize: '11px', color: '#475569', marginBottom: '6px',
        },
        miniChips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
        chip: {
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
            background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.25)',
        },
        previewTable: {
            width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginTop: '12px',
        },
        // Serial tracker styles
        trackerCard: {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '20px', marginBottom: '20px',
        },
        progressBar: {
            height: '8px', borderRadius: '4px',
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
            marginTop: '10px',
        },
        progressFill: (pct) => ({
            height: '100%', borderRadius: '4px',
            width: `${pct}%`,
            background: pct > 20
                ? 'linear-gradient(90deg, #3b82f6, #10b981)'
                : 'linear-gradient(90deg, #ef4444, #f97316)',
            transition: 'width 0.5s ease',
        }),
        statGrid: {
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px',
        },
        stat: {
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '14px',
        },
        statLabel: { fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' },
        statValue: { fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginTop: '4px' },
        alertBox: (type) => ({
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
            background: type === 'error' ? 'rgba(239,68,68,0.12)'
                : type === 'warning' ? 'rgba(245,158,11,0.12)'
                : 'rgba(16,185,129,0.12)',
            border: `1px solid ${type === 'error' ? 'rgba(239,68,68,0.3)'
                : type === 'warning' ? 'rgba(245,158,11,0.3)'
                : 'rgba(16,185,129,0.3)'}`,
            color: type === 'error' ? '#fca5a5' : type === 'warning' ? '#fcd34d' : '#6ee7b7',
            fontSize: '13px',
        }),
        epcBox: {
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: '8px', padding: '12px', fontFamily: 'monospace',
            fontSize: '13px', color: '#93c5fd', wordBreak: 'break-all',
            letterSpacing: '1px', marginBottom: '16px',
        },
        detailItem: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontSize: '12px',
        },
    };

    const totalNeeded = importedData.reduce((s, r) => s + r.qty, 0);

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ ...s.page, overflowY: 'auto' }}>
            {/* Header */}
            <div style={s.header}>
                <div>
                    <h1 style={s.h1}>RFID Format Configuration</h1>
                    <p style={s.subtitle}>Configure SGTIN-96 RFID tag encoding parameters</p>
                </div>
                <div style={s.btnRow}>
                    <button 
                        style={s.btnSecondary}
                        onClick={() => {
                            if (window.confirm('Reset all serial tracking data to defaults?')) {
                                setSerialStart(DEFAULT_SERIAL_START);
                                setSerialEnd(DEFAULT_SERIAL_END);
                                setCurrentSerial(DEFAULT_SERIAL_START);
                                setUsedSerials(0n);
                                localStorage.removeItem('rfid_serial_start');
                                localStorage.removeItem('rfid_serial_end');
                                localStorage.removeItem('rfid_current_serial');
                                localStorage.removeItem('rfid_used_serials');
                                showAlert('success', 'Reset tracking data to defaults.');
                            }
                        }}
                    >
                        <RefreshCw size={14} /> Reset
                    </button>
                    <button style={s.btnPrimary} onClick={() => showAlert('success', 'Format configuration saved locally.')}>
                        <Save size={14} /> Save Format
                    </button>
                </div>
            </div>

            {/* Alert */}
            {alert && (
                <div style={s.alertBox(alert.type)}>
                    {alert.type === 'error' && <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {alert.type === 'warning' && <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {alert.type === 'success' && <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span>{alert.message}</span>
                    <button onClick={() => setAlert(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Serial Number Status Tracker */}
            <div style={s.trackerCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Activity size={16} color="#3b82f6" />
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Current Serial Number Status</span>
                    {remaining < LOW_THRESHOLD && (
                        <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '20px', background: 'rgba(239,68,68,0.2)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
                            ⚠ LOW
                        </span>
                    )}
                </div>
                <div style={s.statGrid}>
                    <div style={s.stat}>
                        <div style={s.statLabel}>Current Serial</div>
                        <div style={{ ...s.statValue, fontSize: '14px', fontFamily: 'monospace', color: '#93c5fd' }}>{currentSerial.toString()}</div>
                    </div>
                    <div style={s.stat}>
                        <div style={s.statLabel}>Remaining</div>
                        <div style={{ ...s.statValue, color: remaining < LOW_THRESHOLD ? '#fca5a5' : '#6ee7b7' }}>
                            {remaining.toLocaleString()}
                        </div>
                    </div>
                    <div style={s.stat}>
                        <div style={s.statLabel}>Used</div>
                        <div style={{ ...s.statValue, color: '#f1f5f9' }}>{usedSerials.toString() !== '0' ? Number(usedSerials).toLocaleString() : '0'}</div>
                    </div>
                </div>
                <div style={s.progressBar}>
                    <div style={s.progressFill(pct)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginTop: '5px' }}>
                    <span>Start: {serialStart.toString()}</span>
                    <span>{pct.toFixed(1)}% remaining</span>
                    <span>End: {serialEnd.toString()}</span>
                </div>
            </div>

            {/* Main Grid */}
            <div style={s.grid}>
                {/* Left: Config Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Serial Range Configuration Card */}
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <Hash size={16} color="#3b82f6" />
                            <h3 style={s.cardTitle}>Serial Range Configuration</h3>
                        </div>
                        <div style={s.cardBody}>
                            <div style={s.row}>
                                <div style={{ flex: 1 }}>
                                    <label style={s.label}>Serial Start</label>
                                    <input 
                                        style={s.input} 
                                        type="text" 
                                        value={serialStart.toString()} 
                                        onChange={(e) => {
                                            try {
                                                const val = BigInt(e.target.value.replace(/\D/g, '') || '0');
                                                setSerialStart(val);
                                                if (usedSerials === 0n) setCurrentSerial(val);
                                            } catch {}
                                        }} 
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={s.label}>Serial End</label>
                                    <input 
                                        style={s.input} 
                                        type="text" 
                                        value={serialEnd.toString()} 
                                        onChange={(e) => {
                                            try {
                                                const val = BigInt(e.target.value.replace(/\D/g, '') || '0');
                                                setSerialEnd(val);
                                            } catch {}
                                        }} 
                                    />
                                </div>
                            </div>
                            <p style={{ ...s.fieldHint, marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Info size={12} />
                                Currently tracking from <strong style={{ color: '#93c5fd' }}>{currentSerial.toString()}</strong>. 
                                <button 
                                    onClick={() => {
                                        if (window.confirm('Reset tracking to current Serial Start? This will clear Used count.')) {
                                            setCurrentSerial(serialStart);
                                            setUsedSerials(0n);
                                        }
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: '0 4px', textDecoration: 'underline' }}
                                >
                                    Reset Tracking
                                </button>
                            </p>
                        </div>
                    </div>

                    <div style={s.card}>
                    <div style={s.cardHeader}>
                        <Settings size={16} color="#3b82f6" />
                        <h3 style={s.cardTitle}>SGTIN-96 Data Source</h3>
                    </div>
                    <div style={s.cardBody}>
                        {/* Standard Params */}
                        <div style={{ marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Standard Parameters</h4>
                            <div style={s.paramsGrid}>
                                {['head', 'filter', 'partition', 'lockBits'].map(field => (
                                    <div key={field}>
                                        <label style={s.label}>{field === 'lockBits' ? 'Lock Bits' : field.charAt(0).toUpperCase() + field.slice(1)}</label>
                                        <input style={s.input} type="text" name={field} value={formData[field]} onChange={handleChange} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={s.divider} />

                        {/* Excel Import Section */}
                        <div>
                            <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Excel Import</h4>
                            <p style={s.fieldHint}>Required columns: <strong style={{ color: '#60a5fa' }}>EAN</strong>, <strong style={{ color: '#60a5fa' }}>Final qty</strong></p>
                            <div style={s.miniChips}>
                                <span style={s.chip}>EAN → Barcode</span>
                                <span style={s.chip}>Final qty → Quantity</span>
                            </div>
                        </div>

                        <div style={s.actionRow}>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                                {importedData.length > 0 ? (
                                    <span style={{ color: '#6ee7b7' }}>✓ {importedData.length} rows • {totalNeeded.toLocaleString()} total qty</span>
                                ) : 'No file loaded'}
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input type="file" id="excel-upload" hidden accept=".xlsx,.xls" onChange={handleImport} />
                                <button
                                    style={s.btnSecondary}
                                    onClick={() => document.getElementById('excel-upload').click()}
                                >
                                    <Upload size={14} /> Load Excel
                                </button>
                                <button
                                    style={{ ...s.btnDanger, cursor: generating ? 'not-allowed' : 'pointer' }}
                                    onClick={handleExport}
                                    disabled={generating}
                                >
                                    {generating
                                        ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                                        : <><Download size={14} /> Generate EPC</>
                                    }
                                </button>
                            </div>
                        </div>

                        {/* Imported Preview */}
                        {importedData.length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                                        Imported Data ({importedData.length} entries)
                                    </span>
                                    <button onClick={() => setImportedData([])} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)' }}>
                                    <table style={s.previewTable}>
                                        <thead>
                                            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                                                {['#', 'EAN / Barcode', 'Qty'].map(h => (
                                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importedData.slice(0, 6).map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                    <td style={{ padding: '7px 12px', color: '#475569' }}>{i + 1}</td>
                                                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#93c5fd' }}>{row.barcode}</td>
                                                    <td style={{ padding: '7px 12px', color: '#e2e8f0' }}>{row.qty.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            {importedData.length > 6 && (
                                                <tr>
                                                    <td colSpan={3} style={{ padding: '7px 12px', color: '#475569', textAlign: 'center', fontSize: '11px' }}>
                                                        + {importedData.length - 6} more rows
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                </div>

                {/* Right: Preview Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <Play size={16} color="#10b981" />
                            <h3 style={s.cardTitle}>Encoding Preview</h3>
                        </div>
                        <div style={s.cardBody}>
                            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Generated EPC (Hex)</div>
                            <div style={s.epcBox}>
                                {previewEPC || (importedData.length > 0 ? '—' : 'Load Excel to preview')}
                            </div>
                            <div>
                                {[
                                    { label: 'Scheme', value: 'SGTIN-96' },
                                    { label: 'Filter', value: formData.filter },
                                    { label: 'Partition', value: formData.partition },
                                    { label: 'Serial (current)', value: currentSerial.toString() },
                                ].map(({ label, value }) => (
                                    <div key={label} style={s.detailItem}>
                                        <span style={{ color: '#64748b', fontSize: '12px' }}>{label}</span>
                                        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e2e8f0' }}>{value}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Encoding Options</div>
                                {[{ id: 'lock-epc', label: 'Lock EPC Memory', defaultChecked: true }, { id: 'verify-tid', label: 'Verify TID', defaultChecked: false }].map(opt => (
                                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#94a3b8', cursor: 'pointer', marginBottom: '8px' }}>
                                        <input type="checkbox" defaultChecked={opt.defaultChecked} style={{ accentColor: '#3b82f6' }} />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Output Format Info */}
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <FileJson size={16} color="#f59e0b" />
                            <h3 style={s.cardTitle}>Output Format</h3>
                        </div>
                        <div style={{ padding: '16px', fontSize: '12px', color: '#64748b', lineHeight: '1.8' }}>
                            Output columns: <br />
                            <span style={{ color: '#93c5fd', fontFamily: 'monospace', fontSize: '11px' }}>
                                ID · Barcode · EPC · TID · User Mem · LockBits · KillCode · AccessCode · RSSI · DIST · Time · Status · SKU · FN
                            </span>
                            <div style={{ marginTop: '8px', color: '#475569', fontSize: '11px' }}>
                                FN = download path of the generated file
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Info bar */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '12px', color: '#64748b' }}>
                <Info size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>SGTIN-96 encodes a GTIN + Serial Number into 96 bits. Serial numbers decrement from <strong style={{ color: '#93c5fd' }}>{serialEnd.toString()}</strong> down to <strong style={{ color: '#93c5fd' }}>{serialStart.toString()}</strong>. An alert is triggered when fewer than {LOW_THRESHOLD.toLocaleString()} remain.</span>
            </div>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
            </main>
        </div>
    );
}