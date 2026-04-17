import React, { useState, useEffect } from 'react';

/**
 * A numeric input that handles local state to avoid formatting-jump issues while typing.
 * Supports units and decimals.
 */
export default function NumericInput({ value, onChange, style = {}, className = 'bt-win-input', min, max, step = 0.001, precision = 3 }) {
  const [local, setLocal] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  // Sync with prop value only when not focused or value changed significantly
  useEffect(() => {
    if (!isFocused) {
      setLocal(value !== undefined && value !== null ? String(Number(value).toFixed(precision).replace(/\.?0+$/, '')) : '');
    }
  }, [value, isFocused, precision]);

  const handleChange = (e) => {
    const val = e.target.value;
    setLocal(val);
    
    // Only propagate if it's a valid number
    const n = parseFloat(val);
    if (!isNaN(n)) {
      if (onChange) onChange(n);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // On blur, force formatting to the canonical value
    setLocal(value !== undefined && value !== null ? String(Number(value).toFixed(precision).replace(/\.?0+$/, '')) : '');
  };

  return (
    <input
      type="number"
      className={className}
      style={style}
      value={local}
      step={step}
      min={min}
      max={max}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
