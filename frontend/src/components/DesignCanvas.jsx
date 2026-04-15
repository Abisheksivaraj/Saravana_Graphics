import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer, Text, Rect, Circle, Ellipse, Line, Arrow, Image as KImage, Transformer, Group, Star, RegularPolygon, Path } from 'react-konva';
import { useDesignStore } from '../store/designStore';
import { useUIStore, pxToUnit, unitToPx } from '../store/uiStore';
import BarcodeElement from './BarcodeElement';
import QRElement from './QRElement';
import ImageElement from './ImageElement';

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
        const label = `${formatVal(val)} ${measurementUnit}`;
        return (
            <Group
                x={x} y={y}
                onDblClick={(e) => {
                    const stage = e.target.getStage();
                    const container = stage.container();
                    const pointerPos = stage.getPointerPosition();
                    
                    const input = document.createElement('input');
                    input.type = 'number';
                    input.value = formatVal(val);
                    input.style.cssText = `position:absolute;top:${pointerPos.y}px;left:${pointerPos.x}px;width:60px;z-index:1000;padding:2px;border:1px solid ${DIM_COLOR};border-radius:4px;`;
                    container.appendChild(input);
                    input.focus();
                    
                    const commit = () => {
                        const newDistPx = unitToPx(Number(input.value), measurementUnit);
                        if (!isNaN(newDistPx)) {
                            setElementDistance(el1.id, el2.id, axis, newDistPx);
                        }
                        if (container.contains(input)) container.removeChild(input);
                    };

                    input.onkeydown = (ev) => { 
                        if (ev.key === 'Enter') { ev.stopPropagation(); commit(); }
                        if (ev.key === 'Escape') { ev.stopPropagation(); if (container.contains(input)) container.removeChild(input); }
                    };
                    input.onblur = commit;
                }}
            >
                <Rect
                    x={-(label.length * fontSize * 0.35)}
                    y={-fontSize / 2 - 1 * invZoom}
                    width={label.length * fontSize * 0.7}
                    height={fontSize + 2 * invZoom}
                    fill="white"
                    stroke={DIM_COLOR}
                    strokeWidth={0.5 * invZoom}
                    cornerRadius={2 * invZoom}
                    shadowBlur={2 * invZoom}
                    shadowOpacity={0.2}
                />
                <Text
                    x={-(label.length * fontSize * 0.35)}
                    y={-fontSize / 2}
                    text={label}
                    fontSize={fontSize}
                    fontFamily="Inter, Arial, sans-serif"
                    fontStyle="bold"
                    fill={DIM_COLOR}
                    width={label.length * fontSize * 0.7}
                    align="center"
                    listening={true}
                />
            </Group>
        );
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
        onChange(el.id, {
            x: node.x(), y: node.y(),
            scaleX: node.scaleX(), scaleY: node.scaleY(),
            rotation: node.rotation(),
        });
    };

    const commonProps = {
        ref: shapeRef,
        id: el.id,
        name: 'design-element',
        x: el.x, y: el.y,
        rotation: el.rotation || 0,
        scaleX: el.scaleX || 1, scaleY: el.scaleY || 1,
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
                            const regex = new RegExp(`\\b${escapedCol}\\b(?![\\s]*:)`, 'gi');
                            if (regex.test(lineText)) {
                                lineText = lineText.replaceAll(regex, String(previewData[col] ?? ''));
                            }
                        });
                        
                        return lineText;
                    });
                    text = processedLines.join('\n');
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
                return (
                    <Text {...commonProps}
                        text={displayProps.text || 'Text'}
                        fontSize={el.fontSize || 16}
                        fontFamily={el.fontFamily || 'Arial'}
                        fontStyle={`${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight || 'normal'}`}
                        textDecoration={el.underline ? 'underline' : ''}
                        align={el.textAlign || 'left'}
                        fill={el.fill || '#000000'}
                        stroke={el.stroke && el.stroke !== 'transparent' ? el.stroke : undefined}
                        strokeWidth={el.strokeWidth || 0}
                        width={el.width || 200}
                        wrap="word"
                        onDblClick={(e) => {
                            const textNode = e.target;
                            const stage = textNode.getStage();
                            const textPosition = textNode.absolutePosition();
                            const areaPosition = { x: stage.container().offsetLeft + textPosition.x, y: stage.container().offsetTop + textPosition.y };
                            const textarea = document.createElement('textarea');
                            document.body.appendChild(textarea);
                            textarea.value = el.text;
                            textarea.style.cssText = `position:absolute;top:${areaPosition.y}px;left:${areaPosition.x}px;width:${textNode.width() * textNode.scaleX()}px;min-height:40px;font-size:${el.fontSize}px;font-family:${el.fontFamily};background:rgba(255,255,255,0.95);color:#000;border:2px solid #6c63ff;border-radius:4px;padding:4px;resize:none;overflow:hidden;z-index:999;`;
                            textarea.focus();
                            textarea.addEventListener('keydown', (ev) => { 
                                if (ev.key === 'Escape' || (ev.key === 'Enter' && !ev.shiftKey)) { 
                                    ev.stopPropagation(); 
                                    onChange(el.id, { text: textarea.value }); 
                                    if (document.body.contains(textarea)) document.body.removeChild(textarea); 
                                } 
                            });
                            textarea.addEventListener('blur', () => { onChange(el.id, { text: textarea.value }); if (document.body.contains(textarea)) document.body.removeChild(textarea); });
                        }}
                    />
                );
            case 'rect':
                return <Rect {...commonProps} width={el.width || 50} height={el.height || 40} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} cornerRadius={el.cornerRadius || 0} />;
            case 'circle':
                return <Circle {...commonProps} radius={el.radius || 20} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'ellipse':
                return <Ellipse {...commonProps} width={el.width || 60} height={el.height || 40} fill={el.fill || 'transparent'} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} />;
            case 'line':
                return <Line {...commonProps} points={el.points || [0, 0, 50, 0]} stroke={el.stroke || '#000000'} strokeWidth={el.strokeWidth !== undefined ? el.strokeWidth : 2} hitStrokeWidth={10} lineCap="round" lineJoin="round" tension={el.tension || 0} />;
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
            {/* Transformer is now handled at the stage level for multi-selection support */}
        </>
    );
}

export default function DesignCanvas({ stageRef, showGrid = true, onElementDblClick }) {
    const {
        elements, selectedIds, canvasWidth, canvasHeight, backgroundColor, zoom,
        selectElement, deselectAll, updateElement, updateElementAndSave, addElement,
        setZoom, deleteElement
    } = useDesignStore();
    const { selectedTool, setSelectedTool } = useUIStore();
    const containerRef = useRef();

    // Drawing state
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
            case 'draw-rect': case 'draw-circle': case 'draw-line':
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
            updateElementAndSave(node.id(), {
                x: node.x(), y: node.y(),
                scaleX: node.scaleX(), scaleY: node.scaleY(),
                rotation: node.rotation()
            });
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
            'draw-rect': 'rect', 'draw-circle': 'circle', 'draw-line': 'line',
            'draw-star': 'star', 'draw-polygon': 'polygon', 'draw-triangle': 'triangle',
            'draw-diamond': 'diamond', 'draw-hexagon': 'hexagon', 'draw-octagon': 'octagon', 'draw-arrow': 'arrow',
            'text': 'text', 'barcode': 'barcode', 'qrcode': 'qrcode', 'placeholder': 'placeholder',
        };
        if (drawTools[selectedTool]) {
            const shapeType = drawTools[selectedTool];
            const newEl = addElement(shapeType, {
                x: pos.x, y: pos.y,
                width: 1, height: 1,
                radius: 1, outerRadius: 1,
                points: shapeType === 'line' ? [0, 0, 0, 0] : undefined,
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
            const shapeType = { 'draw-rect': 'rect', 'draw-circle': 'circle', 'draw-line': 'line', 'draw-star': 'star', 'draw-polygon': 'polygon', 'draw-triangle': 'triangle' }[selectedTool];

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
        }

        // Finalize drag-to-draw
        if (drawId) {
            updateElementAndSave(drawId, {});
            setDrawId(null);
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

        if (e.key === 'Delete' || e.key === 'Backspace') {
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

    // Corner radius for the label in canvas pixels (unscaled)
    const CANVAS_RADIUS = 18;

    return (
        <div ref={containerRef} className="canvas-wrapper" onClick={(e) => { if (e.target === containerRef.current) deselectAll(); }}>
            {/* Outer clip div — gives the CSS rounded box + shadow */}
            <div
                style={{
                    borderRadius: CANVAS_RADIUS,
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
                            anchorFill="#ffffff"
                            anchorStroke="#3c8ae8"
                            anchorSize={8}
                            borderStroke="#3c8ae8"
                            borderDash={[4, 2]}
                            borderStrokeWidth={1}
                            onTransformEnd={handleTransformEnd}
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

                {/* CAD-Style Dimension Annotations */}
                <Layer>
                    {(() => {
                        const activeId = drawId || selectedIds[0];
                        if (!activeId) return null;
                        const activeEl = elements.find(el => el.id === activeId);
                        if (!activeEl) return null;
                        
                        return (
                            <>
                                <DimensionLines el={activeEl} zoom={zoom} />
                                {selectedIds.length === 2 && (() => {
                                    const el2 = elements.find(el => el.id === selectedIds[1]);
                                    if (el2) return <GapDimensions el1={activeEl} el2={el2} zoom={zoom} />;
                                    return null;
                                })()}
                            </>
                        );
                    })()}
                </Layer>
            </Stage>
            </div>
        </div>
    );
}
