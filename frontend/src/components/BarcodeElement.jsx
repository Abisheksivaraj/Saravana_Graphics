import React, { useMemo } from 'react';
import { Group, Rect, Image as KImage } from 'react-konva';
import JsBarcode from 'jsbarcode';
import useImage from './useImage';

export default function BarcodeElement({ el, isSelected, onSelect, ...props }) {
    const dataUrl = useMemo(() => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, el.barcodeValue || '123456789012', {
                format: el.barcodeFormat || 'EAN13',
                displayValue: true,
                fontSize: 14,
                margin: 5,
                background: '#ffffff',
                lineColor: el.fill || '#000000',
                width: 2,
                height: 100
            });
            return canvas.toDataURL();
        } catch (e) {
            console.warn('Barcode generation error:', e);
            return null;
        }
    }, [el.barcodeValue, el.barcodeFormat, el.fill]);

    const image = useImage(dataUrl);

    const elWidth = el.width || 200;
    const elHeight = el.height || 80;

    if (!image) {
        return (
            <Group {...props} onClick={() => onSelect(el.id)} onTap={() => onSelect(el.id)}>
                <Rect 
                    width={elWidth} 
                    height={elHeight} 
                    fill="rgba(255,0,0,0.1)" 
                    stroke="red" 
                    strokeWidth={1} 
                />
            </Group>
        );
    }

    return (
        <Group {...props} onClick={() => onSelect(el.id)} onTap={() => onSelect(el.id)}>
            <Rect width={elWidth} height={elHeight} fill="transparent" />
            <KImage
                image={image}
                width={elWidth}
                height={elHeight}
            />
        </Group>
    );
}

