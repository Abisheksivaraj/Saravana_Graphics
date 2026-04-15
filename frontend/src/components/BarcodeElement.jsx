import React, { useMemo } from 'react';
import { Group, Rect, Text } from 'react-konva';
import JsBarcode from 'jsbarcode';

export default function BarcodeElement({ el, isSelected, onSelect, ...props }) {
    const elWidth = el.width || 200;
    const elHeight = el.height || 80;
    const value = el.barcodeValue || '123456789012';
    const format = (el.barcodeFormat || 'CODE128').toUpperCase();
    const isEAN13 = format === 'EAN13' && (value.length === 12 || value.length === 13);

    const data = useMemo(() => {
        try {
            const barcodeObj = {};
            JsBarcode(barcodeObj, value, {
                format: format,
                margin: 0,
                displayValue: false
            });
            
            const encodings = barcodeObj.encodings || [];
            if (encodings.length === 0) return null;

            let totalUnits = 0;
            encodings.forEach(e => totalUnits += e.data.length);
            
            // For EAN13, we leave room on left for the first digit
            const paddingLeft = isEAN13 ? elWidth * 0.08 : 0;
            const drawWidth = elWidth - paddingLeft;
            const unitWidth = drawWidth / totalUnits;
            
            let currentX = paddingLeft;
            const barNodes = [];

            encodings.forEach((encoding, encIdx) => {
                const binaryData = encoding.data;
                const isGuard = isEAN13 && (encIdx === 0 || encIdx === 2 || encIdx === 4);
                
                for (let i = 0; i < binaryData.length; i++) {
                    if (binaryData[i] === '1') {
                        let span = 1;
                        while(i + span < binaryData.length && binaryData[i + span] === '1') {
                            span++;
                        }
                        
                        barNodes.push({
                            x: currentX,
                            width: unitWidth * span,
                            height: isGuard ? elHeight : elHeight * 0.82,
                            fill: el.fill || '#000000',
                            key: `bar-${encIdx}-${i}`
                        });
                        
                        currentX += unitWidth * span;
                        i += span - 1;
                    } else {
                        currentX += unitWidth;
                    }
                }
            });

            return { barNodes, paddingLeft, drawWidth };
        } catch (e) {
            console.warn('Barcode encode error:', e);
            return null;
        }
    }, [value, format, elWidth, elHeight, el.fill, isEAN13]);

    const renderText = () => {
        const textStyle = {
            fontSize: el.fontSize || elHeight * 0.12,
            fontFamily: el.fontFamily || 'Arial',
            fontStyle: `${el.fontStyle === 'italic' ? 'italic' : 'normal'} ${el.fontWeight === 'bold' ? 'bold' : 'normal'}`,
            fill: el.fill || '#000000',
            textDecoration: el.underline ? 'underline' : ''
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

        const s = value.padEnd(13, '0');
        const p1 = s[0];
        const p2 = s.substring(1, 7);
        const p3 = s.substring(7, 13);
        const eanFontSize = el.fontSize || elHeight * 0.18;
        const textY = elHeight * 0.82;

        return (
            <>
                {/* First digit outside left */}
                <Text
                    x={0}
                    y={textY}
                    width={data?.paddingLeft || 0}
                    text={p1}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
                {/* Mid-left group */}
                <Text
                    x={data?.paddingLeft}
                    y={textY}
                    width={data?.drawWidth / 2}
                    text={p2}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
                {/* Mid-right group */}
                <Text
                    x={data?.paddingLeft + (data?.drawWidth / 2)}
                    y={textY}
                    width={data?.drawWidth / 2}
                    text={p3}
                    align="center"
                    {...textStyle}
                    fontSize={eanFontSize}
                />
            </>
        );
    };

    return (
        <Group {...props} onClick={() => onSelect?.(el.id)} onTap={() => onSelect?.(el.id)}>
            <Rect width={elWidth} height={elHeight} fill="transparent" />
            {!data ? (
                <Rect width={elWidth} height={elHeight} fill="rgba(255,0,0,0.1)" stroke="red" strokeWidth={1} />
            ) : (
                <>
                    {data.barNodes.map(bar => (
                        <Rect {...bar} />
                    ))}
                    {renderText()}
                </>
            )}
        </Group>
    );
}

