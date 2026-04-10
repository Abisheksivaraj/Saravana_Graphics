import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Stage, Layer, Text, Rect, Circle, Ellipse, Line, Image as KImage, Transformer, Group, Star, RegularPolygon, Path } from 'react-konva';
import { useDesignStore } from '../store/designStore';
import { useUIStore } from '../store/uiStore';
import BarcodeElement from './BarcodeElement';
import QRElement from './QRElement';
import ImageElement from './ImageElement';

const GRID_SIZE = 10;

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

function ElementWrapper({ el, isSelected, onSelect, onChange }) {
    const shapeRef = useRef();
    const trRef = useRef();

    useEffect(() => {
        if (isSelected && trRef.current && shapeRef.current) {
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
        draggable: !el.locked,
        onClick: () => onSelect(el.id),
        onTap: () => onSelect(el.id),
        onDragEnd: handleDragEnd,
        onTransformEnd: handleTransformEnd,
    };

    const renderShape = () => {
        switch (el.type) {
            case 'text':
                return (
                    <Text {...commonProps}
                        text={el.text || 'Text'}
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
                            textarea.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' || ev.key === 'Enter' && !ev.shiftKey) { onChange(el.id, { text: textarea.value }); document.body.removeChild(textarea); } });
                            textarea.addEventListener('blur', () => { onChange(el.id, { text: textarea.value }); if (document.body.contains(textarea)) document.body.removeChild(textarea); });
                        }}
                    />
                );
            case 'rect':
                return <Rect {...commonProps} width={el.width || 100} height={el.height || 80} fill={el.fill || '#6c63ff'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} cornerRadius={el.cornerRadius || 0} />;
            case 'circle':
                return <Circle {...commonProps} radius={el.radius || 50} fill={el.fill || '#ff6584'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'ellipse':
                return <Ellipse {...commonProps} width={el.width || 120} height={el.height || 80} fill={el.fill || '#ff6584'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'line':
                return <Line {...commonProps} points={el.points || [0, 0, 100, 0]} stroke={el.stroke || '#000'} strokeWidth={el.strokeWidth || 2} hitStrokeWidth={10} lineCap="round" lineJoin="round" tension={el.tension || 0} />;
            case 'triangle':
                return <Line {...commonProps} points={[el.width / 2 || 50, 0, el.width || 100, el.height || 100, 0, el.height || 100]} closed fill={el.fill || '#22c55e'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'star':
                return <Star {...commonProps} numPoints={el.numPoints || 5} innerRadius={el.innerRadius || 20} outerRadius={el.outerRadius || 50} fill={el.fill || '#fbbf24'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'polygon':
                return <RegularPolygon {...commonProps} sides={el.sides || 6} radius={el.radius || 50} fill={el.fill || '#8b5cf6'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'path':
                return <Path {...commonProps} data={el.data || 'M 0 0 L 100 0 L 50 100 Z'} fill={el.fill || '#3b82f6'} stroke={el.stroke} strokeWidth={el.strokeWidth || 0} />;
            case 'barcode':
                return <BarcodeElement {...commonProps} el={el} />;
            case 'qrcode':
                return <QRElement {...commonProps} el={el} />;
            case 'image':
                return <ImageElement {...commonProps} el={el} />;
            default:
                return <Rect {...commonProps} width={100} height={100} fill="#ccc" />;
        }
    };

    return (
        <>
            {renderShape()}
            {isSelected && (
                <Transformer
                    ref={trRef}
                    boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
                    rotateEnabled={true}
                    enabledAnchors={el.type === 'circle' ? ['top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined}
                />
            )}
        </>
    );
}

export default function DesignCanvas({ stageRef, showGrid = true }) {
    const {
        elements, selectedId, canvasWidth, canvasHeight, backgroundColor, zoom,
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

    // --- ELEMENT CLICK (eyedropper / eraser) ---
    const handleElementClick = (elId) => {
        if (selectedTool === 'eyedropper') {
            const el = elements.find(e => e.id === elId);
            if (el && el.fill) {
                navigator.clipboard?.writeText(el.fill);
                // Store picked color in uiStore for re-use
                useUIStore.getState().setPickedColor?.(el.fill);
            }
            selectElement(elId);
            return;
        }

        if (selectedTool === 'eraser') {
            // In eraser mode, don't select — erasing is done via drag
            return;
        }

        selectElement(elId);
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
            } else if (shapeType === 'polygon') {
                updates.radius = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            } else if (shapeType === 'line') {
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
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedId) deleteElement(selectedId);
        }
        if (e.key === 'v') setSelectedTool('pick');
        if (e.key === 'Escape') { setSelectedTool('pick'); deselectAll(); }
    }, [selectedId]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div ref={containerRef} className="canvas-wrapper" onClick={(e) => { if (e.target === containerRef.current) deselectAll(); }}>
            <Stage
                ref={stageRef}
                width={canvasWidth * zoom}
                height={canvasHeight * zoom}
                scaleX={zoom}
                scaleY={zoom}
                style={{
                    background: backgroundColor,
                    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                    borderRadius: 2,
                    cursor: getCursor(),
                }}
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onTouchStart={handleStageMouseDown}
                onTouchMove={handleStageMouseMove}
                onTouchEnd={handleStageMouseUp}
            >
                <Layer>
                    {showGrid && <GridLayer width={canvasWidth} height={canvasHeight} />}
                </Layer>
                <Layer>
                    {sortedElements.filter(el => el.visible !== false).map(el => (
                        <ElementWrapper
                            key={el.id}
                            el={el}
                            isSelected={selectedId === el.id}
                            onSelect={handleElementClick}
                            onChange={(id, updates) => updateElementAndSave(id, updates)}
                        />
                    ))}
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
        </div>
    );
}
