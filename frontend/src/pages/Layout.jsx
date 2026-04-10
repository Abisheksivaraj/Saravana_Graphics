import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Layers, FileSpreadsheet, ListChecks, Eye, Download, 
    ArrowLeft, Search, RefreshCw, CheckCircle2, AlertCircle,
    Table, Wand2, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { templatesAPI, designsAPI } from '../api';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import BarcodeElement from '../components/BarcodeElement';
import QRElement from '../components/QRElement';
import ImageElement from '../components/ImageElement';
import './Layout.css';

// Component to render a single label within the grid
const LayoutLabel = ({ elements = [], data = {}, mapping = {}, x, y, width, height }) => {
    // Merge template elements with Excel data based on mappings
    const mergedElements = useMemo(() => {
        if (!elements) return [];
        
        let sizeElement = null;
        
        // Pass 1: Handle data merging and identify "Size" header
        const processed = elements.map(el => {
            const mappedColumn = mapping[el.id];
            let newEl = { ...el };
            
            if (mappedColumn && data[mappedColumn] !== undefined) {
                const val = String(data[mappedColumn]);
                if (el.type === 'text') {
                    // Handle special case for Price/MRP prefixing
                    if ((el.text || '').includes('₹') && !val.includes('₹')) {
                        newEl.text = `₹${val}`;
                    } else {
                        newEl.text = val;
                    }
                    
                    // FEATURE: Automatic Header Size for "Size" column
                    if (mappedColumn.toLowerCase().includes('size')) {
                        newEl.fontSize = Math.max(el.fontSize || 14, 42); // Bump to header size
                        newEl.fontWeight = '900';
                        sizeElement = newEl;
                    }
                }
                if (el.type === 'barcode') newEl.barcodeValue = val;
                if (el.type === 'qrcode') newEl.qrValue = val;
            }
            return newEl;
        });

        // Pass 2: Close gaps for "cm", "M", etc. if a Size header exists
        if (sizeElement) {
            let currentOffset = (sizeElement.text || '').length * (sizeElement.fontSize * 0.55) + 12;
            
            // Sort suffixes by their original X position to keep order
            return processed.sort((a,b) => (a.x || 0) - (b.x || 0)).map(el => {
                // Find static text elements like "cm" or letter sizes
                const suffixes = ['cm', 'CM', 'M', 'L', 'XL', 'XXL', '3XL', 'XS'];
                if (el.type === 'text' && !mapping[el.id] && suffixes.includes(el.text)) {
                    // If the element is on roughly the same vertical line
                    if (Math.abs(el.y - sizeElement.y) < 40) {
                        const newX = sizeElement.x + currentOffset;
                        currentOffset += (el.text || '').length * (el.fontSize * 0.5) + 10;
                        return { 
                            ...el, 
                            x: newX,
                            y: sizeElement.y + (sizeElement.fontSize * 0.1) // Align towards baseline
                        };
                    }
                }
                return el;
            }).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        }

        return processed;
    }, [elements, data, mapping]);

    const sortedElements = useMemo(() => 
        [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    , [mergedElements]);

    return (
        <Group x={x} y={y}>
            <Rect width={width} height={height} fill="white" stroke="#e2e8f0" strokeWidth={1} />
            
            {sortedElements.map(el => {
                const commonProps = {
                    x: el.x, y: el.y,
                    rotation: el.rotation || 0,
                    scaleX: el.scaleX || 1, scaleY: el.scaleY || 1,
                    opacity: el.opacity !== undefined ? el.opacity : 1,
                    visible: el.visible !== false,
                };

                switch (el.type) {
                    case 'text':
                        return (
                            <Text key={el.id} {...commonProps}
                                text={el.text}
                                fontSize={el.fontSize}
                                fontFamily={el.fontFamily}
                                fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                align={el.textAlign || 'left'}
                                fill={el.fill}
                                width={el.width}
                                wrap="word"
                            />
                        );
                    case 'rect':
                        return <Rect key={el.id} {...commonProps} width={el.width} height={el.height} fill={el.fill} cornerRadius={el.cornerRadius} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
                    case 'barcode':
                        return <BarcodeElement key={el.id} {...commonProps} el={el} onSelect={() => {}} />;
                    case 'qrcode':
                        return <QRElement key={el.id} {...commonProps} el={el} onSelect={() => {}} />;
                    case 'image':
                        return <ImageElement key={el.id} {...commonProps} el={el} />;
                    default:
                        return null;
                }
            })}
        </Group>
    );
};

export default function Layout() {
    console.log('Rendering Layout Generator');
    const navigate = useNavigate();
    const { isSidebarCollapsed } = useUIStore();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [rawExcelData, setRawExcelData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [mapping, setMapping] = useState({});
    const [headerRowIndex, setHeaderRowIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportIndex, setExportIndex] = useState(-1);
    const stageRef = useRef();
    const hiddenStageRef = useRef();

    useEffect(() => {
        const fetchDesigns = async () => {
            try {
                setLoading(true);
                // Fetch designs instead of templates as requested
                const res = await designsAPI.getAll();
                console.log('Designs Response:', res?.data);
                setTemplates(res?.data?.designs || []);
            } catch (err) {
                console.error('Fetch Designs Error:', err);
                toast.error('Failed to load designs. Check backend.');
            } finally {
                setLoading(false);
            }
        };
        fetchDesigns();
    }, []);

    const handleMappingChange = (elId, colName) => {
        setMapping(prev => ({ ...prev, [elId]: colName }));
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // Step 1: Read raw array of arrays
                const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                
                // Step 2: Detect header row by scoring (search first 40 rows)
                let bestHeaderIndex = 0;
                let maxScore = -1;
                const headerKeywords = ['style', 'color', 'size', 'mrp', 'barcode', 'ean', 'epc', 'art', 'desc', 'qty', 'total', 'net', 'price'];
                
                for (let i = 0; i < Math.min(raw.length, 40); i++) {
                    const row = raw[i];
                    if (!row || !Array.isArray(row)) continue;
                    
                    const filledCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== "");
                    // Base score: 2 points per non-empty cell
                    let score = filledCells.length * 2;
                    
                    // Keyword bonus: 10 points per header-like word
                    filledCells.forEach(cell => {
                        const val = String(cell).toLowerCase();
                        if (headerKeywords.some(kw => val.includes(kw))) {
                            score += 10;
                        }
                    });

                    // Penalty for rows that look like data (mostly numbers)
                    const numberCount = filledCells.filter(cell => !isNaN(parseFloat(cell)) && isFinite(cell)).length;
                    if (numberCount > filledCells.length / 2 && filledCells.length > 3) {
                        score -= 5;
                    }
                    
                    if (score > maxScore) {
                        maxScore = score;
                        bestHeaderIndex = i;
                    }
                }
                
                const detectedHeaderIndex = bestHeaderIndex;
                if (maxScore <= 0) {
                    toast.error("Could not find a valid header row. Please ensure your Excel has column titles.");
                    return;
                }

                setRawExcelData(raw);
                processHeaderAndData(raw, detectedHeaderIndex);
            } catch (err) {
                console.error("Excel Parse Error:", err);
                toast.error("Failed to parse Excel file. Try a different format.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const processHeaderAndData = (raw, headerIdx) => {
        // Step 3: Extract headers and handle duplicates/empty strings
        const rawHeaders = raw[headerIdx];
        if (!rawHeaders) return;

        const finalHeaders = [];
        const headerIndices = [];
        const counts = {};
        
        rawHeaders.forEach((h, idx) => {
            let name = String(h || '').trim();
            if (!name) return;
            
            if (counts[name]) {
                counts[name]++;
                name = `${name}_${counts[name]}`;
            } else {
                counts[name] = 1;
            }
            finalHeaders.push(name);
            headerIndices.push({ name, index: idx });
        });

        // Step 4: Map data records using the discovered indices
        const dataRows = raw.slice(headerIdx + 1);
        const processedData = dataRows.map(row => {
            const obj = {};
            headerIndices.forEach(hi => {
                obj[hi.name] = row[hi.index];
            });
            return obj;
        }).filter(obj => 
            Object.values(obj).some(v => v !== null && v !== undefined && String(v).trim() !== "")
        );
        
        if (processedData.length > 0) {
            setExcelData(processedData);
            setColumns(finalHeaders);
            setHeaderRowIndex(headerIdx);
            toast.success(`Excel Loaded! Row ${headerIdx + 1} used as Header. Found ${finalHeaders.length} columns.`);
            
            if (selectedTemplate) {
                performAutoMapping(selectedTemplate, finalHeaders);
            }
        } else {
            toast.error("No data rows found below the selected header row.");
        }
    };

    const reparseWithHeader = (newIdx) => {
        if (rawExcelData.length > 0) {
            processHeaderAndData(rawExcelData, newIdx);
        }
    };

    const performAutoMapping = (template, cols) => {
        if (!template?.elements) return;
        const newMapping = {};
        template.elements.forEach(el => {
            if (!['text', 'barcode', 'qrcode'].includes(el.type)) return;

            const elText = (el.text || el.barcodeValue || el.qrValue || '').trim().toLowerCase();
            const elId = el.id;

            // 1. Exact Match (case-insensitive)
            let match = cols.find(col => col.trim().toLowerCase() === elText);

            // 2. Heuristic mapping
            if (!match) {
                match = cols.find(col => {
                    const c = col.trim().toLowerCase();
                    // Style/Article
                    if ((c.includes('style') || c.includes('article') || c.includes('art')) && 
                        (elText.includes('style') || elText.includes('art') || elText.includes('article'))) return true;
                    // Color
                    if ((c.includes('color') || c.includes('colour')) && 
                        (elText.includes('color') || elText.includes('colour'))) return true;
                    // Size
                    if (c.includes('size') && elText.includes('size')) return true;
                    // MRP/Price
                    if ((c.includes('mrp') || c.includes('price')) && 
                        (elText.includes('mrp') || elText.includes('price') || elText.includes('₹'))) return true;
                    // Barcode / EPC
                    if ((c.includes('barcode') || c.includes('ean') || c.includes('code') || c.includes('epc')) && 
                        (el.type === 'barcode' || elText.includes('barcode') || elText.includes('epc'))) return true;
                    // QR/Link
                    if ((c.includes('qr') || c.includes('url') || c.includes('link')) && 
                        (el.type === 'qrcode' || elText.includes('qr'))) return true;
                    // Description
                    if ((c.includes('desc') || c.includes('details')) && 
                        (elText.includes('desc') || elText.includes('details'))) return true;
                    // MFD/PKD
                    if ((c.includes('mfd') || c.includes('pkd') || c.includes('date')) && 
                        (elText.includes('mfd') || elText.includes('pkd'))) return true;
                    // Qty
                    if ((c.includes('qty') || c.includes('net')) && 
                        (elText.includes('qty') || elText.includes('net'))) return true;
                    
                    return false;
                });
            }

            if (match) newMapping[elId] = match;
        });

        setMapping(prev => ({ ...prev, ...newMapping }));
        if (Object.keys(newMapping).length > 0) {
            toast.success(`Auto-mapped ${Object.keys(newMapping).length} fields`);
        }
    };

    const handleSelectTemplate = async (designId) => {
        try {
            setLoading(true);
            // Fetch the full design with elements
            const res = await designsAPI.getById(designId);
            const fullDesign = res.data.design;
            setSelectedTemplate(fullDesign);
            if (columns.length > 0) {
                performAutoMapping(fullDesign, columns);
            }
        } catch (err) {
            console.error('Error fetching design details:', err);
            toast.error('Failed to load design details');
        } finally {
            setLoading(false);
        }
    };

    const downloadLayout = () => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const link = document.createElement('a');
        link.download = `Proof_Sheet_${new Date().getTime()}.png`;
        link.href = uri;
        link.click();
        toast.success('Image exported successfully!');
    };

    const downloadPDF = () => {
        if (!stageRef.current) return;
        
        try {
            toast.loading('Generating Proof PDF...', { id: 'pdf-gen' });
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            
            const pdf = new jsPDF({
                orientation: sheetWidth > sheetHeight ? 'l' : 'p',
                unit: 'px',
                format: [sheetWidth, sheetHeight]
            });

            pdf.addImage(uri, 'PNG', 0, 0, sheetWidth, sheetHeight);
            pdf.save(`Proof_Sheet_${new Date().getTime()}.pdf`);
            toast.success('Proof PDF exported!', { id: 'pdf-gen' });
        } catch (err) {
            console.error('PDF Export Error:', err);
            toast.error('Failed to generate PDF', { id: 'pdf-gen' });
        }
    };

    const downloadIndividualPDF = async () => {
        if (!selectedTemplate || excelData.length === 0) return;
        
        const toastId = toast.loading('Initializing Export...', { id: 'individual-pdf' });
        setIsExporting(true);
        setExportProgress(0);
        
        try {
            const pdf = new jsPDF({
                orientation: itemWidth > itemHeight ? 'l' : 'p',
                unit: 'px',
                format: [itemWidth, itemHeight]
            });

            // Process all records
            for (let i = 0; i < excelData.length; i++) {
                setExportIndex(i);
                setExportProgress(Math.round(((i + 1) / excelData.length) * 100));
                toast.loading(`Capturing Label ${i + 1} of ${excelData.length}...`, { id: 'individual-pdf' });
                
                // Allow time for React to render the hidden stage and for barcodes to generate
                await new Promise(resolve => setTimeout(resolve, 600)); 
                
                if (hiddenStageRef.current) {
                    const uri = hiddenStageRef.current.toDataURL({ pixelRatio: 2 });
                    pdf.addImage(uri, 'PNG', 0, 0, itemWidth, itemHeight);
                    
                    if (i < excelData.length - 1) {
                        pdf.addPage([itemWidth, itemHeight], itemWidth > itemHeight ? 'l' : 'p');
                    }
                }
            }

            pdf.save(`${selectedTemplate.title}_Labels_${new Date().getTime()}.pdf`);
            toast.success('Individual PDF Exported!', { id: 'individual-pdf' });
        } catch (err) {
            console.error('Individual PDF Error:', err);
            toast.error('Failed to export individual PDF', { id: 'individual-pdf' });
        } finally {
            setIsExporting(false);
            setExportIndex(-1);
        }
    };

    // Grid Settings
    const itemWidth = selectedTemplate?.canvasWidth || 350;
    const itemHeight = selectedTemplate?.canvasHeight || 700;
    const colsCount = 5;
    const spacing = 20;
    const marginSide = 50;
    const sheetWidth = (itemWidth + spacing) * colsCount + (marginSide * 2);
    // Dynamic height based on labels
    const rowCount = Math.ceil(Math.min(excelData.length, 10) / colsCount) || 1;
    const sheetHeight = (itemHeight + spacing) * rowCount + 250;

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />

            <main className="db-main">
                <div className="db-header">
                    <div className="flex items-center gap-4">
                        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}>
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h1>Layout Generator</h1>
                            <p>Generate high-quality proof sheets using Excel data</p>
                        </div>
                    </div>
                </div>

                <div className="layout-container">
                    <div className="layout-setup">
                        {/* 1. Template Selection */}
                        <div className="layout-card">
                            <h3><Layers size={18} className="text-primary" /> 1. Select Design</h3>
                            {loading && !templates.length ? (
                                <div className="flex items-center justify-center p-8">
                                    <RefreshCw className="animate-spin text-muted" size={24} />
                                </div>
                            ) : (
                                <div className="design-selector-dropdown">
                                    <select 
                                        className="select-input w-full"
                                        value={selectedTemplate?._id || ''}
                                        onChange={(e) => handleSelectTemplate(e.target.value)}
                                    >
                                        <option value="">-- Choose a Finished Design --</option>
                                        {templates.map(t => (
                                            <option key={t._id} value={t._id}>
                                                {t.title} ({t.category || 'General'})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted mt-2 px-1">
                                        <Info size={12} className="inline mr-1" />
                                        Select a finished template from your library
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 2. Excel Import */}
                        <div className="layout-card">
                            <h3><FileSpreadsheet size={18} className="text-success" /> 2. Import Excel</h3>
                            <div className="excel-uploader" onClick={() => document.getElementById('excel-input').click()}>
                                <input 
                                    type="file" 
                                    id="excel-input" 
                                    hidden 
                                    accept=".xlsx, .xls, .csv" 
                                    onChange={handleFileUpload} 
                                />
                                {excelData.length > 0 ? (
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <CheckCircle2 size={32} className="text-success" strokeWidth={3} />
                                        <span className="font-bold text-success">{excelData.length} records ready</span>
                                        <span className="text-xs text-muted">Headers detected in Row {headerRowIndex + 1}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success mb-2">
                                            <Download size={24} />
                                        </div>
                                        <span>Click to upload Excel data</span>
                                        <span className="text-xs text-muted">Supports title rows & multi-sheet files</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Raw Data Preview (for header selection) */}
                        {rawExcelData.length > 0 && (
                            <div className="layout-card">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="flex items-center gap-2"><Table size={18} /> Raw Excel Rows</h3>
                                    <span className="text-xs text-muted">Select the row containing your headers below</span>
                                </div>
                                <div className="data-table-container max-h-40 overflow-auto">
                                    <table className="data-table raw-preview">
                                        <tbody>
                                            {rawExcelData.slice(0, 8).map((row, i) => (
                                                <tr 
                                                    key={i} 
                                                    className={`cursor-pointer ${i === headerRowIndex ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
                                                    onClick={() => reparseWithHeader(i)}
                                                >
                                                    <td className="font-bold text-xs p-1 bg-muted/20 w-16">Row {i + 1}</td>
                                                    {Array.isArray(row) && row.slice(0, 10).map((cell, j) => (
                                                        <td key={j} className="text-xs p-1 truncate max-w-[100px] border">
                                                            {cell !== null && cell !== undefined ? String(cell) : ''}
                                                        </td>
                                                    ))}
                                                    {row.length > 10 && <td className="text-xs p-1 text-muted italic">...</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <p className="text-xs text-muted italic">Tip: Click a row to use it as the header.</p>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span>Manual Row:</span>
                                        <input 
                                            type="number" 
                                            className="w-12 p-1 border rounded text-center bg-background" 
                                            value={headerRowIndex + 1} 
                                            onChange={(e) => {
                                                const idx = parseInt(e.target.value) - 1;
                                                if (idx >= 0 && idx < rawExcelData.length) reparseWithHeader(idx);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. Data Preview Table */}
                        {excelData.length > 0 && (
                            <div className="layout-card mapping-section">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="flex items-center gap-2"><Table size={18} /> Excel Data Preview</h3>
                                    <div className="badge badge-success">{excelData.length} Records</div>
                                </div>
                                <div className="data-table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                {columns.map(col => <th key={col}>{col}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelData.slice(0, 10).map((row, i) => (
                                                <tr key={i}>
                                                    {columns.map(col => <td key={col}>{row[col] !== undefined ? String(row[col]) : ''}</td>)}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 4. Field Mapping */}
                        {selectedTemplate && columns.length > 0 && (
                            <div className="layout-card mapping-section">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="flex items-center gap-2"><ListChecks size={18} /> 3. Field Mapping</h3>
                                    <button className="btn btn-ghost btn-xs text-primary gap-1" onClick={() => performAutoMapping(selectedTemplate, columns)}>
                                        <Wand2 size={12} /> Auto-map
                                    </button>
                                </div>
                                <div className="mapping-grid">
                                    {(selectedTemplate?.elements || [])
                                        .filter(el => ['text', 'barcode', 'qrcode'].includes(el.type))
                                        .map(el => {
                                            const isMapped = !!mapping[el.id];
                                            const sampleValue = isMapped ? excelData[0][mapping[el.id]] : null;
                                            
                                            return (
                                                <div key={el.id} className={`mapping-item ${isMapped ? 'auto-mapped' : ''}`}>
                                                    <label>{el.type}: {(el.text || el.barcodeValue || el.qrValue || 'Value').substring(0, 30)}</label>
                                                    <div className="mapping-control">
                                                        <select 
                                                            value={mapping[el.id] || ''} 
                                                            onChange={(e) => handleMappingChange(el.id, e.target.value)}
                                                        >
                                                            <option value="">-- Ignore --</option>
                                                            {columns.map(col => <option key={col} value={col}>{col}</option>)}
                                                        </select>
                                                        {sampleValue && (
                                                            <div className="mapping-sample" title={`Sample: ${sampleValue}`}>
                                                                Value: {String(sampleValue)}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

                        {/* 5. Layout Preview */}
                        {selectedTemplate && excelData.length > 0 && (
                            <div className="preview-section">
                                <div className="preview-toolbar">
                                    <h3 className="flex items-center gap-2"><Eye size={18} /> 4. Proof Sheet Preview</h3>
                                    <div className="flex gap-2">
                                        <button className="btn btn-secondary" onClick={downloadLayout}>
                                            <Download size={16} /> Export Image
                                        </button>
                                        <button className="btn btn-secondary" onClick={downloadPDF}>
                                            <Download size={16} /> Proof PDF
                                        </button>
                                        <button className="btn btn-primary" onClick={downloadIndividualPDF} disabled={isExporting}>
                                            <Download size={16} /> 1 Page 1 Design
                                        </button>
                                    </div>
                                </div>

                                <div className="canvas-preview-container">
                                    <Stage
                                        ref={stageRef}
                                        width={sheetWidth}
                                        height={sheetHeight}
                                        className="konva-sheet"
                                    >
                                        <Layer>
                                            <Rect width={sheetWidth} height={sheetHeight} fill="white" />
                                            
                                            {/* Header */}
                                            <Group x={marginSide} y={40}>
                                                <Text text="SARAVANA" fontSize={36} fontFamily="Arial" fontWeight="900" fill="#f39c12" />
                                                <Text text="GRAPHICSS" x={195} y={3} fontSize={36} fontFamily="Arial" fontWeight="900" fill="#334155" />
                                                <Rect y={55} width={sheetWidth - 100} height={2} fill="#e2e8f0" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={75} fontSize={14} fontFamily="Inter" fontWeight="600" fill="#64748b" letterSpacing={2} />
                                            </Group>

                                            {/* Design Grid */}
                                            <Group y={180} x={marginSide}>
                                                {excelData.slice(0, 10).map((row, index) => {
                                                    const colIndex = index % colsCount;
                                                    const rowIndex = Math.floor(index / colsCount);
                                                    return (
                                                        <LayoutLabel
                                                            key={index}
                                                            elements={selectedTemplate?.elements || []}
                                                            data={row}
                                                            mapping={mapping}
                                                            x={colIndex * (itemWidth + spacing)}
                                                            y={rowIndex * (itemHeight + spacing)}
                                                            width={itemWidth}
                                                            height={itemHeight}
                                                        />
                                                    );
                                                })}
                                            </Group>
                                        </Layer>
                                    </Stage>
                                </div>

                                {/* Hidden stage for high-quality single label capture */}
                                {exportIndex !== -1 && (
                                    <div style={{ position: 'fixed', left: -5000, top: 0, pointerEvents: 'none', background: 'white' }}>
                                        <Stage
                                            ref={hiddenStageRef}
                                            width={itemWidth}
                                            height={itemHeight}
                                        >
                                            <Layer>
                                                <Rect width={itemWidth} height={itemHeight} fill="white" />
                                                <LayoutLabel
                                                    elements={selectedTemplate?.elements || []}
                                                    data={excelData[exportIndex]}
                                                    mapping={mapping}
                                                    x={0}
                                                    y={0}
                                                    width={itemWidth}
                                                    height={itemHeight}
                                                />
                                            </Layer>
                                        </Stage>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Empty State */}
                        {(!selectedTemplate || excelData.length === 0) && (
                            <div className="layout-card mapping-section py-20 text-center border-dashed">
                                <div className="flex flex-col items-center gap-3">
                                    <AlertCircle size={48} className="text-muted opacity-20" />
                                    <h3 className="text-xl">Awaiting Selection</h3>
                                    <p className="text-muted max-w-xs mx-auto">Select a template and upload Excel data to generate the multi-label proof sheet.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
