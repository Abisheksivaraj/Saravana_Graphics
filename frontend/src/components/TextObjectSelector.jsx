import React from 'react';
import './VirtualShapeSelector.css'; // Reuse container styles

const GROUPS = [
    {
        title: 'Basic Text Objects',
        items: [
            { id: 'text-normal', label: 'Normal', desc: 'Single line text', hasIcons: true },
            { id: 'text-wrapped', label: 'Normal Wrapped', desc: 'Multi-line wrapped text', hasIcons: true },
            { id: 'text-processor', label: 'Word Processor', desc: 'Rich text formatting', hasIcons: true },
            { id: 'text-symbol', label: 'Symbol Font Character', desc: 'Special glyphs', hasIcons: true },
        ]
    },
    {
        title: 'Transformed Text Objects',
        isGrid: true,
        items: [
            { id: 'text-arc1', icon: <ArcedText type="arc-top" />, desc: 'Arc Top' },
            { id: 'text-arc2', icon: <ArcedText type="arc-top-wide" />, desc: 'Arc Top Wide' },
            { id: 'text-arc3', icon: <ArcedText type="arc-bottom" />, desc: 'Arc Bottom' },
            { id: 'text-arc4', icon: <ArcedText type="arc-bottom-wide" />, desc: 'Arc Bottom Wide' },
            { id: 'text-circle1', icon: <ArcedText type="circle" />, desc: 'Full Circle' },
            { id: 'text-circle2', icon: <ArcedText type="circle-out" />, desc: 'Full Circle Out' },
            { id: 'text-warp1', icon: <ArcedText type="warp-up" />, desc: 'Warp Up' },
            { id: 'text-warp2', icon: <ArcedText type="warp-down" />, desc: 'Warp Down' },
        ]
    },
    {
        title: 'Markup Language Containers',
        items: [
            { id: 'text-rtf', label: 'RTF', desc: 'Rich Text Format', hasIcons: true },
            { id: 'text-html', label: 'HTML', desc: 'HTML / CSS', hasIcons: true },
            { id: 'text-xaml', label: 'XAML', desc: 'XAML Markup', hasIcons: true },
        ]
    }
];

function ArcedText({ type }) {
    let path = "M 5,20 Q 25,5 45,20";
    if (type === 'arc-bottom') path = "M 5,10 Q 25,25 45,10";
    if (type === 'circle') path = "M 25,25 m -15,0 a 15,15 0 1,0 30,0 a 15,15 0 1,0 -30,0";

    return (
        <svg width="50" height="30" viewBox="0 0 50 30">
            <path id={`p-${type}`} d={path} fill="none" />
            <text fontSize="8" fill="#333" fontWeight="bold" fontFamily="serif">
                <textPath xlinkHref={`#p-${type}`}>AaBbCc</textPath>
            </text>
        </svg>
    );
}

const TTIcons = () => (
    <div className="bt-tt-icons">
        <span className="bt-icon-pc">💻</span>
        <span className="bt-icon-tt">TT</span>
    </div>
);

export default function TextObjectSelector({ onSelect, onClose }) {
    return (
        <div className="bt-shape-selector text-selector-exact" onClick={(e) => e.stopPropagation()}>
            <div className="bt-selector-body no-pad">
                {GROUPS.map((group, idx) => (
                    <div key={idx} className="bt-selector-group no-mg">
                        <div className="bt-exact-group-title">{group.title}</div>
                        <div className={`bt-exact-grid ${group.isGrid ? 'transformed-grid-exact' : 'list-grid-exact'}`}>
                            {group.items.map((item) => (
                                <div 
                                    key={item.id} 
                                    className={`bt-exact-item ${group.isGrid ? 'grid-item' : 'list-item'}`}
                                    onClick={() => {
                                        onSelect('text'); 
                                        onClose();
                                    }}
                                    title={item.desc}
                                >
                                    {group.isGrid ? (
                                        <div className="bt-transformed-preview">{item.icon}</div>
                                    ) : (
                                        <>
                                            <span className="bt-item-label">{item.label}</span>
                                            {item.hasIcons && <TTIcons />}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
