import React, { useMemo } from 'react';
import { Group, Rect } from 'react-konva';
import QRCode from 'qrcode';

export default function QRElement({ el, isSelected, onSelect, ...props }) {
    const matrix = useMemo(() => {
        try {
            const qr = QRCode.create(el.qrValue || 'https://saravanagraphics.com', { margin: 0 });
            return qr.modules;
        } catch (e) {
            console.error('QR error:', e);
            return null;
        }
    }, [el.qrValue]);

    if (!matrix) return null;

    const { data, size } = matrix;
    const elSize = el.width || 120;
    const cellSize = elSize / size;

    const cells = [];
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (data[row * size + col]) {
                cells.push(
                    <Rect
                        key={`qr-${row}-${col}`}
                        x={col * cellSize}
                        y={row * cellSize}
                        width={cellSize + 0.1} // Overlap to avoid anti-aliasing gaps
                        height={cellSize + 0.1}
                        fill={el.fill || '#000000'}
                    />
                );
            }
        }
    }

    return (
        <Group {...props} onClick={() => onSelect(el.id)} onTap={() => onSelect(el.id)}>
            <Rect width={elSize} height={elSize} fill="transparent" />
            {cells}
        </Group>
    );
}
