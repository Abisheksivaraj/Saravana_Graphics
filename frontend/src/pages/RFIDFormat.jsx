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

const DEFAULT_SERIAL_START = 274655906933n;
const DEFAULT_SERIAL_END   = 274675906933n;
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
    const [alert, setAlert] = useState(null);
    const [previewEPC, setPreviewEPC] = useState('');

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

    const showAlert = (type, message) => {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 6000);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = evt.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

                const mapped = json.map(row => ({
                    barcode: String(row['EAN'] || row['Barcode'] || row['barcode'] || '').trim(),
                    qty: parseInt(row['Final qty'] || row['Final Qty'] || row['Qty'] || row['qty'] || 0),
                })).filter(r => r.barcode && !isNaN(r.qty) && r.qty > 0);

                if (mapped.length === 0) {
                    showAlert('error', 'No valid rows found (EAN and Final qty required).');
                    return;
                }

                const totalNeeded = mapped.reduce((s, r) => s + r.qty, 0);
                const remaining = Number(serialEnd - currentSerial + 1n);
                if (totalNeeded > remaining) {
                    showAlert('error', `Insufficient serial numbers! Need ${totalNeeded.toLocaleString()}.`);
                }

                setImportedData(mapped);
                showAlert('success', `Loaded ${mapped.length} rows (Total: ${totalNeeded.toLocaleString()})`);
            } catch (err) {
                showAlert('error', 'Import failed: ' + err.message);
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleExport = async () => {
        if (importedData.length === 0) return showAlert('error', 'Load Excel first');
        const totalNeeded = importedData.reduce((s, r) => s + r.qty, 0);
        const remaining = Number(serialEnd - currentSerial + 1n);
        if (totalNeeded > remaining) return showAlert('error', 'Insufficient range');

        setGenerating(true);
        setTimeout(async () => {
            try {
                const fileName = `RFID_EPC_${Date.now()}.xlsx`;
                const allRows = [];
                let serial = currentSerial;
                let idCounter = 1;

                importedData.forEach(item => {
                    for (let i = 0; i < item.qty; i++) {
                        allRows.push({
                            ID: idCounter++,
                            Barcode: item.barcode,
                            EPC: encodeSGTIN96(item.barcode, serial, formData.filter, formData.partition),
                            TID: '', 'User Mem': '',
                            LockBits: parseInt(formData.lockBits) || 0,
                            KillCode: '', AccessCode: '', RSSI: '', DIST: '', Time: '', Status: '',
                            SKU: 'A001', FN: `C:\\Downloads\\${fileName}`
                        });
                        serial--;
                    }
                });

                const ws = XLSX.utils.json_to_sheet(allRows);
                ws['!cols'] = [{ w: 6 }, { w: 16 }, { w: 28 }, { w: 10 }, { w: 10 }, { w: 10 }, { w: 10 }, { w: 12 }, { w: 8 }, { w: 8 }, { w: 10 }, { w: 8 }, { w: 8 }, { w: 46 }];
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'EPC');
                XLSX.writeFile(wb, fileName);

                const newCurrent = serial;
                const newUsed = usedSerials + BigInt(totalNeeded);
                
                setCurrentSerial(newCurrent);
                setUsedSerials(newUsed);
                
                await saveConfig({
                    currentSerial: newCurrent.toString(),
                    usedSerials: newUsed.toString()
                });

                showAlert('success', `Generated ${allRows.length} EPC codes`);
            } catch (err) {
                showAlert('error', 'Export failed');
            } finally {
                setGenerating(false);
            }
        }, 100);
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
        label: { fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'block' }
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
                        <button style={s.btnSecondary} onClick={fetchConfig}><RefreshCw size={18} /> Refresh</button>
                        <button style={s.btnPrimary} onClick={() => saveConfig()}><Save size={18} /> Save Changes</button>
                    </div>
                </div>

                {alert && (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', background: alert.type === 'error' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${alert.type === 'error' ? '#fecaca' : '#bbf7d0'}`, color: alert.type === 'error' ? '#991b1b' : '#166534', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {alert.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                        {alert.message}
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
                            <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9' }}>
                                <h3 style={s.cardTitle}><Hash size={20} color="#f97316" /> Range Configuration</h3>
                            </div>
                            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div><label style={s.label}>START SERIAL</label><input style={s.input} value={serialStart.toString()} onChange={e => setSerialStart(BigInt(e.target.value.replace(/\D/g,'')))} /></div>
                                <div><label style={s.label}>END SERIAL</label><input style={s.input} value={serialEnd.toString()} onChange={e => setSerialEnd(BigInt(e.target.value.replace(/\D/g,'')))} /></div>
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