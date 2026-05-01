import React, { useMemo, useState, useEffect } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

// 2D formats that cannot be rendered by JsBarcode
const TWOD_FORMATS = ['QRCODE', 'DATAMATRIX', 'PDF417'];

/**
 * Renders a 2D barcode to an offscreen canvas and returns
 * an HTMLImageElement ready for Konva's <Image>.
 *
 * - QRCODE  → uses the `qrcode` npm package (most reliable in browser)
 * - Others  → uses bwip-js (loaded lazily to avoid bundle issues)
 */
function use2DBarcode(value, format, width, height) {
    const [img, setImg] = useState(null);

    useEffect(() => {
        if (!value || !format) { setImg(null); return; }

        let cancelled = false;

        async function render() {
            try {
                let dataURL = null;

                if (format === 'QRCODE') {
                    // qrcode library — most reliable browser QR renderer
                    dataURL = await QRCode.toDataURL(value, {
                        errorCorrectionLevel: 'M',
                        margin: 1,
                        width: Math.max(width, height) * 2, // high-res for crisp rendering
                        color: { dark: '#000000', light: '#ffffff' },
                    });
                } else {
                    // bwip-js for DataMatrix / PDF417
                    const bwipjs = await import('bwip-js');
                    const canvas = document.createElement('canvas');

                    const bcidMap = { DATAMATRIX: 'datamatrix', PDF417: 'pdf417' };
                    const bcid = bcidMap[format];
                    if (!bcid) return;

                    await bwipjs.toCanvas(canvas, {
                        bcid,
                        text: value,
                        scale: 4,
                        width:  Math.max(10, Math.round(width  / 4)),
                        height: Math.max(10, Math.round(height / 4)),
                        includetext: false,
                        backgroundcolor: 'ffffff',
                    });
                    dataURL = canvas.toDataURL('image/png');
                }

                if (!dataURL || cancelled) return;

                const imageEl = new window.Image();
                imageEl.onload = () => { if (!cancelled) setImg(imageEl); };
                imageEl.onerror = () => { console.warn('2D barcode image load failed'); };
                imageEl.src = dataURL;

            } catch (e) {
                console.warn('2D barcode render error:', e);
                if (!cancelled) setImg(null);
            }
        }

        render();
        return () => { cancelled = true; };

    }, [value, format, width, height]);

    return img;
}

export default function BarcodeElement({ el, isSelected, onSelect, ...props }) {
    const elWidth  = el.width  || 200;
    const elHeight = el.height || 80;
    const value    = el.barcodeValue  || '123456789012';
    const format   = (el.barcodeFormat || 'CODE128').toUpperCase();

    const is2D    = TWOD_FORMATS.includes(format);
    const isEAN13 = format === 'EAN13' && (value.length === 12 || value.length === 13);

    // ── 2D rendering ──────────────────────────────────────────────────────────
    const img2D = use2DBarcode(is2D ? value : null, is2D ? format : null, elWidth, elHeight);

    // ── 1D rendering (unchanged) ──────────────────────────────────────────────
    const data1D = useMemo(() => {
        if (is2D) return null;

        try {
            const barcodeObj = {};
            JsBarcode(barcodeObj, value, {
                format,
                margin: 0,
                displayValue: false,
            });

            const encodings = barcodeObj.encodings || [];
            if (encodings.length === 0) return null;

            let totalUnits = 0;
            encodings.forEach(e => (totalUnits += e.data.length));

            const paddingLeft = isEAN13 ? elWidth * 0.08 : 0;
            const drawWidth   = elWidth - paddingLeft;
            const unitWidth   = drawWidth / totalUnits;

            let currentX = paddingLeft;
            const barNodes = [];

            encodings.forEach((encoding, encIdx) => {
                const binaryData = encoding.data;
                const isGuard    = isEAN13 && (encIdx === 0 || encIdx === 2 || encIdx === 4);

                for (let i = 0; i < binaryData.length; i++) {
                    if (binaryData[i] === '1') {
                        let span = 1;
                        while (i + span < binaryData.length && binaryData[i + span] === '1') span++;

                        // Revert to respecting elHeight as requested ("keep as it is in old")
                        const barHeight = isEAN13 
                            ? (isGuard ? elHeight : elHeight * 0.82) 
                            : (isGuard ? elHeight : elHeight * 0.82);

                        barNodes.push({
                            x:      currentX,
                            width:  unitWidth * span,
                            height: barHeight,
                            fill:   el.fill || '#000000',
                            key:    `bar-${encIdx}-${i}`,
                        });

                        currentX += unitWidth * span;
                        i += span - 1;
                    } else {
                        currentX += unitWidth;
                    }
                }
            });

            return { barNodes, paddingLeft, drawWidth, unitWidth };
        } catch (e) {
            console.warn('1D barcode encode error:', e);
            return null;
        }
    }, [value, format, elWidth, elHeight, el.fill, isEAN13, is2D]);

    // ── Text below 1D barcode ─────────────────────────────────────────────────
    const renderText = () => {
        const textStyle = {
            fontSize:       el.fontSize   || (isEAN13 ? 10 : elHeight * 0.12),
            fontFamily:     el.fontFamily || 'Arial',
            fontStyle:      `${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight === 'bold' ? 'bold' : 'normal'}`,
            fill:           el.fill || '#000000',
            textDecoration: el.underline ? 'underline' : '',
        };

        if (!isEAN13) {
            return (
                <Text
                    y={elHeight * 0.85}
                    width={elWidth}
                    text={value}
                    align="center"
                    {...textStyle}
                />
            );
        }

        const s  = value.padEnd(13, '0');
        const p1 = s[0];
        const p2 = s.substring(1, 7);
        const p3 = s.substring(7, 13);
        const eanFontSize = el.fontSize || 6;
        const textY = elHeight * 0.82; 
        const uw = data1D?.unitWidth || 1;

        return (
            <>
                <Text
                    x={0}
                    y={textY}
                    width={data1D?.paddingLeft || 0}
                    text={p1}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
                <Text
                    x={data1D?.paddingLeft + uw * 3}
                    y={textY}
                    width={uw * 42}
                    text={p2}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
                <Text
                    x={data1D?.paddingLeft + uw * 50}
                    y={textY}
                    width={uw * 42}
                    text={p3}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
            </>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Group
            {...props}
            onClick={() => onSelect?.(el.id)}
            onTap={()   => onSelect?.(el.id)}
        >
            {/* Transparent hit area */}
            <Rect width={elWidth} height={elHeight} fill="transparent" />

            {is2D ? (
                img2D ? (
                    <KonvaImage
                        image={img2D}
                        x={0}
                        y={0}
                        width={elWidth}
                        height={elHeight}
                    />
                ) : (
                    // Loading placeholder — subtle dashed box
                    <>
                        <Rect
                            width={elWidth}
                            height={elHeight}
                            fill="#f8f8f8"
                            stroke="#cccccc"
                            strokeWidth={1}
                            dash={[4, 4]}
                        />
                        <Text
                            width={elWidth}
                            height={elHeight}
                            text="Generating..."
                            align="center"
                            verticalAlign="middle"
                            fontSize={11}
                            fill="#999999"
                            fontFamily="Arial"
                        />
                    </>
                )
            ) : (
                !data1D ? (
                    <Rect
                        width={elWidth}
                        height={elHeight}
                        fill="rgba(255,0,0,0.1)"
                        stroke="red"
                        strokeWidth={1}
                    />
                ) : (
                    <>
                        {data1D.barNodes.map(bar => <Rect {...bar} />)}
                        {renderText()}
                    </>
                )
            )}
        </Group>
    );
}