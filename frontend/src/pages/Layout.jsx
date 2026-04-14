import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Layers, FileSpreadsheet, ListChecks, Eye, Download, 
    ArrowLeft, Search, RefreshCw, CheckCircle2, AlertCircle,
    Table, Wand2, Info, ZoomIn, ZoomOut
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Stage, Layer, Group, Rect, Text, Image as KImage, Path, Circle, Ellipse, Line, Star, RegularPolygon } from 'react-konva';
import Sidebar from '../components/Sidebar';
import { templatesAPI, designsAPI } from '../api';
import { useUIStore, unitToPx } from '../store/uiStore';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import BarcodeElement from '../components/BarcodeElement';
import QRElement from '../components/QRElement';
import ImageElement from '../components/ImageElement';
import './Layout.css';

// Component to render a single label within the grid
const LayoutLabel = ({ elements = [], data = {}, mapping = {}, x, y, width, height, isBranding = false, logoImg = null }) => {
    // Merge template elements with Excel data based on mappings
    const mergedElements = useMemo(() => {
        if (isBranding) {
            // Special layout for the Front Page / Branding Label
            return [
                { type: 'rect', x: 0, y: 0, width, height, fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1 },
                { type: 'text', x: 20, y: height - 60, text: 'SARAVANA GRAPHICSS', fontSize: 18, fontWeight: '900', fill: '#1e293b' },
                { type: 'text', x: 20, y: height - 40, text: 'Premium Label & Card Printing', fontSize: 10, fill: '#64748b' },
                { type: 'text', x: 20, y: height - 25, text: 'Contact: +91 98765 43210', fontSize: 9, fill: '#94a3b8' }
            ];
        }

        // Standard logic for Excel labels
        const processed = elements.map(el => {
            let newEl = { ...el };
            const isPlaceholder = el.type === 'placeholder';
            const isText = el.type === 'text';
            let text = el.text || '';
            const mode = el.mappingMode || (el.autoFill === false ? 'fixed' : 'smart');

            // PRIORITY 1: Manual Mapping Override
            const manualMapping = mapping[el.id] || el.fieldName;
            if (manualMapping && data[manualMapping] !== undefined) {
                const val = String(data[manualMapping]);
                if (isText || isPlaceholder) {
                    newEl.text = val;
                } else if (el.type === 'barcode') {
                    newEl.barcodeValue = val;
                } else if (el.type === 'qrcode') {
                    newEl.qrValue = val;
                }
                return newEl; 
            }

            if (isText || isPlaceholder) {
                if (mode === 'fixed') {
                    // Do nothing, text remains static
                } else if (mode === 'value') {
                    // Mode: VALUE (Replace Entire Box)
                    const sortedDataKeys = Object.keys(data).sort((a, b) => b.length - a.length);
                    const match = sortedDataKeys.find(col => {
                        const escapedCol = col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\b${escapedCol}\\b`, 'gi');
                        return regex.test(text) || el.fieldName === col;
                    });
                    if (match) {
                        text = data[match] !== undefined ? String(data[match]) : '';
                    } else if (el.fieldName && data[el.fieldName] !== undefined) {
                        text = String(data[el.fieldName]);
                    }
                } else {
                    // Mode: SMART (Text + Placeholder Logic)
                    // We split by newline to support multi-line boxes (COLOUR, Desc, etc.)
                    const lines = text.split('\n');
                    const processedLines = lines.map(line => {
                        let lineText = line;
                        
                        // 1. Double curly replacements (Highest Priority)
                        Object.keys(data).forEach(col => {
                            const placeholder = `{{${col}}}`;
                            if (lineText.includes(placeholder)) {
                                lineText = lineText.replaceAll(placeholder, data[col] !== undefined ? String(data[col]) : '');
                            }
                        });

                        // 2. Intelligent "Label : Value" Detection
                        if (lineText.includes(':') && lineText.split(':').length === 2) {
                            const parts = lineText.split(':');
                            const labelPart = parts[0].trim().toLowerCase();
                            const valuePart = parts[1].trim();
                            
                            const matchedHeader = Object.keys(data).find(h => h.toLowerCase() === labelPart);
                            if (matchedHeader) {
                                const newVal = data[matchedHeader] !== undefined ? String(data[matchedHeader]) : valuePart;
                                return `${parts[0]}: ${newVal}`;
                            }
                        }

                        // 3. Standard Word-for-Word Matcher (Fallback for this line)
                        // Note: We ignore the label protection here if we are on a multi-line box
                        const sortedDataKeys = Object.keys(data).sort((a, b) => b.length - a.length);
                        sortedDataKeys.forEach(col => {
                            const isSafePlaceholder = /[a-zA-Z]/.test(col);
                            if (!isSafePlaceholder) return; 
                            
                            const escapedCol = col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            const regex = new RegExp(`\\b${escapedCol}\\b(?![\\s]*:)`, 'gi');
                            if (regex.test(lineText)) {
                                lineText = lineText.replaceAll(regex, data[col] !== undefined ? String(data[col]) : '');
                            }
                        });
                        
                        return lineText;
                    });
                    text = processedLines.join('\n');

                    // 4. Fallback to direct fieldName (if no change at all)
                    if (text === el.text && el.fieldName && data[el.fieldName] !== undefined) {
                        text = String(data[el.fieldName]);
                    }
                }
                newEl.text = text;
            }

            // Map Barcodes/QRs
            if (mode !== 'fixed') {
                let mappedColumn = mapping[el.id] || el.fieldName;
                if (!mappedColumn && (el.type === 'barcode' || el.type === 'qrcode')) {
                    const searchName = (el.barcodeValue || el.qrValue || el.name || '').toLowerCase();
                    const autoMatch = Object.keys(data).find(col => searchName.includes(col.toLowerCase()));
                    if (autoMatch) mappedColumn = autoMatch;
                }
                if (mappedColumn && data[mappedColumn] !== undefined) {
                    const val = String(data[mappedColumn]);
                    if (el.type === 'barcode') newEl.barcodeValue = val;
                    if (el.type === 'qrcode') newEl.qrValue = val;
                }
            }

            return newEl;
        });
        
        return processed;
    }, [elements, data, mapping]);

    const sortedElements = useMemo(() => 
        [...mergedElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    , [mergedElements]);

    // Draw a retail tag outline (die-cut path)
    const drawTagPath = (w, h) => {
        const cornerW = w * 0.15;
        const cornerH = h * 0.08;
        return `M ${cornerW} 0 ` + 
               `L ${w - cornerW} 0 ` + 
               `L ${w} ${cornerH} ` + 
               `L ${w} ${h} ` + 
               `L 0 ${h} ` + 
               `L 0 ${cornerH} Z`;
    };

    return (
        <Group 
            x={x} y={y} 
            clipX={0} clipY={0} 
            clipWidth={width} clipHeight={height + 10} // Safety margin for rounding
        >
            {/* White background for the label area - Ensure it's rendered behind elements */}
            <Rect width={width} height={height} fill="white" stroke="#e2e8f0" strokeWidth={1} cornerRadius={4} />

            {sortedElements.map((el, i) => {
                const commonProps = {
                    key: el.id || i,
                    id: el.id,
                    x: el.x || 0,
                    y: el.y || 0,
                    rotation: el.rotation || 0,
                    scaleX: el.scaleX || 1,
                    scaleY: el.scaleY || 1,
                    opacity: el.opacity !== undefined ? el.opacity : 1,
                    visible: el.visible !== false,
                    name: el.name || 'element'
                };

                // Specialized rendering for Branding Label (Front Page)
                if (isBranding) {
                    if (el.type === 'rect') return <Rect {...commonProps} width={width} height={height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} cornerRadius={4} />;
                    if (el.type === 'text') return <Text {...commonProps} text={el.text} fontSize={el.fontSize} fontWeight={el.fontWeight} fill={el.fill} width={width - 40} align="center" />;
                    return null;
                }

                switch (el.type) {
                    case 'text':
                    case 'placeholder':
                        return (
                            <Text {...commonProps}
                                text={el.text || ''}
                                fontSize={el.fontSize || 12}
                                fontFamily={el.fontFamily || 'Arial'}
                                fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                align={el.textAlign || 'left'}
                                verticalAlign={el.verticalAlign || 'top'}
                                fill={el.fill || '#000000'}
                                width={el.width || (el.type === 'placeholder' ? 100 : undefined)}
                                wrap="word"
                                textDecoration={el.underline ? 'underline' : 'none'}
                                padding={el.padding || 0}
                            />
                        );
                    case 'rect':
                        return <Rect {...commonProps} width={el.width || 0} height={el.height || 0} fill={el.fill || 'transparent'} cornerRadius={el.cornerRadius || 0} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 1)} dash={el.dash} />;
                    case 'line':
                        return <Line {...commonProps} points={el.points && el.points.length > 0 ? el.points : [0, 0, 100, 0]} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} lineCap="round" lineJoin="round" tension={el.tension || 0} dash={el.dash} />;
                    case 'triangle':
                        return <Line {...commonProps} points={[ (el.width || 100)/2, 0, el.width || 100, el.height || 100, 0, el.height || 100]} closed fill={el.fill || 'transparent'} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 2)} dash={el.dash} />;
                    case 'circle':
                        return <Circle {...commonProps} radius={el.radius || 20} fill={el.fill || 'transparent'} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 2)} dash={el.dash} />;
                    case 'star':
                        return <Star {...commonProps} numPoints={el.numPoints || 5} innerRadius={el.innerRadius || 0} outerRadius={el.outerRadius || 0} fill={el.fill || 'transparent'} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 1)} dash={el.dash} />;
                    case 'polygon':
                        return <RegularPolygon {...commonProps} sides={el.sides || 6} radius={el.radius || 0} fill={el.fill || 'transparent'} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 1)} dash={el.dash} />;
                    case 'path':
                        return <Path {...commonProps} data={el.data || ''} fill={el.fill || 'transparent'} stroke={el.stroke || (el.fill ? 'transparent' : '#000000')} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : (el.fill ? 0 : 1)} dash={el.dash} />;
                    case 'barcode':
                        return <BarcodeElement {...commonProps} el={el} onSelect={() => {}} />;
                    case 'qrcode':
                        return <QRElement {...commonProps} el={el} onSelect={() => {}} />;
                    case 'image':
                        return <ImageElement {...commonProps} el={el} />;
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
    const [zoom, setZoom] = useState(2.0); // Default to 200% zoom for clarity
    const [logoImg, setLogoImg] = useState(null);
    const stageRef = useRef();
    const hiddenStageRef = useRef();

    useEffect(() => {
        const img = new window.Image();
        img.src = '/logo.png';
        img.onload = () => setLogoImg(img);
    }, []);

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
    
    const PX_TO_MM = 0.264583;

    const drawVectorBarcode = (pdf, val, x, y, w, h, format = 'EAN13', color = '#000000') => {
        try {
            const barcodeData = {};
            JsBarcode(barcodeData, val || '123456789012', { format, margin: 0 });
            
            if (barcodeData.encodings && barcodeData.encodings[0]) {
                const binary = barcodeData.encodings[0].data;
                const totalBars = binary.length;
                const barWidth = w / totalBars;
                
                // Only set fill color if it's not transparent
                const fillColor = (color && color !== 'transparent') ? color : '#000000';
                pdf.setFillColor(fillColor);

                for (let i = 0; i < binary.length; i++) {
                    if (binary[i] === '1') {
                        pdf.rect(x + i * barWidth, y, barWidth, h, 'F');
                    }
                }
                
                // Draw digits below
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.text(val, x + w/2, y + h + 2, { align: 'center' });
            }
        } catch (err) {
            console.error('Vector Barcode Error:', err);
        }
    };

    const drawVectorPath = (pdf, pathStr, offsetX, offsetY, scaleX = 1, scaleY = 1, fill, stroke) => {
        if (!pathStr) return;
        try {
            // Simple SVG Path parser for M, L, Z
            const commands = pathStr.match(/[MLZ]|[-+]?\d*\.?\d+/g);
            if (!commands) return;

            let currentPath = [];
            let i = 0;
            
            pdf.setDrawColor(stroke || '#000000');
            pdf.setFillColor(fill || '#ffffff');
            
            while (i < commands.length) {
                const cmd = commands[i];
                if (cmd === 'M') {
                    const x = offsetX + parseFloat(commands[i+1]) * PX_TO_MM * scaleX;
                    const y = offsetY + parseFloat(commands[i+2]) * PX_TO_MM * scaleY;
                    currentPath.push({ op: 'm', c: [x, y] });
                    i += 3;
                } else if (cmd === 'L') {
                    const x = offsetX + parseFloat(commands[i+1]) * PX_TO_MM * scaleX;
                    const y = offsetY + parseFloat(commands[i+2]) * PX_TO_MM * scaleY;
                    currentPath.push({ op: 'l', c: [x, y] });
                    i += 3;
                } else if (cmd === 'Z') {
                    currentPath.push({ op: 'h' });
                    i += 1;
                } else {
                    i++;
                }
            }

            const style = (fill && fill !== 'transparent') ? 'FD' : 'D';
            pdf.path(currentPath, style);
        } catch (err) {
            console.error('Vector Path Error:', err);
        }
    };

    const drawVectorLabel = (pdf, elements, data, mapping, offsetX, offsetY, w, h, isBranding = false) => {
        const mmX = offsetX * PX_TO_MM;
        const mmY = offsetY * PX_TO_MM;
        const mmW = w * PX_TO_MM;
        const mmH = h * PX_TO_MM;

        // Background / Border
        pdf.setDrawColor('#e2e8f0');
        pdf.setLineWidth(0.05);
        pdf.setFillColor('#ffffff');
        pdf.roundedRect(mmX, mmY, mmW, mmH, 1, 1, 'FD');

        if (isBranding) {
            // Draw Branding Box Content
            pdf.setFillColor('#f8fafc');
            pdf.rect(mmX + 1, mmY + 1, mmW - 2, mmH - 2, 'F');
            pdf.setTextColor('#1e293b');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.text('SARAVANA GRAPHICSS', mmX + 5, mmY + mmH - 12);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8);
            pdf.text('Premium Label & Card Printing', mmX + 5, mmY + mmH - 5);
            return;
        }

        // IMPORTANT: Sort elements by zIndex for correct layering (Fixes black bars hiding text)
        const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        // Processing Elements
        sorted.forEach(el => {
            const elX = mmX + (el.x || 0) * PX_TO_MM;
            const elY = mmY + (el.y || 0) * PX_TO_MM;
            const elW = (el.width || 0) * PX_TO_MM;
            const elH = (el.height || 0) * PX_TO_MM;

            if (el.type === 'text' || el.type === 'placeholder') {
                let val = el.text || '';
                const manualMapping = mapping[el.id] || el.fieldName;
                if (manualMapping && data[manualMapping] !== undefined) {
                    val = String(data[manualMapping]);
                }

                // If it's a generic placeholder like "Text" and we have no value, maybe hide it?
                if (val === 'Text' && !el.text) return; 

                pdf.setTextColor((el.fill && el.fill !== 'transparent') ? el.fill : '#000000');
                const fontSize = (el.fontSize || 12) * 0.75 * (el.scaleX || 1); 
                pdf.setFontSize(fontSize);
                const style = el.fontWeight === 'bold' ? 'bold' : 'normal';
                pdf.setFont('helvetica', style);
                
                const lines = val.split('\n');
                lines.forEach((line, i) => {
                    // Improved Y centering/baseline for text
                    const yPos = elY + (i * fontSize * 0.4) + (fontSize * 0.35);
                    pdf.text(line, elX, yPos);
                });
            } else if (el.type === 'rect') {
                if (el.fill && el.fill !== 'transparent') {
                    pdf.setFillColor(el.fill);
                    pdf.rect(elX, elY, elW, elH, 'F');
                }
                if (el.stroke && el.stroke !== 'transparent') {
                    pdf.setDrawColor(el.stroke);
                    pdf.setLineWidth((el.strokeWidth || 1) * 0.1);
                    pdf.rect(elX, elY, elW, elH, 'D');
                }
            } else if (el.type === 'path') {
                drawVectorPath(pdf, el.data, mmX, mmY, el.scaleX || 1, el.scaleY || 1, el.fill, el.stroke);
            } else if (el.type === 'barcode') {
                let bVal = data[mapping[el.id] || el.fieldName] || el.barcodeValue || '123456789012';
                bVal = String(bVal).substring(0, 12); 
                drawVectorBarcode(pdf, bVal, elX, elY, elW, elH, el.barcodeFormat || 'EAN13', el.fill);
            }
        });
    };

    const downloadPDF = () => {
        if (!selectedTemplate) return;
        
        try {
            toast.loading('Generating Editable Vector PDF (CorelDraw ready)...', { id: 'pdf-gen' });
            
            const pdf = new jsPDF({
                orientation: sheetWidth > sheetHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [sheetWidth * PX_TO_MM, sheetHeight * PX_TO_MM]
            });

            // Header Section (Vector)
            pdf.setFontSize(28);
            pdf.setTextColor('#f39c12');
            pdf.setFont('helvetica', 'bold');
            pdf.text('SARAVANA', marginSide * PX_TO_MM, 25);
            
            // Calculate width for "SARAVANA" to avoid overlap
            const saravanaWidth = pdf.getTextWidth('SARAVANA') + 5;
            pdf.setTextColor('#334155');
            pdf.text('GRAPHICSS', (marginSide * PX_TO_MM) + saravanaWidth, 25);
            
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setDrawColor('#e2e8f0');
            pdf.line(marginSide * PX_TO_MM, 30, (sheetWidth - marginSide) * PX_TO_MM, 30);
            pdf.text('DESIGN PROOF APPROVAL SHEET', marginSide * PX_TO_MM, 38);

            // 1. Branding Label
            drawVectorLabel(pdf, [], {}, {}, marginSide, 180, itemWidth, itemHeight, true);

            // 2. Data Labels
            excelData.slice(0, 9).forEach((row, index) => {
                const realIndex = index + 1;
                const colIndex = realIndex % colsCount;
                const rowIndex = Math.floor(realIndex / colsCount);
                const x = marginSide + colIndex * (itemWidth + spacing);
                const y = 180 + rowIndex * (itemHeight + spacing);
                
                drawVectorLabel(pdf, selectedTemplate.elements, row, mapping, x, y, itemWidth, itemHeight);
            });

            pdf.save(`Proof_Editable_${new Date().getTime()}.pdf`);
            toast.success('Vector PDF Generated!', { id: 'pdf-gen' });
        } catch (err) {
            console.error('PDF Error:', err);
            toast.error('Failed to generate Vector PDF', { id: 'pdf-gen' });
        }
    };

    const downloadIndividualPDF = async () => {
        if (!selectedTemplate || excelData.length === 0) return;
        
        try {
            setIsExporting(true);
            const mmW = itemWidth * PX_TO_MM;
            const mmH = itemHeight * PX_TO_MM;
            
            const pdf = new jsPDF({
                orientation: mmW > mmH ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [mmW, mmH]
            });

            for (let i = 0; i < excelData.length; i++) {
                setExportProgress(Math.round(((i + 1) / excelData.length) * 100));
                toast.loading(`Vectorizing Label ${i+1}/${excelData.length}...`, { id: 'v-pdf' });
                
                drawVectorLabel(pdf, selectedTemplate.elements, excelData[i], mapping, 0, 0, itemWidth, itemHeight);
                
                if (i < excelData.length - 1) {
                    pdf.addPage([mmW, mmH], mmW > mmH ? 'landscape' : 'portrait');
                }
            }

            pdf.save(`${selectedTemplate.title}_Vector_Editable.pdf`);
            toast.success('Individual Vector PDF Ready!', { id: 'v-pdf' });
        } catch (err) {
            console.error('Individual PDF Error:', err);
            toast.error('Failed to export Individual Vector PDF');
        } finally {
            setIsExporting(false);
        }
    };
;

    // Grid Settings - Use exact design dimensions converted to pixels
    const getPxWidth = () => {
        if (!selectedTemplate) return 350;
        const w = selectedTemplate.canvasWidth || selectedTemplate.width || 0;
        const unit = selectedTemplate.canvasUnit || 'px';
        
        let width = unit === 'px' ? w : unitToPx(w, unit);
        
        // Final fallback: If width is too small or missing, calculate from elements
        if (width < 20 && selectedTemplate.elements?.length > 0) {
            width = Math.max(...selectedTemplate.elements.map(e => (e.x || 0) + (e.width || 0) + (e.radius || 0))) + 10;
        }
        
        return width || 350;
    };
    
    const getPxHeight = () => {
        if (!selectedTemplate) return 700;
        const h = selectedTemplate.canvasHeight || selectedTemplate.height || 0;
        const unit = selectedTemplate.canvasUnit || 'px';
        
        let height = unit === 'px' ? h : unitToPx(h, unit);
        
        // Final fallback: Calculate true height by scanning every element
        if (selectedTemplate.elements?.length > 0) {
            const elementEdges = selectedTemplate.elements.map(e => {
                const y = e.y || 0;
                const hVal = e.height || (e.radius ? e.radius * 2 : 0) || 20;
                return y + hVal;
            });
            const contentHeight = Math.max(...elementEdges) + 40; // Add padding
            height = Math.max(height, contentHeight);
        }
        
        return height || 700;
    };

    const itemWidth = getPxWidth();
    const itemHeight = getPxHeight();
    const colsCount = 5;
    const spacing = 40; // Increased spacing for comfort
    const marginSide = 50;
    const sheetWidth = (itemWidth + spacing) * colsCount + (marginSide * 2);
    
    // Dynamic height based on labels (Data + 1 Branding Label)
    const totalItems = excelData.length > 0 ? (Math.min(excelData.length, 9) + 1) : 0;
    const rowCount = Math.ceil(totalItems / colsCount) || 1;
    const sheetHeight = (itemHeight + spacing) * rowCount + 300; // Extra padding for header and footer

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

                        {/* 3. Manual Field Mapping (RESTORED) */}
                        {excelData.length > 0 && selectedTemplate && (
                            <div className="layout-card mapping-card-section">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <div className="flex flex-col">
                                        <h3 className="flex items-center gap-2"><Table size={18} className="text-primary" /> 3. Field Mapping</h3>
                                        <p className="text-[11px] text-muted">Manually bind Excel columns to your design elements</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost btn-xs" onClick={() => setMapping({})}>Clear All</button>
                                        <button className="btn btn-primary btn-sm" onClick={() => {
                                            const newMapping = {};
                                            selectedTemplate.elements.forEach(el => {
                                                if (['text', 'barcode', 'qrcode', 'placeholder'].includes(el.type)) {
                                                    const name = (el.name || el.text || el.fieldName || '').toLowerCase();
                                                    const match = columns.find(c => name.includes(c.toLowerCase()) || c.toLowerCase().includes(name));
                                                    if (match) newMapping[el.id] = match;
                                                }
                                            });
                                            setMapping(newMapping);
                                        }}>Auto-Fill Columns</button>
                                    </div>
                                </div>

                                <div className="mapping-card-grid max-h-[500px] overflow-auto pr-2">
                                    {selectedTemplate.elements
                                        .filter(el => ['text', 'barcode', 'qrcode', 'placeholder'].includes(el.type))
                                        .map(el => {
                                            const currentMapping = mapping[el.id] || el.fieldName || '';
                                            const previewValue = currentMapping && excelData[0] ? excelData[0][currentMapping] : null;

                                            return (
                                                <div key={el.id} className={`mapping-item-card ${currentMapping ? 'mapped' : ''}`}>
                                                    <div className="mapping-card-header">
                                                        <div className="flex flex-col flex-1 truncate">
                                                            <span className="mapping-type-tag">
                                                                {el.type === 'placeholder' ? 'DYNAMIC TEXT' : el.type}
                                                            </span>
                                                            <div className="mapping-design-label" title={el.text || el.name}>
                                                                {el.text || el.name || 'Unnamed Element'}
                                                            </div>
                                                        </div>
                                                        {currentMapping && (
                                                            <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                                                                <CheckCircle2 size={12} className="text-success" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <select 
                                                        className={`mapping-select ${currentMapping ? 'active' : ''}`}
                                                        value={currentMapping}
                                                        onChange={(e) => handleMappingChange(el.id, e.target.value)}
                                                    >
                                                        <option value="">-- No Mapping (Ignore) --</option>
                                                        {columns.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>

                                                    <div className="value-preview-box">
                                                        <span className="value-preview-text">
                                                            {previewValue !== null ? `Value: ${previewValue}` : '-- No Data --'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}

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

                        {/* 4. Data Preview Table (RESTORED EDITABLE) */}
                        {excelData.length > 0 && (
                            <div className="layout-card mapping-section">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="flex items-center gap-2"><Table size={18} /> Excel Data Preview (Editable)</h3>
                                    <div className="badge badge-success">{excelData.length} Records</div>
                                </div>
                                <div className="data-table-container max-h-60 overflow-auto">
                                    <table className="data-table editable-grid">
                                        <thead>
                                            <tr>
                                                <th className="w-10">Row</th>
                                                {columns.map(col => <th key={col}>{col}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {excelData.slice(0, 50).map((row, i) => (
                                                <tr key={i}>
                                                    <td className="text-center font-bold bg-muted/20">{i + 1}</td>
                                                    {columns.map(col => (
                                                        <td key={col} className="p-0">
                                                            <input 
                                                                type="text"
                                                                className="w-full h-full p-1 bg-transparent border-none focus:ring-1 focus:ring-primary outline-none"
                                                                value={row[col] !== undefined ? String(row[col]) : ''}
                                                                onChange={(e) => {
                                                                    const newData = [...excelData];
                                                                    newData[i] = { ...newData[i], [col]: e.target.value };
                                                                    setExcelData(newData);
                                                                }}
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                        {/* 5. Layout Preview */}
                        {selectedTemplate && excelData.length > 0 && (
                            <div className="preview-section">
                                <div className="preview-toolbar">
                                    <h3 className="flex items-center gap-2"><Eye size={18} /> 3. Proof Sheet Preview</h3>
                                    
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2 bg-muted/10 px-2 py-1 rounded">
                                            <button className="btn btn-ghost btn-xs" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}><ZoomOut size={16} /></button>
                                            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                                            <button className="btn btn-ghost btn-xs" onClick={() => setZoom(Math.min(5, zoom + 0.25))}><ZoomIn size={16} /></button>
                                        </div>

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
                                </div>

                                <div className="canvas-preview-container" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                                    <Stage
                                        ref={stageRef}
                                        width={sheetWidth * zoom}
                                        height={sheetHeight * zoom}
                                        scaleX={zoom}
                                        scaleY={zoom}
                                        className="konva-sheet"
                                    >
                                        <Layer>
                                            <Rect width={sheetWidth} height={sheetHeight} fill="white" />
                                            
                                            {/* Header */}
                                            <Group x={marginSide} y={40}>
                                                {logoImg && (
                                                    <KImage 
                                                        image={logoImg} 
                                                        width={60} 
                                                        height={60} 
                                                        y={-10}
                                                    />
                                                )}
                                                <Text text="SARAVANA" x={logoImg ? 80 : 0} fontSize={36} fontFamily="Arial" fontWeight="900" fill="#f39c12" />
                                                <Text text="GRAPHICSS" x={logoImg ? 275 : 195} y={3} fontSize={36} fontFamily="Arial" fontWeight="900" fill="#334155" />
                                                <Rect y={55} width={sheetWidth - 100} height={2} fill="#e2e8f0" />
                                                <Text text="DESIGN PROOF APPROVAL SHEET" y={75} fontSize={14} fontFamily="Inter" fontWeight="600" fill="#64748b" letterSpacing={2} />
                                            </Group>

                                            <Group y={180} x={marginSide}>
                                                {/* 1. Prepend Branding Label (Front Page) */}
                                                <LayoutLabel 
                                                    elements={[]}
                                                    isBranding={true}
                                                    logoImg={logoImg}
                                                    x={0}
                                                    y={0}
                                                    width={itemWidth}
                                                    height={itemHeight}
                                                />

                                                {/* 2. Excel Data Labels */}
                                                {excelData.slice(0, 9).map((row, index) => {
                                                    const realIndex = index + 1; // +1 because branding label is at idx 0
                                                    const colIndex = realIndex % colsCount;
                                                    const rowIndex = Math.floor(realIndex / colsCount);
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
