import React, { useState, useRef, useEffect } from 'react';
import './MenuBar.css';

const MENUS = [
  {
    id: 'file', label: 'File',
    items: [
      { id: 'new', label: 'New', shortcut: 'Ctrl+N' },
      { id: 'open', label: 'Open...' },
      null,
      { id: 'save', label: 'Save', shortcut: 'Ctrl+S' },
      { id: 'saveas', label: 'Save As...' },
      null,
      { id: 'print', label: 'Print...', shortcut: 'Ctrl+P' },
      { id: 'print-preview', label: 'Print Preview' },
      null,
      { id: 'export-png', label: 'Export as PNG' },
      { id: 'export-pdf', label: 'Export as PDF' },
      null,
      { id: 'exit', label: 'Exit' },
    ]
  },
  {
    id: 'edit', label: 'Edit',
    items: [
      { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
      { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y' },
      null,
      { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
      { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
      { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
      { id: 'delete', label: 'Delete', shortcut: 'Del' },
      null,
      { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A' },
    ]
  },
  {
    id: 'view', label: 'View',
    items: [
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'Ctrl++' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'Ctrl+-' },
      { id: 'fit', label: 'Fit to Window' },
      null,
      { id: 'zoom-50', label: '50%' },
      { id: 'zoom-75', label: '75%' },
      { id: 'zoom-100', label: '100%' },
      { id: 'zoom-150', label: '150%' },
      { id: 'zoom-200', label: '200%' },
      null,
      { id: 'grid', label: 'Grid Lines', check: true },
      { id: 'rulers', label: 'Rulers', check: true, checked: true },
      null,
      { id: 'components-panel', label: 'Components Panel', check: true, checked: true },
    ]
  },
  {
    id: 'create', label: 'Create',
    items: [
      {
        id: 'text-objects', label: 'Text Objects', arrow: true,
        sub: [
          { id: 'text', label: 'Single Line' },
          { id: 'text-m', label: 'Multi-line' },
          { id: 'text-wp', label: 'Word Processor' },
          { id: 'text-arc', label: 'Arc' },
          { id: 'text-sym', label: 'Symbol Font Characters' },
          null,
          { id: 'text-rtf', label: 'RTF' },
          { id: 'text-html', label: 'HTML' },
          { id: 'text-xaml', label: 'XAML' },
        ]
      },
      null,
      { id: 'barcode', label: 'Barcode' },
      { id: 'draw-line', label: 'Line' },
      { id: 'draw-rect', label: 'Box' },
      { id: 'draw-circle', label: 'Circle/Ellipse' },
      { id: 'image', label: 'Picture...' },
      null,
      { id: 'qrcode', label: 'QR Code' },
    ]
  },
  {
    id: 'arrange', label: 'Arrange',
    items: [
      { id: 'bring-front', label: 'Bring to Front' },
      { id: 'bring-forward', label: 'Bring Forward' },
      { id: 'send-backward', label: 'Send Backward' },
      { id: 'send-back', label: 'Send to Back' },
      null,
      { id: 'align-left', label: 'Align Left' },
      { id: 'align-center', label: 'Align Center' },
      { id: 'align-right', label: 'Align Right' },
      { id: 'align-top', label: 'Align Top' },
      { id: 'align-middle', label: 'Align Middle' },
      { id: 'align-bottom', label: 'Align Bottom' },
      null,
      { id: 'group', label: 'Group', shortcut: 'Ctrl+G' },
      { id: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G' },
    ]
  },
  {
    id: 'administer', label: 'Administer',
    items: [
      { id: 'db', label: 'Database Connections...' },
      { id: 'print-station', label: 'Print Station...' },
      null,
      { id: 'users', label: 'Users and Groups...' },
      { id: 'printers', label: 'Printer Management...' },
    ]
  },
  {
    id: 'tools', label: 'Tools',
    items: [
      { id: 'import-data', label: 'Import Data...' },
      null,
      { id: 'options', label: 'Options...' },
    ]
  },
  {
    id: 'window', label: 'Window',
    items: [
      { id: 'cascade', label: 'Cascade' },
      { id: 'tile-h', label: 'Tile Horizontally' },
      { id: 'tile-v', label: 'Tile Vertically' },
      null,
      { id: 'doc1', label: 'Document1.btw', check: true, checked: true },
    ]
  },
  {
    id: 'help', label: 'Help',
    items: [
      { id: 'help', label: 'Help Topics', shortcut: 'F1' },
      { id: 'start', label: 'Getting Started' },
      null,
      { id: 'about', label: 'About...' },
    ]
  },
];

export default function MenuBar({ onAction, gridOn, componentsVisible }) {
  const [open, setOpen] = useState(null);
  const [subOpen, setSubOpen] = useState(null);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(null);
        setSubOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doAction = (id) => {
    onAction?.(id);
    setOpen(null);
    setSubOpen(null);
  };

  // Update check states
  const getChecked = (item) => {
    if (item.id === 'grid') return gridOn;
    if (item.id === 'components-panel') return componentsVisible;
    return item.checked;
  };

  return (
    <nav className="bt-menubar" ref={ref}>
      {MENUS.map(menu => (
        <div key={menu.id} className="bt-menu-root">
          <button
            className={`bt-menu-root-btn${open === menu.id ? ' open' : ''}`}
            onClick={() => setOpen(open === menu.id ? null : menu.id)}
            onMouseEnter={() => open !== null && setOpen(menu.id)}
          >
            {menu.label}
          </button>
          {open === menu.id && (
            <div className="bt-dropdown" onMouseLeave={() => setSubOpen(null)}>
              {menu.items.map((item, i) =>
                item === null ? (
                  <div key={i} className="bt-dd-sep" />
                ) : (
                  <div
                    key={item.id}
                    className={`bt-dd-item${subOpen === item.id ? ' sub-open' : ''}`}
                    onClick={() => !item.arrow && doAction(item.id)}
                    onMouseEnter={() => setSubOpen(item.arrow ? item.id : null)}
                  >
                    <span className="bt-check-mark">
                      {item.check && getChecked(item) ? '✓' : ''}
                    </span>
                    <span className="bt-dd-label">{item.label}</span>
                    {item.shortcut && <span className="bt-dd-shortcut">{item.shortcut}</span>}
                    {item.arrow && <span className="bt-dd-arrow">▶</span>}
                    {item.arrow && subOpen === item.id && item.sub && (
                      <div className="bt-submenu">
                        {item.sub.map((s, si) =>
                          s === null ? (
                            <div key={si} className="bt-dd-sep" />
                          ) : (
                            <div
                              key={s.id}
                              className="bt-dd-item"
                              onClick={(e) => { e.stopPropagation(); doAction(s.id); }}
                              onMouseEnter={() => {}}
                            >
                              <span className="bt-check-mark" />
                              <span className="bt-dd-label">{s.label}</span>
                              {s.shortcut && <span className="bt-dd-shortcut">{s.shortcut}</span>}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
