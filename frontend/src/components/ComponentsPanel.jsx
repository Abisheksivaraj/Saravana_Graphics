import React, { useState } from 'react';
import './ComponentsPanel.css';

export default function ComponentsPanel({ onToggle }) {
  const [expanded, setExpanded] = useState({ components: true, samples: false });

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bt-comp-panel">
      {/* Panel header */}
      <div className="bt-comp-header">
        <span className="bt-comp-title">Components</span>
        <button className="bt-comp-pin" title="Auto-hide">📌</button>
        <button className="bt-comp-close" onClick={onToggle} title="Close">✕</button>
      </div>

      {/* Tree */}
      <div className="bt-comp-body">
        {/* Components root */}
        <div
          className="bt-tree-item root"
          onClick={() => toggle('components')}
        >
          <span className={`bt-tree-arrow ${expanded.components ? 'expanded' : ''}`}>▶</span>
          <span className="bt-tree-icon folder">📁</span>
          <span>Components</span>
        </div>
        {expanded.components && (
          <div className="bt-tree-children">
            <div className="bt-tree-item leaf">
              <span className="bt-tree-spacer" />
              <span className="bt-tree-icon file">📄</span>
              <span>Label Design</span>
            </div>
            <div className="bt-tree-item leaf">
              <span className="bt-tree-spacer" />
              <span className="bt-tree-icon file">📄</span>
              <span>Price Tag</span>
            </div>
          </div>
        )}

        {/* Samples root */}
        <div
          className="bt-tree-item root"
          onClick={() => toggle('samples')}
        >
          <span className={`bt-tree-arrow ${expanded.samples ? 'expanded' : ''}`}>▶</span>
          <span className="bt-tree-icon folder">📁</span>
          <span>Samples</span>
        </div>
        {expanded.samples && (
          <div className="bt-tree-children">
            <div className="bt-tree-item leaf">
              <span className="bt-tree-spacer" />
              <span className="bt-tree-icon file">📄</span>
              <span>Barcode Label</span>
            </div>
            <div className="bt-tree-item leaf">
              <span className="bt-tree-spacer" />
              <span className="bt-tree-icon file">📄</span>
              <span>Product Tag</span>
            </div>
            <div className="bt-tree-item leaf">
              <span className="bt-tree-spacer" />
              <span className="bt-tree-icon file">📄</span>
              <span>Shipping Label</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
