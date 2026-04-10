import React from 'react';
import { Image as KImage } from 'react-konva';
import useImage from './useImage';

export default function ImageElement({ el, ...props }) {
    const image = useImage(el.src);

    if (!image) return null;

    return (
        <KImage
            {...props}
            image={image}
            width={el.width || 150}
            height={el.height || 150}
        />
    );
}
