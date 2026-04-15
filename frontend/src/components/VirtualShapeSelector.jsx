import React from 'react';
import './VirtualShapeSelector.css';

const SHAPE_GROUPS = [
    {
        title: 'Rectangles',
        items: [
            { id: 'draw-rect', label: 'Rectangle', icon: <rect x="4" y="6" width="16" height="12" rx="0" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-rect-rounded', label: 'Rounded Rect', icon: <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" fill="none" strokeWidth="2" /> }
        ]
    },
    {
        title: 'Basic Shapes',
        items: [
            { id: 'draw-circle', label: 'Circle', icon: <circle cx="12" cy="12" r="8" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-triangle', label: 'Triangle', icon: <path d="M12 4L20 18H4L12 4Z" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-diamond', label: 'Diamond', icon: <path d="M12 4L20 12L12 20L4 12L12 4Z" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-hexagon', label: 'Hexagon', icon: <path d="M12 2L19 6V14L12 18L5 14V6L12 2Z" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-octagon', label: 'Octagon', icon: <path d="M8 2H16L22 8V16L16 22H8L2 16V8L8 2Z" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-star', label: 'Star', icon: <path d="M12 2L15 9H22L16 14L18 21L12 17L6 21L8 14L2 9H9L12 2Z" stroke="currentColor" fill="none" strokeWidth="2" /> }
        ]
    },
    {
        title: 'Arrows',
        items: [
            { id: 'draw-arrow-right', label: 'Arrow Right', icon: <path d="M4 12H18M18 12L13 7M18 12L13 17" stroke="currentColor" fill="none" strokeWidth="2" /> },
            { id: 'draw-arrow-bidir', label: 'Bi-directional', icon: <path d="M4 12H20M20 12L15 7M20 12L15 17M4 12L9 7M4 12L9 17" stroke="currentColor" fill="none" strokeWidth="2" /> }
        ]
    }
];

export default function VirtualShapeSelector({ onSelect, onClose }) {
    return (
        <div className="bt-shape-selector-overlay" onClick={onClose}>
            <div className="bt-shape-selector" onClick={e => e.stopPropagation()}>
                {SHAPE_GROUPS.map(group => (
                    <div key={group.title} className="bt-shape-group">
                        <div className="bt-shape-group-title">{group.title}</div>
                        <div className="bt-shape-items">
                            {group.items.map(item => (
                                <button 
                                    key={item.id} 
                                    className="bt-shape-item" 
                                    title={item.label}
                                    onClick={() => {
                                        onSelect(item.id);
                                        onClose();
                                    }}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24">
                                        {item.icon}
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
