import React, { useState, useRef, useEffect } from 'react';
import { hexToCmyk, cmykToHex } from '../store/uiStore';
import './CmykColorPicker.css';

const DEFAULT_PALETTE = [
  '#FFFFFF', '#E6E6E6', '#CCCCCC', '#B3B3B3', '#999999', '#808080', '#666666', '#4D4D4D', '#333333', '#1A1A1A', '#000000',
  '#00FFFF', '#00E6E6', '#00CCCC', '#00B3B3', '#009999', '#008080', '#006666', '#004D4D', '#003333', '#001A1A',
  '#FF00FF', '#E600E6', '#CC00CC', '#B300B3', '#990099', '#800080', '#660066', '#4D004D', '#330033', '#1A001A',
  '#FFFF00', '#E6E600', '#CCCC00', '#B3B300', '#999900', '#808000', '#666600', '#4D4D00', '#333300', '#1A1A00',
  '#FF0000', '#E60000', '#CC0000', '#B30000', '#990000', '#800000', '#660000', '#4D0000', '#330000', '#1A0000',
  '#00FF00', '#00E600', '#00CC00', '#00B300', '#009900', '#008000', '#006600', '#004D00', '#003300', '#001A00',
  '#0000FF', '#0000E6', '#0000CC', '#0000B3', '#000099', '#000080', '#000066', '#00004D', '#000033', '#00001A'
];

export default function CmykColorPicker({ color, onChange, onClose }) {
  const [cmyk, setCmyk] = useState(() => hexToCmyk(color === 'transparent' ? '#FFFFFF' : (color || '#000000')));
  const [hex, setHex] = useState(color === 'transparent' ? '#FFFFFF' : (color || '#000000'));
  const pickerRef = useRef(null);

  useEffect(() => {
    if (color && color !== 'transparent' && color !== hex) {
      setHex(color);
      setCmyk(hexToCmyk(color));
    }
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        if (onClose) onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleCmykChange = (key, value) => {
    let num = parseInt(value, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    
    const newCmyk = { ...cmyk, [key]: num };
    setCmyk(newCmyk);
    
    const newHex = cmykToHex(newCmyk.c, newCmyk.m, newCmyk.y, newCmyk.k);
    setHex(newHex);
    onChange(newHex);
  };

  const handleHexChange = (e) => {
    const newHex = e.target.value.toUpperCase();
    setHex(newHex);
    if (/^#[0-9A-F]{6}$/i.test(newHex)) {
      setCmyk(hexToCmyk(newHex));
      onChange(newHex);
    }
  };

  const handleSwatchClick = (swatchHex) => {
    setHex(swatchHex);
    setCmyk(hexToCmyk(swatchHex));
    onChange(swatchHex);
  };

  return (
    <div className="bt-cmyk-picker-popup" ref={pickerRef}>
      <div className="bt-cmyk-picker-header">CMYK Color Palette</div>
      <div className="bt-cmyk-picker-body">
        <div className="bt-cmyk-swatches">
          {DEFAULT_PALETTE.map((swatch, idx) => (
            <div 
              key={idx} 
              className={`bt-cmyk-swatch ${swatch === hex ? 'active' : ''}`}
              style={{ backgroundColor: swatch }}
              onClick={() => handleSwatchClick(swatch)}
              title={swatch}
            />
          ))}
        </div>
        
        <div className="bt-cmyk-controls">
          <div className="bt-cmyk-current-color">
            <div className="bt-cmyk-color-preview" style={{ backgroundColor: hex }}></div>
            <input type="text" className="bt-cmyk-hex-input" value={hex} onChange={handleHexChange} />
          </div>
          
          <div className="bt-cmyk-sliders">
            {['c', 'm', 'y', 'k'].map(k => (
              <div key={k} className="bt-cmyk-slider-row">
                <span className="bt-cmyk-label">{k.toUpperCase()}</span>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={cmyk[k]} 
                  onChange={e => handleCmykChange(k, e.target.value)}
                  className={`bt-cmyk-range range-${k}`}
                />
                <input 
                  type="number" 
                  min="0" max="100" 
                  value={cmyk[k]} 
                  onChange={e => handleCmykChange(k, e.target.value)}
                  className="bt-cmyk-num"
                />
                <span className="bt-cmyk-pct">%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
