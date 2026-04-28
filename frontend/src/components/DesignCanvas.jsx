import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer, Text, Rect, Circle, Ellipse, Line, Arrow, Image as KImage, Transformer, Group, Star, RegularPolygon, Path, Shape } from 'react-konva';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import BarcodeElement from './BarcodeElement';
import QRElement from './QRElement';
import ImageElement from './ImageElement';
import NumericInput from './NumericInput';

const GRID_SIZE = 10;
const DIM_COLOR = '#E91E63';
const DIM_FONT_SIZE = 10;
const DIM_OFFSET = 18;
const DIM_ARROW_SIZE = 5;
const DIM_LINE_WIDTH = 1;

function GridLayer({ width, height }) {
    const lines = [];
    for (let i = 0; i <= width; i += GRID_SIZE) {
        lines.push(<Line key={`v${i}`} points={[i, 0, i, height]} stroke="rgba(255,255,255,0.05)" strokeWidth={i % 50 === 0 ? 0.8 : 0.4} />);
    }
    for (let i = 0; i <= height; i += GRID_SIZE) {
        lines.push(<Line key={`h${i}`} points={[0, i, width, i]} stroke="rgba(255,255,255,0.05)" strokeWidth={i % 50 === 0 ? 0.8 : 0.4} />);
    }
    return <>{lines}</>;
}

// Get bounding box for element (accounting for different shape types)
function getElementBounds(el) {
    const sx = el.scaleX || 1;
    const sy = el.scaleY || 1;
    let x = el.x || 0;
    let y = el.y || 0;
    let w = 0, h = 0;

    switch (el.type) {
        case 'rect':
        case 'image':
            w = (el.width || 100) * sx;
            h = (el.height || 80) * sy;
            break;
        case 'text':
            w = (el.width || 200) * sx;
            h = (el.fontSize || 16) * sy * 1.2;
            break;
        case 'circle':
            const r = (el.radius || 50) * Math.max(sx, sy);
            x = x - r;
            y = y - r;
            w = r * 2;
            h = r * 2;
            break;
        case 'ellipse':
            const ew = (el.width || 120) * sx / 2;
            const eh = (el.height || 80) * sy / 2;
            x = x - ew;
            y = y - eh;
            w = ew * 2;
            h = eh * 2;
            break;
        case 'star':
            const or = (el.outerRadius || 50) * Math.max(sx, sy);
            x = x - or;
            y = y - or;
            w = or * 2;
            h = or * 2;
            break;
        case 'polygon':
            const pr = (el.radius || 50) * Math.max(sx, sy);
            x = x - pr;
            y = y - pr;
            w = pr * 2;
            h = pr * 2;
            break;
        case 'triangle':
            w = (el.width || 100) * sx;
            h = (el.height || 100) * sy;
            break;
        case 'line':
            if (el.points && el.points.length >= 4) {
                const dx = Math.abs(el.points[2] - el.points[0]) * sx;
                const dy = Math.abs(el.points[3] - el.points[1]) * sy;
                w = dx;
                h = dy;
                if (el.points[2] < el.points[0]) x = x - dx;
                if (el.points[3] < el.points[1]) y = y - dy;
            }
            break;
        case 'barcode':
            w = (el.width || 200) * sx;
            h = (el.height || 80) * sy;
            break;
        case 'qrcode':
            w = (el.width || 100) * sx;
            h = (el.height || 100) * sy;
            break;
        case 'placeholder':
            w = (el.width || 100) * sx;
            h = (el.height || 100) * sy;
            break;
        default:
            w = (el.width || 100) * sx;
            h = (el.height || 100) * sy;
    }
    return { x, y, w: Math.abs(w), h: Math.abs(h) };
}

// CAD-style dimension annotations
function DimensionLines({ el, zoom }) {
    const { measurementUnit } = useUIStore();
    const { x, y, w, h } = getElementBounds(el);
    if (w < 2 && h < 2) return null;

    const invZoom = 1 / zoom;
    const offset = DIM_OFFSET * invZoom;
    const arrowSize = DIM_ARROW_SIZE * invZoom;
    const fontSize = DIM_FONT_SIZE * invZoom;
    const lineWidth = DIM_LINE_WIDTH * invZoom;
    const extGap = 3 * invZoom;
    const extLen = offset + 6 * invZoom;

    const formatVal = (v) => Number(pxToUnit(v, measurementUnit).toFixed(2));
    const widthLabel = `${formatVal(w)} ${measurementUnit}`;
    const heightLabel = `${formatVal(h)} ${measurementUnit}`;

    return (
        <Group listening={false}>
            {/* ---- WIDTH DIMENSION (bottom) ---- */}
            {w > 2 && (
                <>
                    <Line points={[x, y + h + extGap, x, y + h + extLen]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x + w, y + h + extGap, x + w, y + h + extLen]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x, y + h + offset, x + w, y + h + offset]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x, y + h + offset, x + arrowSize, y + h + offset - arrowSize / 2, x + arrowSize, y + h + offset + arrowSize / 2]} closed fill={DIM_COLOR} stroke={DIM_COLOR} strokeWidth={lineWidth * 0.5} />
                    <Line points={[x + w, y + h + offset, x + w - arrowSize, y + h + offset - arrowSize / 2, x + w - arrowSize, y + h + offset + arrowSize / 2]} closed fill={DIM_COLOR} stroke={DIM_COLOR} strokeWidth={lineWidth * 0.5} />
                    <Rect
                        x={x + w / 2 - (widthLabel.length * fontSize * 0.35)}
                        y={y + h + offset - fontSize / 2 - 1 * invZoom}
                        width={widthLabel.length * fontSize * 0.7}
                        height={fontSize + 2 * invZoom}
                        fill="white"
                        cornerRadius={2 * invZoom}
                    />
                    <Text
                        x={x + w / 2 - (widthLabel.length * fontSize * 0.35)}
                        y={y + h + offset - fontSize / 2}
                        text={widthLabel}
                        fontSize={fontSize}
                        fontFamily="Inter, Arial, sans-serif"
                        fontStyle="bold"
                        fill={DIM_COLOR}
                        width={widthLabel.length * fontSize * 0.7}
                        align="center"
                    />
                </>
            )}

            {/* ---- HEIGHT DIMENSION (right) ---- */}
            {h > 2 && (
                <>
                    <Line points={[x + w + extGap, y, x + w + extLen, y]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x + w + extGap, y + h, x + w + extLen, y + h]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x + w + offset, y, x + w + offset, y + h]} stroke={DIM_COLOR} strokeWidth={lineWidth} />
                    <Line points={[x + w + offset, y, x + w + offset - arrowSize / 2, y + arrowSize, x + w + offset + arrowSize / 2, y + arrowSize]} closed fill={DIM_COLOR} stroke={DIM_COLOR} strokeWidth={lineWidth * 0.5} />
                    <Line points={[x + w + offset, y + h, x + w + offset - arrowSize / 2, y + h - arrowSize, x + w + offset + arrowSize / 2, y + h - arrowSize]} closed fill={DIM_COLOR} stroke={DIM_COLOR} strokeWidth={lineWidth * 0.5} />
                    <Group x={x + w + offset} y={y + h / 2} rotation={-90}>
                        <Rect
                            x={-(heightLabel.length * fontSize * 0.35)}
                            y={-fontSize / 2 - 1 * invZoom}
                            width={heightLabel.length * fontSize * 0.7}
                            height={fontSize + 2 * invZoom}
                            fill="white"
                            cornerRadius={2 * invZoom}
                        />
                        <Text
                            x={-(heightLabel.length * fontSize * 0.35)}
                            y={-fontSize / 2}
                            text={heightLabel}
                            fontSize={fontSize}
                            fontFamily="Inter, Arial, sans-serif"
                            fontStyle="bold"
                            fill={DIM_COLOR}
                            width={heightLabel.length * fontSize * 0.7}
                            align="center"
                        />
                    </Group>
                </>
            )}

            <Group>
                <Rect
                    x={x - 2 * invZoom}
                    y={y - fontSize - 6 * invZoom}
                    width={((`X:${formatVal(x)} Y:${formatVal(y)}`).length * fontSize * 0.45) + 6 * invZoom}
                    height={fontSize + 4 * invZoom}
                    fill="rgba(30,30,30,0.85)"
                    cornerRadius={2 * invZoom}
                />
                <Text
                    x={x + 1 * invZoom}
                    y={y - fontSize - 4 * invZoom}
                    text={`X:${formatVal(x)} Y:${formatVal(y)}`}
                    fontSize={fontSize * 0.9}
                    fontFamily="Inter, Arial, sans-serif"
                    fill="#fff"
                />
            </Group>
        </Group>
    );
}

function GapDimensions({ el1, el2, zoom }) {
    const { measurementUnit } = useUIStore();
    const { setElementDistance } = useDesignStore();
    const b1 = getElementBounds(el1);
    const b2 = getElementBounds(el2);

    const invZoom = 1 / zoom;
    const fontSize = DIM_FONT_SIZE * invZoom;
    const lineWidth = DIM_LINE_WIDTH * invZoom;

    const formatVal = (v) => Number(pxToUnit(v, measurementUnit).toFixed(2));

    const renderDistanceLabel = (x, y, val, axis) => {
        return null; // Labels are now handled by the HTML overlay for better usability
    };

    const gaps = [];

    // Horizontal Gap
    const hGap = b2.x > b1.x + b1.w ? b2.x - (b1.x + b1.w) : (b1.x > b2.x + b2.w ? b1.x - (b2.x + b2.w) : null);
    if (hGap !== null) {
        const yPos = Math.min(b1.y + b1.h / 2, b2.y + b2.h / 2);
        const x1 = b2.x > b1.x ? b1.x + b1.w : b2.x + b2.w;
        const x2 = b2.x > b1.x ? b2.x : b1.x;
        gaps.push(
            <Group key="hgap">
                <Line points={[x1, yPos, x2, yPos]} stroke={DIM_COLOR} strokeWidth={lineWidth} dash={[4 * invZoom, 2 * invZoom]} />
                {renderDistanceLabel(x1 + (x2 - x1) / 2, yPos, hGap, 'x')}
            </Group>
        );
    }

    // Vertical Gap
    const vGap = b2.y > b1.y + b1.h ? b2.y - (b1.y + b1.h) : (b1.y > b2.y + b2.h ? b1.y - (b2.y + b2.h) : null);
    if (vGap !== null) {
        const xPos = Math.min(b1.x + b1.w / 2, b2.x + b2.w / 2);
        const y1 = b2.y > b1.y ? b1.y + b1.h : b2.y + b2.h;
        const y2 = b2.y > b1.y ? b2.y : b1.y;
        gaps.push(
            <Group key="vgap">
                <Line points={[xPos, y1, xPos, y2]} stroke={DIM_COLOR} strokeWidth={lineWidth} dash={[4 * invZoom, 2 * invZoom]} />
                {renderDistanceLabel(xPos, y1 + (y2 - y1) / 2, vGap, 'y')}
            </Group>
        );
    }

    return <Group>{gaps}</Group>;
}

function ElementWrapper({ el, isSelected, onSelect, onDblClick, onChange }) {
    const { selectedTool } = useUIStore();
    const shapeRef = useRef();
    const trRef = useRef();

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
            // In multi-selection mode, the parent Stage level transformer handles nodes.
            // This local transformer is only for single selection logic if needed, 
            // but we'll unify it in the main component for multi-node support.
            trRef.current.nodes([shapeRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    const handleDragEnd = (e) => {
        onChange(el.id, { x: e.target.x(), y: e.target.y() });
    };

    const handleTransformEnd = (e) => {
        const node = shapeRef.current;
        const updates = {
            x: node.x(), y: node.y(),
            scaleX: node.scaleX(), scaleY: node.scaleY(),
            rotation: node.rotation(),
        };

        // For text elements: 
        if (el.type === 'text') {
            if (el.wrap === 'word' || el.wrap === 'char') {
                updates.scaleX = 1;
                updates.scaleY = 1;
                updates.width = (el.width || 200) * node.scaleX();
                if (node.scaleY() !== 1) {
                    updates.fontSize = Math.max(6, Math.round((el.fontSize || 16) * node.scaleY()));
                }
            } else {
                // Keep scaleX and scaleY for wrap='none' to squash/stretch text
                updates.scaleX = node.scaleX();
                updates.scaleY = node.scaleY();
            }
        }

        onChange(el.id, updates);
    };

    const commonProps = {
        ref: shapeRef,
        id: el.id,
        name: 'design-element',
        x: el.x, y: el.y,
        rotation: el.rotation || 0,
        // Let scaleX and scaleY act normally
        scaleX: el.scaleX || 1,
        scaleY: el.scaleY || 1,
        opacity: el.opacity !== undefined ? el.opacity : 1,
        visible: el.visible !== false,
        draggable: selectedTool === 'pick' && !el.locked,
        listening: selectedTool === 'pick' || selectedTool === 'eyedropper' || selectedTool === 'eraser',
        onClick: () => onSelect(el.id),
        onTap: () => onSelect(el.id),
        onDblClick: () => onDblClick?.(el.id),
        onDragEnd: handleDragEnd,
        onTransformEnd: handleTransformEnd,
    };

    const renderShape = () => {
        const previewData = useDesignStore.getState().previewData;

        // Smart Data Merging for Live Preview
        let displayProps = { ...el };
        if (previewData && (el.type === 'text' || el.type === 'barcode' || el.type === 'qrcode')) {
            const mode = el.mappingMode || (el.autoFill === false ? 'fixed' : 'smart');

            if (el.type === 'text' && el.text) {
                let text = el.text;
                if (mode === 'fixed') {
                    // Do nothing
                } else if (mode === 'value') {
                    // Mode: VALUE (Replace Entire Box)
                    const sortedKeys = Object.keys(previewData).sort((a, b) => b.length - a.length);
                    const match = sortedKeys.find(col => {
                        const escapedCol = col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\b${escapedCol}\\b`, 'gi');
                        return regex.test(text) || el.fieldName === col;
                    });
                    if (match) {
                        text = String(previewData[match] ?? '');
                    } else if (el.fieldName && previewData[el.fieldName] !== undefined) {
                        text = String(previewData[el.fieldName]);
                    }
                    
                    const isPriceField = (el.fieldName && el.fieldName.toLowerCase().includes('mrp')) || (el.text && el.text.includes('₹'));
                    if (isPriceField && text && !text.includes('₹') && /^\d/.test(text)) {
                        text = '₹' + text;
                    }
                } else {
                    // Mode: SMART (Text + Placeholder Logic)
                    // We split by newline to support multi-line boxes (COLOUR, Desc, etc.)
                    const lines = text.split('\n');
                    const processedLines = lines.map(line => {
                        let lineText = line;

                        // 1. Double curly replacements (Highest Priority)
                        Object.keys(previewData).forEach(col => {
                            const placeholder = `{{${col}}}`;
                            if (lineText.includes(placeholder)) {
                                lineText = lineText.replaceAll(placeholder, String(previewData[col] ?? ''));
                            }
                        });

                        // 2. Intelligent "Label : Value" Detection
                        if (lineText.includes(':') && lineText.split(':').length === 2) {
                            const parts = lineText.split(':');
                            const labelPart = parts[0].trim().toLowerCase();
                            const valuePart = parts[1].trim();

                            const matchedHeader = Object.keys(previewData).find(h => h.toLowerCase() === labelPart);
                            if (matchedHeader) {
                                const newVal = previewData[matchedHeader] !== undefined ? String(previewData[matchedHeader]) : valuePart;
                                return `${parts[0]}: ${newVal}`;
                            }
                        }

                        // 3. Standard Word-for-Word Matcher (Fallback)
                        const sortedKeys = Object.keys(previewData).sort((a, b) => b.length - a.length);
                        sortedKeys.forEach(col => {
                            const isSafePlaceholder = /[a-zA-Z]/.test(col);
                            if (!isSafePlaceholder) return;
                            const escapedCol = col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                            
                            // MODIFIED: Stronger protection for MRP labels.
                            const isProtectedMRP = col.toLowerCase() === 'mrp' && lineText.toLowerCase().includes('mrp (incl');
                            if (isProtectedMRP) return;

                            const regex = new RegExp(`\\b${escapedCol}\\b(?![\\s]*[:\\(])`, 'gi');
                            
                            if (regex.test(lineText)) {
                                let newVal = String(previewData[col] ?? '');
                                
                                // Prevent double Rupee symbols
                                const alreadyHasRupee = lineText.includes('₹') || newVal.includes('₹');
                                const isPriceField = (escapedCol.toLowerCase() === 'mrp' || col.toLowerCase() === 'mrp');
                                
                                if (isPriceField && !alreadyHasRupee && /^\d/.test(newVal)) {
                                    newVal = '₹' + newVal;
                                }
                                
                                lineText = lineText.replaceAll(regex, newVal);
                            }
                        });

                        return lineText;
                    });
                    text = processedLines.join('\n');
                }
                
                // MODIFIED: Fix "Incl. of all taxes" issue.
                if (el.text && el.text.toLowerCase().includes('incl.of all taxes')) {
                    text = text.replace(/₹?\s*\d+(\.\d+)?/g, 'MRP'); 
                }
                
                // FINAL CLEANUP: Thoroughly remove any duplicate Rupee symbols or weird spacings
                while (text && /₹\s*₹/.test(text)) {
                    text = text.replace(/₹\s*₹/g, '₹');
                }

                displayProps.text = text;
            } else if (el.type === 'barcode' || el.type === 'qrcode') {
                if (mode !== 'fixed') {
                    const mappedColumn = el.fieldName;
                    if (mappedColumn && previewData[mappedColumn] !== undefined) {
                        const val = String(previewData[mappedColumn]);
                        if (el.type === 'barcode') displayProps.barcodeValue = val;
                        if (el.type === 'qrcode') displayProps.qrValue = val;
                    }
                }
            }
        }

        switch (el.type) {
            case 'text':
                const textValue = displayProps.text || 'Text';
                const tabPos = el.tabPos || 0;

                // Handle Colon Alignment (Tab Stop)
                if (tabPos > 0 && textValue.includes(':')) {
                    const lines = textValue.split('\n');
                    return (
                        <Group {...commonProps}>
                            {lines.map((line, i) => {
                                const colonIndex = line.indexOf(':');
                                if (colonIndex === -1) {
                                    return (
                                        <Text key={i}
                                            y={i * (el.fontSize || 16) * (el.lineHeight || 1.2)}
                                            text={line}
                                            fontSize={el.fontSize || 16}
                                            fontFamily={el.fontFamily || 'Arial'}
                                            fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                            fill={el.fill || '#000000'}
                                        />
                                    );
                                }
                                const label = line.substring(0, colonIndex).trim();
                                const value = line.substring(colonIndex).trim(); // includes the colon
                                
                                return (
                                    <Group key={i} y={i * (el.fontSize || 16) * (el.lineHeight || 1.2)}>
                                        <Text
                                            text={label}
                                            fontSize={el.fontSize || 16}
                                            fontFamily={el.fontFamily || 'Arial'}
                                            fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                            fill={el.fill || '#000000'}
                                        />
                                        <Text
                                            x={tabPos}
                                            text={value}
                                            fontSize={el.fontSize || 16}
                                            fontFamily={el.fontFamily || 'Arial'}
                                            fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                                            fill={el.fill || '#000000'}
                                        />
                                    </Group>
                                );
                            })}
                        </Group>
                    );
                }

                return (
                    <Text {...commonProps}
                        text={textValue}
                        // Defensive: if width < 20px it's corrupted — treat as single line
                        width={(el.wrap === 'none' || (el.width || 200) < 20) ? undefined : (el.width || 200)}
                        fontSize={el.fontSize || 16}
                        fontFamily={el.fontFamily || 'Arial'}
                        fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                        textDecoration={el.underline ? 'underline' : ''}
                        align={el.textAlign || 'left'}
                        fill={el.fill || '#000000'}
                        stroke={el.stroke && el.stroke !== 'transparent' ? el.stroke : undefined}
                        strokeWidth={el.strokeWidth || 0}
                        wrap={(el.width || 200) < 20 ? 'none' : (el.wrap || 'word')}
                        letterSpacing={el.letterSpacing || 0}
                        lineHeight={el.lineHeight || 1.2}
                    />
                );
            case 'rect':
                const isCustomCorner = ['beveled', 'inverted', 'concave'].includes(el.cornerType);
                if (isCustomCorner) {
                    return (
                        <Shape
                            {...commonProps}
                            sceneFunc={(context, shape) => {
                                const w = el.width || 100;
                                const h = el.height || 100;
                                const r = Math.min(el.cornerRadius || 0, w / 2, h / 2);
                                const type = el.cornerType;

                                context.beginPath();
                                if (type === 'beveled') {
                                    context.moveTo(r, 0);
                                    context.lineTo(w - r, 0);
                                    context.lineTo(w, r);
                                    context.lineTo(w, h - r);
                                    context.lineTo(w - r, h);
                                    context.lineTo(r, h);
                                    context.lineTo(0, h - r);
                                    context.lineTo(0, r);
                                } else if (type === 'inverted') {
                                    context.moveTo(r, 0);
                                    context.lineTo(w - r, 0);
                                    context.lineTo(w - r, r);
                                    context.lineTo(w, r);
                                    context.lineTo(w, h - r);
                                    context.lineTo(w - r, h - r);
                                    context.lineTo(w - r, h);
                                    context.lineTo(r, h);
                                    context.lineTo(r, h - r);
                                    context.lineTo(0, h - r);
                                    context.lineTo(0, r);
                                    context.lineTo(r, r);
                                } else if (type === 'concave') {
                                    context.moveTo(r, 0);
                                    context.lineTo(w - r, 0);
                                    context.arc(w - r, -r, r, Math.PI / 2, Math.PI, true);
                                    context.lineTo(w, r);
                                    context.lineTo(w, h - r);
                                    context.arc(w + r, h - r, r, Math.PI, -Math.PI / 2, true);
                                    context.lineTo(w - r, h);
                                    context.lineTo(r, h);
                                    context.arc(r, h + r, r, -Math.PI / 2, 0, true);
                                    context.lineTo(0, h - r);
                                    context.lineTo(0, r);
                                    context.arc(-r, r, r, 0, Math.PI / 2, true);
                                }
                                context.closePath();
                                context.fillStrokeShape(shape);
                            }}
                            width={el.width || 100}
                            height={el.height || 100}
                            fill={el.fill || 'transparent'}
                            stroke={el.stroke || '#000000'}
                            strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2}
                            dash={el.dash}
                        />
                    );
                }
                return <Rect {...commonProps} width={el.width || 50} height={el.height || 40} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} cornerRadius={el.cornerRadius || 0} dash={el.dash} />;
            case 'circle':
                return <Circle {...commonProps} radius={el.radius || 20} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'ellipse':
                return <Ellipse {...commonProps} width={el.width || 60} height={el.height || 40} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'line':
                return <Line {...commonProps} points={el.points || [0, 0, 50, 0]} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} hitStrokeWidth={10} lineCap={el.lineCap || 'round'} lineJoin={el.lineJoin || 'round'} tension={el.tension || 0} dash={el.dash} />;
            case 'triangle':
                return <Line {...commonProps} points={[(el.width || 50) / 2, 0, el.width || 50, el.height || 50, 0, el.height || 50]} closed fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'star':
                return <Star {...commonProps} numPoints={el.numPoints || 5} innerRadius={el.innerRadius || 10} outerRadius={el.outerRadius || 25} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'polygon':
                return <RegularPolygon {...commonProps} sides={el.sides || 6} radius={el.radius || 25} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} dash={el.dash} />;
            case 'diamond':
                return <RegularPolygon {...commonProps} sides={4} rotation={45} radius={el.radius || 25} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} dash={el.dash} />;
            case 'hexagon':
                return <RegularPolygon {...commonProps} sides={6} radius={el.radius || 25} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} dash={el.dash} />;
            case 'octagon':
                return <RegularPolygon {...commonProps} sides={8} radius={el.radius || 25} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} dash={el.dash} />;
            case 'arrow':
                return <Arrow {...commonProps} points={el.points || [0, 0, 50, 0]} pointerLength={10} pointerWidth={10} fill={el.fill || el.stroke || '#000000'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} dash={el.dash} />;
            case 'path':
                return <Path {...commonProps} data={el.data || 'M 0 0 L 100 0 L 50 100 Z'} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'barcode':
                return <BarcodeElement {...commonProps} el={displayProps} onSelect={onSelect} />;
            case 'qrcode':
                return <QRElement {...commonProps} el={displayProps} onSelect={onSelect} />;
            case 'placeholder':
                return (
                    <Group {...commonProps}>
                        <Rect width={el.width || 100} height={el.height || 100} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} dash={el.dash} />
                        <Text width={el.width || 100} height={el.height || 100} text={el.fieldName ? `{{${el.fieldName}}}` : 'No Field Bound'} align="center" verticalAlign="middle" fontSize={Math.min(el.width || 100, el.height || 100) / 4} fill={el.stroke} opacity={0.6} fontStyle="bold" />
                    </Group>
                );
            case 'image':
                return <ImageElement {...commonProps} el={el} />;
            default:
                return <Rect {...commonProps} width={100} height={100} fill="#ccc" />;
        }
    };

    return (
        <>
            {renderShape()}
        </>
    );
}

function InlineTextEditor({ el, onSave, onCancel }) {
    const [text, setText] = useState(el.text || '');
    const textareaRef = useRef();

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }} onMouseDown={(e) => {
            if (e.target === e.currentTarget) onSave(text);
        }}>
            <div style={{
                background: '#fff',
                padding: 16,
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                width: 400,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
            }}>
                <div style={{ fontWeight: '600', fontSize: 16, color: '#333' }}>Enter Text</div>
                <textarea
                    ref={textareaRef}
                    style={{
                        width: '100%',
                        height: 120,
                        fontSize: 16,
                        fontFamily: 'Inter, Arial, sans-serif',
                        padding: 8,
                        border: '1px solid #ccc',
                        borderRadius: 4,
                        resize: 'none',
                        outline: 'none',
                    }}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSave(text);
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            onCancel();
                        }
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button style={{ padding: '6px 16px', background: '#e1dfdd', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }} onClick={onCancel}>Cancel</button>
                    <button style={{ padding: '6px 16px', background: '#0078d7', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => onSave(text)}>Apply</button>
                </div>
            </div>
        </div>
    );
}

export default function DesignCanvas({ stageRef, showGrid = true, onElementDblClick }) {
    const {
        elements, selectedIds, canvasWidth, canvasHeight, canvasRadius, backgroundColor, zoom,
        selectElement, deselectAll, updateElement, updateElementAndSave, addElement,
        setZoom, deleteElement
    } = useDesignStore();
    const { selectedTool, setSelectedTool } = useUIStore();
    const containerRef = useRef();

    // In-place editing
    const [editingTextId, setEditingTextId] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
    const [drawId, setDrawId] = useState(null);
    const [freehandPoints, setFreehandPoints] = useState([]);
    const [isErasing, setIsErasing] = useState(false);
    const [eraserPoints, setEraserPoints] = useState([]);
    const ERASER_SIZE = 20; // eraser brush width in px

    const sortedElements = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // --- CURSOR ---
    const getCursor = () => {
        switch (selectedTool) {
            case 'pick': return 'default';
            case 'zoom-in': return 'zoom-in';
            case 'pan': return 'grab';
            case 'freehand': case 'smart-draw': case 'pen': case 'bezier': return 'crosshair';
            case 'eyedropper': return 'copy';
            case 'eraser': return 'cell';
            case 'draw-rect': case 'draw-rect-rounded': case 'draw-circle': case 'draw-line':
            case 'draw-star': case 'draw-polygon': case 'draw-triangle': return 'crosshair';
            default: return 'default';
        }
    };

    const handleElementClick = (elId) => {
        if (selectedTool === 'eyedropper') {
            const el = elements.find(e => e.id === elId);
            if (el && el.fill) {
                navigator.clipboard?.writeText(el.fill);
                useUIStore.getState().setPickedColor?.(el.fill);
            }
            selectElement(elId, false);
            return;
        }

        if (selectedTool === 'eraser') return;

        // In-place edit trigger: click on already selected text
        if (selectedIds.includes(elId) && selectedIds.length === 1) {
            const el = elements.find(e => e.id === elId);
            if (el && el.type === 'text') {
                setEditingTextId(elId);
                return;
            }
        }

        // Pass ctrlKey to store for multi-selection
        const ctrlKey = window.event?.ctrlKey || false;
        selectElement(elId, ctrlKey);
    };

    // --- TRANSFORMER FOR MULTI-SELECTION ---
    const trRef = useRef();
    useEffect(() => {
        if (trRef.current) {
            const nodes = selectedIds
                .map(id => stageRef.current.findOne('#' + id))
                .filter(node => node);
            trRef.current.nodes(nodes);
            trRef.current.getLayer().batchDraw();
        }
    }, [selectedIds, elements]);

    const handleTransformEnd = () => {
        const nodes = trRef.current.nodes();
        nodes.forEach(node => {
            const el = elements.find(e => e.id === node.id());
            if (!el) return;

            let updates = {
                x: node.x(), y: node.y(),
                rotation: node.rotation(),
                scaleX: node.scaleX(),
                scaleY: node.scaleY()
            };

            if (el.type === 'text') {
                if (el.wrap === 'word' || el.wrap === 'char') {
                    updates.scaleX = 1;
                    updates.scaleY = 1;
                    updates.width = Math.max(20, (el.width || 200) * node.scaleX());
                    if (node.scaleY() !== 1) {
                        updates.fontSize = Math.max(6, Math.round((el.fontSize || 16) * node.scaleY()));
                    }
                } else {
                    updates.scaleX = node.scaleX();
                    updates.scaleY = node.scaleY();
                }
            }
            
            updateElementAndSave(node.id(), updates);
        });
    };

    // --- MOUSE DOWN ---
    const handleStageMouseDown = (e) => {
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();

        // Eraser — start collecting eraser stroke points
        if (selectedTool === 'eraser') {
            setIsErasing(true);
            setEraserPoints([pos.x, pos.y]);
            return;
        }

        // Freehand / Smart Draw
        if (['freehand', 'smart-draw'].includes(selectedTool)) {
            setFreehandPoints([pos.x, pos.y]);
            setIsDrawing(true);
            return;
        }

        // Zoom
        if (selectedTool === 'zoom-in') {
            setZoom(Math.min(zoom + 0.25, 8));
            return;
        }

        // Drag-to-draw shapes
        const drawTools = {
            'draw-rect': 'rect', 'draw-rect-rounded': 'rect', 'draw-circle': 'circle', 'draw-line': 'line',
            'draw-star': 'star', 'draw-polygon': 'polygon', 'draw-triangle': 'triangle',
            'draw-diamond': 'diamond', 'draw-hexagon': 'hexagon', 'draw-octagon': 'octagon', 'draw-arrow': 'arrow',
            'text': 'text', 'barcode': 'barcode', 'qrcode': 'qrcode', 'placeholder': 'placeholder',
        };

        const isExtendedTool = selectedTool && selectedTool.startsWith('barcode-');
        const activeToolKey = isExtendedTool ? 'barcode' : selectedTool;
        const toolFormat = isExtendedTool ? selectedTool.split('-')[1] : null;

        if (drawTools[activeToolKey]) {
            const shapeType = drawTools[activeToolKey];
            const newEl = addElement(shapeType, {
                x: pos.x, y: pos.y,
                width: 1, height: 1,
                radius: 1, outerRadius: 1,
                points: shapeType === 'line' ? [0, 0, 0, 0] : undefined,
                ...(toolFormat && shapeType === 'barcode' ? { barcodeFormat: toolFormat } : {}),
                ...(activeToolKey === 'draw-rect-rounded' ? { cornerRadius: 15, cornerType: 'rounded' } : {})
            });
            setDrawId(newEl.id);
            setDrawStart(pos);
            setIsDrawing(true);
            selectElement(newEl.id);
            return;
        }

        // Click on empty stage = deselect
        if (e.target === e.target.getStage()) {
            deselectAll();
        }
    };

    // --- MOUSE MOVE ---
    const handleStageMouseMove = (e) => {
        // Eraser drag — collect points for eraser stroke
        if (isErasing && selectedTool === 'eraser') {
            const stage = e.target.getStage();
            const pos = stage.getRelativePointerPosition();
            setEraserPoints(prev => [...prev, pos.x, pos.y]);
            return;
        }

        if (!isDrawing) return;
        const stage = e.target.getStage();
        const pos = stage.getRelativePointerPosition();

        // Freehand
        if (['freehand', 'smart-draw'].includes(selectedTool)) {
            setFreehandPoints(prev => [...prev, pos.x, pos.y]);
            return;
        }

        // Drag-to-draw shapes
        if (drawId) {
            const dx = pos.x - drawStart.x;
            const dy = pos.y - drawStart.y;
            const shapeType = { 'draw-rect': 'rect', 'draw-rect-rounded': 'rect', 'draw-circle': 'circle', 'draw-line': 'line', 'draw-star': 'star', 'draw-polygon': 'polygon', 'draw-triangle': 'triangle' }[selectedTool];

            const updates = {};
            if (shapeType === 'circle') {
                updates.radius = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            } else if (shapeType === 'star') {
                const r = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                updates.outerRadius = r;
                updates.innerRadius = r / 2.5;
            } else if (['polygon', 'hexagon', 'octagon', 'diamond'].includes(shapeType)) {
                updates.radius = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            } else if (shapeType === 'line' || shapeType === 'arrow') {
                updates.points = [0, 0, dx, dy];
            } else {
                updates.width = Math.max(1, Math.abs(dx));
                updates.height = Math.max(1, Math.abs(dy));
                if (dx < 0) updates.x = pos.x;
                if (dy < 0) updates.y = pos.y;
            }
            updateElement(drawId, updates);
        }
    };

    // --- MOUSE UP ---
    const handleStageMouseUp = () => {
        // Eraser — create a background-colored stroke as an "eraser mark"
        if (isErasing && eraserPoints.length >= 4) {
            addElement('line', {
                points: eraserPoints,
                stroke: backgroundColor,
                strokeWidth: ERASER_SIZE,
                x: 0, y: 0,
                tension: 0,
                lineCap: 'round',
                lineJoin: 'round',
                isEraserMark: true, // flag so we know it's an eraser stroke
                name: 'eraser_mark',
            });
            setEraserPoints([]);
            setIsErasing(false);
            return;
        }
        setIsErasing(false);

        if (!isDrawing) return;

        // Freehand — create a line element from all collected points
        if (['freehand', 'smart-draw'].includes(selectedTool) && freehandPoints.length >= 4) {
            addElement('line', {
                points: freehandPoints,
                stroke: '#000000',
                strokeWidth: 2,
                x: 0, y: 0,
                tension: selectedTool === 'smart-draw' ? 0.4 : 0,
            });
            setFreehandPoints([]);
            // Switch back to pick tool after drawing
            setSelectedTool('pick');
        }

        // Finalize drag-to-draw
        if (drawId) {
            updateElementAndSave(drawId, {});
            const currentEl = elements.find(e => e.id === drawId);
            setDrawId(null);
            // Switch back to pick tool after drawing
            setSelectedTool('pick');

            if (currentEl) {
                if (currentEl.type === 'text') {
                    // Start inline text editing overlay for new wrapped text like Word
                    setTimeout(() => setEditingTextId(currentEl.id), 50);
                } else if (currentEl.type === 'barcode' && onElementDblClick) {
                    setTimeout(() => onElementDblClick(currentEl.id), 50);
                }
            }
        }

        setIsDrawing(false);
    };

    // --- KEYBOARD ---
    const handleKeyDown = useCallback((e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        // Arrow Key Nudging
        // Arrow Key Nudging for Multiple Elements
        if (selectedIds.length > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const shift = e.shiftKey ? 10 : 1;
            selectedIds.forEach(id => {
                const el = elements.find(el => el.id === id);
                if (el) {
                    const updates = {};
                    if (e.key === 'ArrowUp') updates.y = el.y - shift;
                    if (e.key === 'ArrowDown') updates.y = el.y + shift;
                    if (e.key === 'ArrowLeft') updates.x = el.x - shift;
                    if (e.key === 'ArrowRight') updates.x = el.x + shift;
                    updateElementAndSave(id, updates);
                }
            });
            return;
        }

        if (e.key === 'Delete') {
            if (selectedIds.length > 0) deleteElement(selectedIds);
        }
        if (e.key === 'v') setSelectedTool('pick');
        if (e.key === 't') setSelectedTool('text');
        if (e.key === 'b') setSelectedTool('barcode');

    }, [selectedIds, elements]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Canvas corner radius from store
    const CANVAS_RADIUS = canvasRadius || 0;

    return (
        <div ref={containerRef} className="canvas-wrapper" onClick={(e) => { if (e.target === containerRef.current) deselectAll(); }}>
            {/* Outer clip div — gives the CSS rounded box + shadow */}
            <div
                style={{
                    borderRadius: CANVAS_RADIUS * zoom,
                    overflow: 'hidden',
                    boxShadow: '0 6px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)',
                    display: 'block',
                    lineHeight: 0,
                    background: backgroundColor,
                    width: canvasWidth * zoom,
                    height: canvasHeight * zoom,
                }}
            >
                <Stage
                    ref={stageRef}
                    width={canvasWidth * zoom}
                    height={canvasHeight * zoom}
                    scaleX={zoom}
                    scaleY={zoom}
                    pixelRatio={window.devicePixelRatio || 2}
                    style={{
                        background: 'transparent',
                        display: 'block',
                        cursor: getCursor(),
                    }}
                    onMouseDown={handleStageMouseDown}
                    onMouseMove={handleStageMouseMove}
                    onMouseUp={handleStageMouseUp}
                    onMouseLeave={handleStageMouseUp}
                    onTouchStart={handleStageMouseDown}
                    onTouchMove={handleStageMouseMove}
                    onTouchEnd={handleStageMouseUp}
                >
                    {/* Background layer: fills the rounded rect with the label colour */}
                    <Layer
                        clipFunc={(ctx) => {
                            const r = CANVAS_RADIUS;
                            const w = canvasWidth;
                            const h = canvasHeight;
                            ctx.beginPath();
                            ctx.moveTo(r, 0);
                            ctx.lineTo(w - r, 0);
                            ctx.quadraticCurveTo(w, 0, w, r);
                            ctx.lineTo(w, h - r);
                            ctx.quadraticCurveTo(w, h, w - r, h);
                            ctx.lineTo(r, h);
                            ctx.quadraticCurveTo(0, h, 0, h - r);
                            ctx.lineTo(0, r);
                            ctx.quadraticCurveTo(0, 0, r, 0);
                            ctx.closePath();
                        }}
                    >
                        {/* White background rect */}
                        <Rect
                            x={0} y={0}
                            width={canvasWidth}
                            height={canvasHeight}
                            fill={backgroundColor}
                        />
                        {showGrid && <GridLayer width={canvasWidth} height={canvasHeight} />}
                    </Layer>
                    {/* Elements layer — also clipped to rounded rect */}
                    <Layer
                        clipFunc={(ctx) => {
                            const r = CANVAS_RADIUS;
                            const w = canvasWidth;
                            const h = canvasHeight;
                            ctx.beginPath();
                            ctx.moveTo(r, 0);
                            ctx.lineTo(w - r, 0);
                            ctx.quadraticCurveTo(w, 0, w, r);
                            ctx.lineTo(w, h - r);
                            ctx.quadraticCurveTo(w, h, w - r, h);
                            ctx.lineTo(r, h);
                            ctx.quadraticCurveTo(0, h, 0, h - r);
                            ctx.lineTo(0, r);
                            ctx.quadraticCurveTo(0, 0, r, 0);
                            ctx.closePath();
                        }}
                    >
                        {sortedElements.filter(el => el.visible !== false).map(el => (
                            <ElementWrapper
                                key={el.id}
                                el={el}
                                isSelected={selectedIds.includes(el.id)}
                                onSelect={handleElementClick}
                                onDblClick={onElementDblClick}
                                onChange={(id, updates) => updateElementAndSave(id, updates)}
                            />
                        ))}
                        {selectedIds.length > 0 && (
                            <Transformer
                                ref={trRef}
                                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
                                rotateEnabled={true}
                                // BarTender exact: Green circular handles with blue rotation anchor
                                anchorFill="white"
                                anchorStroke="#4CAF50"
                                anchorSize={7}
                                anchorCornerRadius={10}
                                borderStroke="#4CAF50"
                                borderDash={[]}
                                borderStrokeWidth={1.2}
                                rotateAnchorOffset={30}
                                enabledAnchors={
                                    selectedIds.length === 1 &&
                                        elements.find(e => e.id === selectedIds[0])?.type === 'text'
                                        ? ['middle-left', 'middle-right'] // BarTender wrap text usually just has side handles for width
                                        : ['top-left', 'top-center', 'top-right', 'middle-right', 'middle-left', 'bottom-left', 'bottom-center', 'bottom-right']
                                }
                                // Custom rotation anchor style
                                anchorStyleFunc={(anchor) => {
                                    if (anchor.hasName('rotater')) {
                                        anchor.fill('#00c0ff');
                                        anchor.stroke('#0078d7');
                                        anchor.cornerRadius(10);
                                    }
                                    return anchor;
                                }}
                                onTransformEnd={handleTransformEnd}
                            />
                        )}
                        {selectedIds.length === 2 && (
                            <GapDimensions 
                                el1={elements.find(e => e.id === selectedIds[0])}
                                el2={elements.find(e => e.id === selectedIds[1])}
                                zoom={zoom}
                            />
                        )}
                    </Layer>


                    {/* Live freehand preview while drawing */}
                    {freehandPoints.length >= 4 && (
                        <Layer>
                            <Line
                                points={freehandPoints}
                                stroke="#000000"
                                strokeWidth={2}
                                lineCap="round"
                                lineJoin="round"
                                tension={selectedTool === 'smart-draw' ? 0.4 : 0}
                            />
                        </Layer>
                    )}

                    {/* Live eraser preview while dragging */}
                    {isErasing && eraserPoints.length >= 4 && (
                        <Layer>
                            <Line
                                points={eraserPoints}
                                stroke={backgroundColor}
                                strokeWidth={ERASER_SIZE}
                                lineCap="round"
                                lineJoin="round"
                                tension={0}
                            />
                        </Layer>
                    )}


                </Stage>

                {/* Inline Editors (Native HTML over Stage) */}
                {editingTextId && (
                    <InlineTextEditor
                        el={elements.find(e => e.id === editingTextId)}
                        zoom={zoom}
                        onSave={(text) => {
                            updateElementAndSave(editingTextId, { text });
                            setEditingTextId(null);
                        }}
                        onCancel={() => setEditingTextId(null)}
                    />
                )}
                {/* Gap Input Overlay */}
                {selectedIds.length === 2 && (() => {
                    const el1 = elements.find(e => e.id === selectedIds[0]);
                    const el2 = elements.find(e => e.id === selectedIds[1]);
                    if (!el1 || !el2) return null;
                    const b1 = getElementBounds(el1);
                    const b2 = getElementBounds(el2);
                    
                    const vGap = b2.y > b1.y + b1.h ? b2.y - (b1.y + b1.h) : (b1.y > b2.y + b2.h ? b1.y - (b2.y + b2.h) : null);
                    if (vGap === null) return null;
                    
                    const xPos = Math.min(b1.x + b1.w / 2, b2.x + b2.w / 2);
                    const y1 = b2.y > b1.y ? b1.y + b1.h : b2.y + b2.h;
                    const y2 = b2.y > b1.y ? b2.y : b1.y;
                    const yPos = y1 + (y2 - y1) / 2;
                    
                    const measurementUnit = useUIStore.getState().measurementUnit;

                    return (
                        <div style={{
                            position: 'absolute',
                            top: yPos * zoom,
                            left: xPos * zoom,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10000,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            background: '#fff',
                            padding: '2px 4px',
                            borderRadius: 4,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            border: `1px solid ${DIM_COLOR}`,
                            pointerEvents: 'auto'
                        }}>
                            <span style={{ fontSize: 10, color: DIM_COLOR, fontWeight: 'bold' }}>Gap:</span>
                            <NumericInput 
                                value={Number(pxToUnit(vGap, measurementUnit).toFixed(2))}
                                onChange={v => {
                                    const px = unitToPx(v, measurementUnit);
                                    useDesignStore.getState().setElementDistance(el1.id, el2.id, 'y', px);
                                }}
                                style={{ width: 42, fontSize: 11, border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: DIM_COLOR }}
                            />
                            <span style={{ fontSize: 9, color: '#666' }}>{measurementUnit}</span>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
