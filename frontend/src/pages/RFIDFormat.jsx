import React, { useState, useEffect, useCallback } from 'react';
import {
    Cpu, Save, Play, FileJson, Settings, Info, RefreshCw, Barcode, Hash,
    AlertTriangle, CheckCircle, Activity, Download, Upload, X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import { rfidAPI } from '../api';
import toast from 'react-hot-toast';

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

function cleanBarcode(barcode) {
    if (barcode === null || barcode === undefined) return '';
    let str = String(barcode).trim();
    
    // Handle scientific notation or numbers (e.g. 8.90E+12)
    // Using BigInt(Number(str)) is safe for EAN-13 as it's below 2^53
    if (str.toLowerCase().includes('e') || !isNaN(Number(str))) {
        try {
            const num = Number(str);
            if (!isNaN(num)) {
                // For EAN-13, precision is safe. 
                // We use floor to handle any accidental decimals.
                str = BigInt(Math.floor(num)).toString();
            }
        } catch (e) {
            // Fallback to original string if BigInt fails
        }
    }
    
    // Strip all non-numeric characters
    return str.replace(/\D/g, '');
}

function encodeSGTIN96(barcode, serial, filter = 1, partition = 5) {
    try {
        const header = 0x30;
        const filterVal = parseInt(filter) & 0x07;
        const partitionVal = parseInt(partition) & 0x07;
        const part = PARTITIONS[String(partition)] || PARTITIONS['5'];

        const cleanB = cleanBarcode(barcode);
        if (!cleanB) return 'ERROR:EMPTY';
        
        const gtin14 = cleanB.padStart(14, '0');
        const indicator = gtin14[0];
        const companyPrefix = gtin14.substring(1, 8);
        const itemRef = indicator + gtin14.substring(8, 13);

        const companyPrefixVal = BigInt(companyPrefix);
        const itemRefVal = BigInt(itemRef);
        const serialVal = BigInt(serial);

        // Validation
        if (serialVal >= (1n << 38n)) return 'ERROR:SERIAL_TOO_LARGE';
        if (companyPrefixVal >= (1n << BigInt(part.bits_m))) return 'ERROR:PREFIX_TOO_LARGE';

        let epcBinary = header.toString(2).padStart(8, '0');
        epcBinary += filterVal.toString(2).padStart(3, '0');
        epcBinary += partitionVal.toString(2).padStart(3, '0');
        epcBinary += companyPrefixVal.toString(2).padStart(part.bits_m, '0');
        epcBinary += itemRefVal.toString(2).padStart(part.bits_n, '0');
        epcBinary += serialVal.toString(2).padStart(38, '0');

        if (epcBinary.length !== 96) {
            console.error('Invalid EPC Binary Length:', epcBinary.length);
            return 'ERROR:LENGTH';
        }

        let epcHex = '';
        for (let i = 0; i < epcBinary.length; i += 4) {
            epcHex += parseInt(epcBinary.substring(i, i + 4), 2).toString(16).toUpperCase();
        }
        return epcHex;
    } catch (e) {
        console.error('EPC Encoding Error:', e);
        return 'ERROR:EXCEPTION';
    }
}

const DEFAULT_SERIAL_START = 274655906933n;
const DEFAULT_SERIAL_END = 274675906933n;
const LOW_THRESHOLD = 100000;

export default function RFIDFormat() {
    const { isSidebarCollapsed } = useUIStore();
    const [formData, setFormData] = useState({
        filter: '1',
        partition: '5',
        lockBits: '0',
        head: '48',
    });

    const [importedData, setImportedData] = useState([]);
    const [serialStart, setSerialStart] = useState(DEFAULT_SERIAL_START);
    const [serialEnd, setSerialEnd] = useState(DEFAULT_SERIAL_END);
    const [currentSerial, setCurrentSerial] = useState(DEFAULT_SERIAL_START);
    const [usedSerials, setUsedSerials] = useState(0n);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [previewEPC, setPreviewEPC] = useState('');
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetPassInput, setResetPassInput] = useState('');
    const [isRangeUnlocked, setIsRangeUnlocked] = useState(false);
    const [showRangeUnlockModal, setShowRangeUnlockModal] = useState(false);
    const [rangePassInput, setRangePassInput] = useState('');

    const fetchConfig = async () => {
        try {
            const res = await rfidAPI.getConfig();
            const data = res.data;
            setSerialStart(BigInt(data.serialStart));
            setSerialEnd(BigInt(data.serialEnd));
            setCurrentSerial(BigInt(data.currentSerial));
            setUsedSerials(BigInt(data.usedSerials));
            setFormData({
                filter: data.filter,
                partition: data.partition,
                lockBits: data.lockBits,
                head: data.head
            });
        } catch (err) {
            toast.error('Failed to load RFID configuration');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfig(); }, []);

    const saveConfig = async (overrideData = {}) => {
        try {
            const payload = {
                serialStart: serialStart.toString(),
                serialEnd: serialEnd.toString(),
                currentSerial: currentSerial.toString(),
                usedSerials: usedSerials.toString(),
                ...formData,
                ...overrideData
            };
            await rfidAPI.updateConfig(payload);
        } catch (err) {
            toast.error('Failed to save RFID configuration');
        }
    };

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


    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

                if (json.length > 0) {
                    console.log('First row of imported data:', json[0]);
                }

                const mapped = json.map(row => {
                    // Normalize keys to find columns regardless of case/spaces
                    const findVal = (names) => {
                        const key = Object.keys(row).find(k => 
                            names.includes(k.trim().toLowerCase())
                        );
                        return key ? row[key] : null;
                    };

                    const barcode = String(findVal(['ean', 'barcode', 'item barcode', 'ean no', 'ean13']) || '').trim();
                    const qtyVal = findVal(['final qty', 'qty', 'quantity', 'count', 'total qty']);
                    const qty = parseInt(String(qtyVal || 0).replace(/,/g, ''));

                    return { barcode, qty };
                }).filter(r => r.barcode && !isNaN(r.qty) && r.qty > 0);

                console.log(`Successfully mapped ${mapped.length} rows from ${json.length} rows in Excel.`);

                if (mapped.length === 0) {
                    console.warn('Import resulted in 0 rows. JSON sample:', json.slice(0, 2));
                    toast.error('No valid rows found. Check column headers (EAN, Qty).');
                    return;
                }

                const totalNeeded = mapped.reduce((s, r) => s + r.qty, 0);
                const remaining = Number(serialEnd - currentSerial + 1n);
                
                if (totalNeeded > remaining) {
                    toast.error(`Insufficient range! Need ${totalNeeded.toLocaleString()}, have ${remaining.toLocaleString()}.`, { duration: 6000 });
                }

                setImportedData(mapped);
                toast.success(`Loaded ${mapped.length} rows (${totalNeeded.toLocaleString()} total labels)`);
            } catch (err) {
                console.error('Import Error:', err);
                toast.error('Import failed: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    };

    const handleExport = async () => {
        if (importedData.length === 0) return toast.error('Please load an Excel file first');
        
        const totalNeeded = importedData.reduce((s, r) => s + r.qty, 0);
        const remaining = Number(serialEnd - currentSerial + 1n);
        
        if (totalNeeded > remaining) {
            return toast.error(`Insufficient range! Need ${totalNeeded.toLocaleString()} serials, but only ${remaining.toLocaleString()} remaining.`, { duration: 5000 });
        }

        // Safety limit to prevent browser crash (OOM)
        if (totalNeeded > 100000) {
            return toast.error('Batch size too large! Please limit to 100,000 labels per export to prevent browser crash.', { duration: 6000 });
        }

        setGenerating(true);
        const toastId = toast.loading(`Generating ${totalNeeded.toLocaleString()} EPC codes...`);

        setTimeout(async () => {
            try {
                const fileName = `RFID_EPC_${new Date().toISOString().split('T')[0]}_${Date.now()}.xlsx`;
                const allRows = [];
                let serial = currentSerial;
                let idCounter = 1;

                for (const item of importedData) {
                    for (let i = 0; i < item.qty; i++) {
                        allRows.push({
                            ID: idCounter++,
                            Barcode: item.barcode,
                            EPC: encodeSGTIN96(item.barcode, serial, formData.filter, formData.partition),
                            TID: '', 
                            'User Mem': '',
                            LockBits: parseInt(formData.lockBits) || 0,
                            KillCode: '', AccessCode: '', RSSI: '', DIST: '', Time: '', Status: '',
                            SKU: 'A001', 
                            FN: `C:\\Downloads\\${fileName}`
                        });
                        serial += 1n;
                    }
                }

                if (allRows.length === 0) {
                    console.error('No rows generated. importedData:', importedData);
                    toast.error('No labels generated. Check if your quantity values are correct.', { id: toastId });
                    setGenerating(false);
                    return;
                }

                console.log(`Generating AOA sheet with ${allRows.length} rows...`);
                
                const headers = ["ID", "Barcode", "EPC", "TID", "User Mem", "LockBits", "KillCode", "AccessCode", "RSSI", "DIST", "Time", "Status", "SKU", "FN"];
                const dataAOA = [headers];
                
                for (const row of allRows) {
                    dataAOA.push([
                        row.ID, row.Barcode, row.EPC, row.TID, row['User Mem'], 
                        row.LockBits, row.KillCode, row.AccessCode, row.RSSI, 
                        row.DIST, row.Time, row.Status, row.SKU, row.FN
                    ]);
                }

                const ws = XLSX.utils.aoa_to_sheet(dataAOA);
                
                // Force columns to be visible and set widths
                ws['!cols'] = [
                    { w: 10, hidden: false }, // ID
                    { w: 20, hidden: false }, // Barcode
                    { w: 35, hidden: false }, // EPC
                    { w: 15, hidden: false }, // TID
                    { w: 15, hidden: false }, // User Mem
                    { w: 12, hidden: false }, // LockBits
                    { w: 12, hidden: false }, // KillCode
                    { w: 12, hidden: false }, // AccessCode
                    { w: 10, hidden: false }, // RSSI
                    { w: 10, hidden: false }, // DIST
                    { w: 15, hidden: false }, // Time
                    { w: 12, hidden: false }, // Status
                    { w: 12, hidden: false }, // SKU
                    { w: 60, hidden: false }  // FN
                ];
                
                // Generate ONLY CSV as requested
                const csvContent = XLSX.utils.sheet_to_csv(ws);
                const csvFileName = fileName.replace('.xlsx', '.csv');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", csvFileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                const newCurrent = serial;
                const newUsed = usedSerials + BigInt(totalNeeded);

                setCurrentSerial(newCurrent);
                setUsedSerials(newUsed);

                await saveConfig({
                    currentSerial: newCurrent.toString(),
                    usedSerials: newUsed.toString()
                });

                toast.success(`Successfully generated ${allRows.length} EPC codes`, { id: toastId });
            } catch (err) {
                console.error('Export Error:', err);
                toast.error('Export failed. Check console for details.', { id: toastId });
            } finally {
                setGenerating(false);
            }
        }, 100);
    };

    const handleReset = async () => {
        if (resetPassInput !== 'sara@1234') {
            toast.error('Invalid admin password');
            return;
        }
        
        const newCurrent = serialStart;
        const newUsed = 0n;
        
        setCurrentSerial(newCurrent);
        setUsedSerials(newUsed);
        
        await saveConfig({
            currentSerial: newCurrent.toString(),
            usedSerials: newUsed.toString()
        });
        
        toast.success('Serial usage reset successfully');
        setShowResetModal(false);
        setResetPassInput('');
    };

    const handleUnlockRange = () => {
        if (rangePassInput === 'sara@1234') {
            setIsRangeUnlocked(true);
            setShowRangeUnlockModal(false);
            setRangePassInput('');
            toast.success('Range editing unlocked');
        } else {
            toast.error('Invalid admin password');
        }
    };

    const s = {
        page: { minHeight: '100vh', background: '#f8fafc', color: '#1e293b', padding: '24px' },
        header: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px' },
        card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' },
        cardTitle: { fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' },
        btnPrimary: { background: '#f97316', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
        btnSecondary: { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
        stat: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' },
        input: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontWeight: 600, color: '#334155' },
        label: { fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' },
        btnDanger: { background: '#fff', color: '#ef4444', border: '1px solid #fecaca', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
    };

    const remaining = Number(serialEnd - currentSerial + 1n);
    const total = Number(serialEnd - serialStart + 1n);
    const pct = Math.max(0, Math.min(100, (remaining / (total || 1)) * 100));

    if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={s.page}>
                <div style={s.header}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>RFID Format Configuration</h1>
                        <p style={{ color: '#64748b', margin: '4px 0 0' }}>Configure SGTIN-96 parameters & track serial usage</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={s.btnDanger} onClick={() => setShowResetModal(true)}><RefreshCw size={18} /> Reset Count</button>
                        <button style={s.btnSecondary} onClick={fetchConfig}><RefreshCw size={18} /> Refresh</button>
                        <button style={s.btnPrimary} onClick={() => {
                            saveConfig();
                            setIsRangeUnlocked(false);
                            toast.success('Changes saved and range locked');
                        }}><Save size={18} /> Save Changes</button>
                    </div>
                </div>

                {showRangeUnlockModal && (
                    <div className="ap-modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
                    }}>
                        <div className="ap-modal-content" style={{
                            background: 'white', padding: '24px', borderRadius: '16px',
                            width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, color: '#f97316', fontWeight: 800 }}>Unlock Range Configuration</h3>
                                <button onClick={() => { setShowRangeUnlockModal(false); setRangePassInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                                Modifying the serial range is a sensitive action. Please enter the admin password to continue.
                            </p>
                            <input 
                                type="password" 
                                style={{ ...s.input, marginBottom: '20px' }}
                                placeholder="Enter Admin Password" 
                                value={rangePassInput}
                                onChange={(e) => setRangePassInput(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlockRange()}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button style={s.btnSecondary} onClick={() => { setShowRangeUnlockModal(false); setRangePassInput(''); }}>Cancel</button>
                                <button style={s.btnPrimary} onClick={handleUnlockRange}>Unlock Range</button>
                            </div>
                        </div>
                    </div>
                )}

                {showResetModal && (
                    <div className="ap-modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000
                    }}>
                        <div className="ap-modal-content" style={{
                            background: 'white', padding: '24px', borderRadius: '16px',
                            width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, color: '#ef4444', fontWeight: 800 }}>Reset Serial Count</h3>
                                <button onClick={() => { setShowResetModal(false); setResetPassInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' }}>
                                This will reset the used count and return current serial to <b>{serialStart.toString()}</b>. Enter admin password to confirm.
                            </p>
                            <input 
                                type="password" 
                                style={{ ...s.input, marginBottom: '20px' }}
                                placeholder="Enter Admin Password" 
                                value={resetPassInput}
                                onChange={(e) => setResetPassInput(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button style={s.btnSecondary} onClick={() => { setShowResetModal(false); setResetPassInput(''); }}>Cancel</button>
                                <button style={{ ...s.btnPrimary, background: '#ef4444' }} onClick={handleReset}>Confirm Reset</button>
                            </div>
                        </div>
                    </div>
                )}


                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
                    <div style={s.stat}>
                        <span style={s.label}>CURRENT SERIAL</span>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#f97316', fontFamily: 'monospace' }}>{currentSerial.toString()}</div>
                    </div>
                    <div style={s.stat}>
                        <span style={s.label}>REMAINING</span>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: remaining < LOW_THRESHOLD ? '#ef4444' : '#10b981' }}>{remaining.toLocaleString()}</div>
                    </div>
                    <div style={s.stat}>
                        <span style={s.label}>USED EPC</span>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#334155' }}>{Number(usedSerials).toLocaleString()}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={s.card}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={s.cardTitle}><Hash size={20} color="#f97316" /> Range Configuration</h3>
                                {!isRangeUnlocked ? (
                                    <button 
                                        onClick={() => setShowRangeUnlockModal(true)}
                                        style={{ ...s.btnSecondary, padding: '6px 12px', fontSize: '12px', background: '#fff7ed', color: '#f97316', borderColor: '#ffedd5' }}
                                    >
                                        Unlock to Edit
                                    </button>
                                ) : (
                                    <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <CheckCircle size={14} /> Editing Enabled
                                    </span>
                                )}
                            </div>
                            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <label style={s.label}>START SERIAL</label>
                                    <input 
                                        style={{ ...s.input, cursor: !isRangeUnlocked ? 'not-allowed' : 'text', opacity: !isRangeUnlocked ? 0.7 : 1 }} 
                                        value={serialStart.toString()} 
                                        onChange={e => isRangeUnlocked && setSerialStart(BigInt(e.target.value.replace(/\D/g,'')))} 
                                        readOnly={!isRangeUnlocked}
                                        onClick={() => !isRangeUnlocked && setShowRangeUnlockModal(true)}
                                    />
                                </div>
                                <div>
                                    <label style={s.label}>END SERIAL</label>
                                    <input 
                                        style={{ ...s.input, cursor: !isRangeUnlocked ? 'not-allowed' : 'text', opacity: !isRangeUnlocked ? 0.7 : 1 }} 
                                        value={serialEnd.toString()} 
                                        onChange={e => isRangeUnlocked && setSerialEnd(BigInt(e.target.value.replace(/\D/g,'')))} 
                                        readOnly={!isRangeUnlocked}
                                        onClick={() => !isRangeUnlocked && setShowRangeUnlockModal(true)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={s.card}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={s.cardTitle}><Settings size={20} color="#f97316" /> SGTIN-96 Parameters</h3>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                    {['head', 'filter', 'partition', 'lockBits'].map(f => (
                                        <div key={f}><label style={s.label}>{f.toUpperCase()}</label><input style={s.input} name={f} value={formData[f]} onChange={handleChange} /></div>
                                    ))}
                                </div>
                                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px', border: '1px dashed #cbd5e1' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontWeight: 700 }}>Excel Data Source</h4>
                                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Upload EAN & Quantity template</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px' }}>
                                            <input type="file" id="up" hidden onChange={handleImport} />
                                            <button style={s.btnSecondary} onClick={() => document.getElementById('up').click()}><Upload size={18} /> Load Excel</button>
                                            <button style={{ ...s.btnPrimary, opacity: generating ? 0.7 : 1 }} onClick={handleExport} disabled={generating}>
                                                {generating ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />} Generate EPC
                                            </button>
                                        </div>
                                    </div>
                                    {importedData.length > 0 && <div style={{ marginTop: '16px', color: '#10b981', fontWeight: 700 }}>✓ {importedData.length} rows loaded</div>}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={s.card}>
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={s.cardTitle}><Play size={20} color="#f97316" /> Live Preview</h3>
                            </div>
                            <div style={{ padding: '20px' }}>
                                <label style={s.label}>GENERATED EPC (HEX)</label>
                                <div style={{ background: '#0f172a', color: '#fb923c', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all', letterSpacing: '1px', marginBottom: '16px', border: '2px solid #334155' }}>
                                    {previewEPC || 'Import Excel to Preview'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={s.label}>Scheme</span><span style={{ fontWeight: 700 }}>SGTIN-96</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={s.label}>Partition</span><span style={{ fontWeight: 700 }}>{formData.partition}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={s.label}>Filter</span><span style={{ fontWeight: 700 }}>{formData.filter}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}