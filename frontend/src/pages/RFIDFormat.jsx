import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Cpu, Save, Play, FileJson, Settings, Info, RefreshCw, Barcode, Hash
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import Sidebar from '../components/Sidebar';
import * as XLSX from 'xlsx';
import './RFIDFormat.css';

const PARTITIONS = {
    '0': { p: 0, m: 40, n: 4, l: 12, digits_m: 12, digits_n: 1 },
    '1': { p: 1, m: 37, n: 7, l: 11, digits_m: 11, digits_n: 2 },
    '2': { p: 2, m: 34, n: 10, l: 10, digits_m: 10, digits_n: 3 },
    '3': { p: 3, m: 30, n: 14, l: 9, digits_m: 9, digits_n: 4 },
    '4': { p: 4, m: 27, n: 17, l: 8, digits_m: 8, digits_n: 5 },
    '5': { p: 5, m: 24, n: 20, l: 7, digits_m: 7, digits_n: 6 },
    '6': { p: 6, m: 20, n: 24, l: 6, digits_m: 6, digits_n: 7 }
};

export default function RFIDFormat() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const [formData, setFormData] = useState({
        barcode: '8909393777693',
        serialStart: '0000000000',
        qty: '2500',
        head: '48',
        filter: '1',
        partition: '5',
        lockBits: '0',
        mstKey: '',
        fn: 'test ts 01',
        sku: '8909393777693',
        orderQty: '100'
    });

    const [importedData, setImportedData] = useState([]);
    const [generating, setGenerating] = useState(false);
    const { isSidebarCollapsed } = useUIStore();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const encodeSGTIN96 = (barcode, serial, filter = 1, partition = 5) => {
        try {
            const header = 0x30; // 8 bits
            const filterVal = parseInt(filter) & 0x07; // 3 bits
            const partitionVal = parseInt(partition) & 0x07; // 3 bits

            // For partition 5: Company Prefix is 7 digits, Item Ref is 6 digits
            // Barcode 8909393777693 -> Prefix: 8909393, Item: 77769
            // SGTIN-96 uses GTIN-14. 8909393777693 -> 08909393777693
            const gtin14 = barcode.padStart(14, '0');
            const indicator = gtin14[0];
            const companyPrefix = gtin14.substring(1, 8);
            const itemRef = indicator + gtin14.substring(8, 13);

            const companyPrefixVal = BigInt(companyPrefix);
            const itemRefVal = BigInt(itemRef);
            const serialVal = BigInt(serial);

            // Construct 96-bit binary string (simplified representation)
            // Header (8) | Filter (3) | Partition (3) | Company Prefix (24) | Item Ref (20) | Serial (38)
            let epcBinary = header.toString(2).padStart(8, '0');
            epcBinary += filterVal.toString(2).padStart(3, '0');
            epcBinary += partitionVal.toString(2).padStart(3, '0');
            epcBinary += companyPrefixVal.toString(2).padStart(24, '0');
            epcBinary += itemRefVal.toString(2).padStart(20, '0');
            epcBinary += serialVal.toString(2).padStart(38, '0');

            // Convert to Hex
            let epcHex = '';
            for (let i = 0; i < epcBinary.length; i += 4) {
                epcHex += parseInt(epcBinary.substring(i, i + 4), 2).toString(16).toUpperCase();
            }
            return epcHex;
        } catch (e) {
            console.error("Encoding error", e);
            return "ERROR";
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = evt.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(sheet);

            // Expected columns: Barcode, SerialStart, Qty
            const mapped = json.map(row => ({
                barcode: String(row.Barcode || row.barcode || ''),
                serialStart: parseInt(row.SerialStart || row.serialstart || 1),
                qty: parseInt(row.Qty || row.qty || 1)
            })).filter(r => r.barcode && !isNaN(r.qty));

            setImportedData(mapped);
            if (mapped.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    barcode: mapped[0].barcode,
                    serialStart: String(mapped[0].serialStart).padStart(10, '0'),
                    qty: String(mapped[0].qty)
                }));
            }
            toast.success(`Imported ${mapped.length} rows`);
        };
        reader.readAsBinaryString(file);
    };

    const handleExport = () => {
        if (importedData.length === 0) {
            // If no imported data, just generate for current form
            const rows = [];
            const start = parseInt(formData.serialStart);
            const qty = parseInt(formData.qty);
            for (let i = 0; i < qty; i++) {
                const s = start + i;
                rows.push({
                    Barcode: formData.barcode,
                    SerialNumber: s,
                    EPC: encodeSGTIN96(formData.barcode, s, formData.filter, formData.partition)
                });
            }
            downloadExcel(rows);
            return;
        }

        setGenerating(true);
        const allData = [];
        importedData.forEach(item => {
            for (let i = 0; i < item.qty; i++) {
                const s = item.serialStart + i;
                allData.push({
                    Barcode: item.barcode,
                    SerialNumber: s,
                    EPC: encodeSGTIN96(item.barcode, s, formData.filter, formData.partition)
                });
            }
        });

        downloadExcel(allData);
        setGenerating(false);
    };

    const downloadExcel = (data) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "EPC_Data");
        XLSX.writeFile(workbook, `RFID_Export_${new Date().getTime()}.xlsx`);
        toast.success("Export complete!");
    };

    return (
        <div className={`rfid-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />

            <main className="db-main">
                <div className="db-header">
                    <div>
                        <h1>RFID Format Configuration</h1>
                        <p>Configure SGTIN-96 RFID tag encoding parameters</p>
                    </div>
                    <div className="db-header-actions">
                        <button className="btn btn-secondary">
                            <RefreshCw size={16} /> Reset
                        </button>
                        <button className="btn btn-primary">
                            <Save size={16} /> Save Format
                        </button>
                    </div>
                </div>

                <div className="rfid-container">
                    <div className="rfid-grid">
                        {/* Primary Encoding Panel */}
                        <div className="rfid-card main-panel">
                            <div className="rfid-card-header">
                                <Settings size={18} className="text-primary" />
                                <h3>SGTIN-96 Data Source</h3>
                            </div>
                            <div className="rfid-card-body">
                                <div className="form-sections">
                                    <div className="form-group-row">
                                        <div className="form-group flex-1">
                                            <label>Barcode</label>
                                            <div className="input-with-icon">
                                                <Barcode size={16} />
                                                <input
                                                    type="text"
                                                    name="barcode"
                                                    value={formData.barcode}
                                                    onChange={handleChange}
                                                    placeholder="Enter Barcode"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group flex-1">
                                            <label>Serial Start</label>
                                            <div className="input-with-icon">
                                                <Hash size={16} />
                                                <input
                                                    type="text"
                                                    name="serialStart"
                                                    value={formData.serialStart}
                                                    onChange={handleChange}
                                                    placeholder="0000000000"
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group sixty-px">
                                            <label>Qty</label>
                                            <input
                                                type="number"
                                                name="qty"
                                                value={formData.qty}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="divider"></div>

                                    <div className="sgtin-params">
                                        <h4>Standard Parameters</h4>
                                        <div className="params-grid">
                                            <div className="form-group">
                                                <label>Head</label>
                                                <input type="text" name="head" value={formData.head} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Filter</label>
                                                <input type="text" name="filter" value={formData.filter} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>Partition</label>
                                                <input type="text" name="partition" value={formData.partition} onChange={handleChange} />
                                            </div>
                                            <div className="form-group">
                                                <label>LockBits</label>
                                                <input type="text" name="lockBits" value={formData.lockBits} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="form-group-row mt-4">
                                        <div className="form-group">
                                            <label>SKU</label>
                                            <input type="text" name="sku" value={formData.sku} onChange={handleChange} />
                                        </div>
                                        <div className="form-group">
                                            <label>Order Qty</label>
                                            <input type="text" name="orderQty" value={formData.orderQty} onChange={handleChange} />
                                        </div>
                                    </div>

                                    <div className="excel-actions-row mt-6">
                                        <div className="field-group flex-1">
                                            <span className="field-label">Field Name: Barcode, SerialStart, Qty</span>
                                            <div className="field-inputs">
                                                <input type="text" readOnly value="Barcode" className="mini-input" />
                                                <input type="text" readOnly value="SerialStart" className="mini-input" />
                                                <input type="text" readOnly value="Qty" className="mini-input" />
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <input
                                                type="file"
                                                id="excel-upload"
                                                hidden
                                                accept=".xlsx, .xls"
                                                onChange={handleImport}
                                            />
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => document.getElementById('excel-upload').click()}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                <FileJson size={16} /> Load Excel Generation
                                            </button>
                                            <button
                                                className="btn btn-primary shadow-lg shadow-primary/20"
                                                onClick={handleExport}
                                                disabled={generating}
                                                style={{ whiteSpace: 'nowrap' }}
                                            >
                                                {generating ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                                {generating ? 'Export Excel' : 'Data Generation'}
                                            </button>
                                        </div>
                                    </div>

                                    {importedData.length > 0 && (
                                        <div className="imported-preview mt-4">
                                            <div className="preview-header">
                                                <h4>Imported Excel Data ({importedData.length} entries)</h4>
                                                <button className="btn btn-ghost btn-icon" onClick={() => setImportedData([])}>✕</button>
                                            </div>
                                            <div className="preview-table-container">
                                                <table className="preview-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Barcode</th>
                                                            <th>Serial Start</th>
                                                            <th>Qty</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importedData.slice(0, 5).map((row, i) => (
                                                            <tr key={i}>
                                                                <td>{row.barcode}</td>
                                                                <td>{row.serialStart}</td>
                                                                <td>{row.qty}</td>
                                                            </tr>
                                                        ))}
                                                        {importedData.length > 5 && (
                                                            <tr>
                                                                <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                                                    + {importedData.length - 5} more rows
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

                        {/* Preview / Secondary Panel */}
                        <div className="rfid-card side-panel">
                            <div className="rfid-card-header">
                                <Play size={18} className="text-success" />
                                <h3>Encoding Preview</h3>
                            </div>
                            <div className="rfid-card-body">
                                <div className="encoding-preview">
                                    <div className="preview-label">Generated EPC (Hex)</div>
                                    <div className="epc-box">
                                        3074257BF400000000000001
                                    </div>
                                    <div className="preview-details">
                                        <div className="detail-item">
                                            <span>Scheme</span>
                                            <span>SGTIN-96</span>
                                        </div>
                                        <div className="detail-item">
                                            <span>Company Prefix</span>
                                            <span>8909393</span>
                                        </div>
                                        <div className="detail-item">
                                            <span>Item Reference</span>
                                            <span>77769</span>
                                        </div>
                                        <div className="detail-item">
                                            <span>Serial Number</span>
                                            <span>1</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="sgtin-params">
                                        <h4>Encoding Options</h4>
                                        <div className="option-row">
                                            <input type="checkbox" id="lock-epc" defaultChecked />
                                            <label htmlFor="lock-epc" style={{ textTransform: 'none', margin: 0 }}>Lock EPC Memory</label>
                                        </div>
                                        <div className="option-row">
                                            <input type="checkbox" id="verify-tid" />
                                            <label htmlFor="verify-tid" style={{ textTransform: 'none', margin: 0 }}>Verify TID</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="info-section">
                        <div className="info-card">
                            <Info size={16} />
                            <p>SGTIN-96 (Serialized Global Trade Item Number) is used to identify individual trade items. It consists of a Header, Filter, Partition, Company Prefix, Item Reference, and Serial Number.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
