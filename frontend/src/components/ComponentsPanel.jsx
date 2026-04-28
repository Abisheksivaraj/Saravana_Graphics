import React, { useState } from 'react';
import { useDesignStore } from '../store/designStore';
import './ComponentsPanel.css';

export default function ComponentsPanel({ onToggle }) {
  const { elements, selectedIds, selectElement, deleteElement, updateElementAndSave } = useDesignStore();
  const [expanded, setExpanded] = useState({ layers: true, components: false, samples: false });
  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState('');

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const startRename = (el) => {
    setEditingId(el.id);
    setTempName(el.name || el.type);
  };

  const finishRename = () => {
    if (editingId) {
      updateElementAndSave(editingId, { name: tempName });
    }
    setEditingId(null);
  };

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
        {/* Design Layers root */}
        <div
          className="bt-tree-item root"
          onClick={() => toggle('layers')}
        >
          <span className={`bt-tree-arrow ${expanded.layers ? 'expanded' : ''}`}>▶</span>
          <span className="bt-tree-icon folder">📂</span>
          <span>Layers</span>
        </div>
        {expanded.layers && (
          <div className="bt-tree-children">
            {elements.length === 0 ? (
              <div className="bt-tree-empty">No objects</div>
            ) : (
              [...elements].reverse().map(el => (
                <div 
                  key={el.id} 
                  className={`bt-tree-item leaf ${selectedIds.includes(el.id) ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectElement(el.id, e.ctrlKey);
                  }}
                >
                  <span className="bt-tree-spacer" />
                  <span className="bt-tree-icon">
                    {el.type === 'text' ? '🔤' : el.type === 'barcode' ? '║║' : '⬜'}
                  </span>
                  {editingId === el.id ? (
                    <input
                      className="bt-tree-input"
                      autoFocus
                      value={tempName}
                      onChange={e => setTempName(e.target.value)}
                      onBlur={finishRename}
                      onKeyDown={e => e.key === 'Enter' && finishRename()}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span 
                      className="bt-tree-text"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(el);
                      }}
                    >
                      {el.name || el.type}
                    </span>
                  )}
                  <button 
                    className="bt-tree-delete" 
                    title="Delete Layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteElement([el.id]);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        )}
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
