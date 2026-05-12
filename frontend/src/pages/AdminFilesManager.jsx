import React, { useState, useEffect } from 'react';
import { Download, Trash2, File as FileIcon, Search, Eye, X, Loader, Folder, Home, ChevronRight } from 'lucide-react';
import { filesAPI, BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';
import './AdminFilesManager.css';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminFilesManager() {
    const { isSidebarCollapsed } = useUIStore();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewFile, setPreviewFile] = useState(null);
    const [currentFolder, setCurrentFolder] = useState(null); // null = root

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const res = await filesAPI.getAll();
            setFiles(res.data);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this file?')) return;
        try {
            await filesAPI.delete(id);
            setFiles(files.filter(f => f._id !== id));
            toast.success('File deleted');
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete file');
        }
    };

    const handleDeleteFolder = async (folderName) => {
        if (!window.confirm(`Are you sure you want to delete the folder "${folderName}" and ALL files inside it?`)) return;
        try {
            const folderFiles = files.filter(f => f.folder === folderName);
            toast.loading('Deleting folder content...', { id: 'del_folder' });
            for (const f of folderFiles) {
                await filesAPI.delete(f._id);
            }
            setFiles(files.filter(f => f.folder !== folderName));
            toast.success('Folder deleted', { id: 'del_folder' });
            if (currentFolder === folderName) setCurrentFolder(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to delete folder', { id: 'del_folder' });
        }
    };

    const filteredFiles = files.filter(f =>
        f.originalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.filename?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Grouping logic
    const allFolders = Array.from(new Set(files.map(f => f.folder).filter(Boolean)));

    // In search mode, show flat list. Otherwise show folder view.
    const isSearching = searchTerm.trim().length > 0;

    let displayItems = [];
    if (isSearching) {
        displayItems = filteredFiles.map(f => ({ ...f, isFolder: false }));
    } else if (currentFolder === null) {
        displayItems = files.filter(f => !f.folder).map(f => ({ ...f, isFolder: false }));
    } else {
        displayItems = files.filter(f => f.folder === currentFolder).map(f => ({ ...f, isFolder: false }));
    }

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc', padding: 24 }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {currentFolder ? currentFolder : 'My Folders'}
                        </h1>
                    </div>
                </div>

                <div style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                        <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search files..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 14 }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                            <Loader className="animate-spin" style={{ margin: '0 auto', width: 32, height: 32 }} />
                            <p style={{ marginTop: 12, fontSize: 14, fontWeight: 500 }}>Fetching your files...</p>
                        </div>
                    ) : (
                        <>
                            {/* Breadcrumb Navigation */}
                            <div style={{ 
                                display: 'flex', alignItems: 'center', gap: 10, 
                                background: '#f8fafc', padding: '10px 16px', borderRadius: '10px',
                                border: '1px solid #f1f5f9', marginBottom: 24,
                                color: '#64748b', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
                            }}>
                                <Home size={14} className="cursor-pointer" onClick={() => setCurrentFolder(null)} />
                                <ChevronRight size={12} color="#cbd5e1" />
                                <span
                                    className={!currentFolder ? 'active-breadcrumb' : 'cursor-pointer'}
                                    style={{ color: !currentFolder ? '#7c3aed' : 'inherit' }}
                                    onClick={() => setCurrentFolder(null)}
                                >
                                    Root Storage
                                </span>
                                {currentFolder && (
                                    <>
                                        <ChevronRight size={12} color="#cbd5e1" />
                                        <span style={{ color: '#7c3aed', background: '#f5f3ff', padding: '2px 8px', borderRadius: '6px' }}>{currentFolder}</span>
                                    </>
                                )}
                            </div>

                            {/* Folders Grid */}
                            {!currentFolder && !isSearching && allFolders.length > 0 && (
                                <div style={{ marginBottom: 40 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                        <div style={{ width: 4, height: 16, background: '#7c3aed', borderRadius: 2 }}></div>
                                        <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Directories</h3>
                                    </div>
                                    <div className="folder-grid">
                                        {allFolders.map(name => {
                                            const folderFiles = files.filter(f => f.folder === name);
                                            return (
                                                <div key={name} className="folder-card" onClick={() => setCurrentFolder(name)}
                                                    style={{ border: '1px solid #f1f5f9', background: '#fff' }}>
                                                    <div className="folder-icon-wrapper">
                                                        <Folder size={48} className="folder-icon" strokeWidth={1.5} />
                                                        <div className="folder-actions" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                className="btn-icon-danger"
                                                                style={{ 
                                                                    width: 24, height: 24, border: 'none', 
                                                                    background: '#fee2e2', color: '#ef4444', 
                                                                    borderRadius: '6px', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}
                                                                onClick={() => handleDeleteFolder(name)}
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="folder-info">
                                                        <div className="folder-name" style={{ fontWeight: 800 }}>{name}</div>
                                                        <div className="folder-count" style={{ fontWeight: 600 }}>{folderFiles.length} item{folderFiles.length !== 1 ? 's' : ''}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Files Table Section */}
                            <div style={{ marginTop: currentFolder ? 0 : 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                                    <div style={{ width: 4, height: 16, background: isSearching ? '#3b82f6' : '#7c3aed', borderRadius: 2 }}></div>
                                    <h3 style={{ fontSize: '0.75rem', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
                                        {currentFolder ? 'Directory Files' : isSearching ? `Search Results (${filteredFiles.length})` : 'Recent Documents'}
                                    </h3>
                                </div>

                                <div style={{ border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                                <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>File Asset</th>
                                                <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Saved On</th>
                                                <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Operator</th>
                                                <th style={{ padding: '16px 20px', color: '#64748b', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Management</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayItems.length > 0 ? displayItems.map((file, idx) => (
                                                <tr key={file._id} style={{ 
                                                    borderBottom: idx === displayItems.length - 1 ? 'none' : '1px solid #f8fafc',
                                                    background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                            <div style={{ 
                                                                width: 42, height: 42, background: '#f1f5f9', 
                                                                borderRadius: '12px', display: 'flex', alignItems: 'center', 
                                                                justifyContent: 'center', color: '#7c3aed',
                                                                border: '1px solid #e2e8f0'
                                                            }}>
                                                                <FileIcon size={20} strokeWidth={2} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 2 }}>
                                                                    {file.originalName || file.filename}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>PDF Document</span>
                                                                    {file.folder && isSearching && (
                                                                        <span style={{ fontSize: '0.6rem', background: '#f5f3ff', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>FOLDER: {file.folder}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                                                            {new Date(file.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                            {new Date(file.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                                                                {(file.uploadedBy?.name || 'A')[0].toUpperCase()}
                                                            </div>
                                                            <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{file.uploadedBy?.name || 'System Admin'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => setPreviewFile(file.url)}
                                                                style={{ 
                                                                    width: 34, height: 34, borderRadius: '10px', border: '1px solid #d1fae5', 
                                                                    background: '#ecfdf5', color: '#10b981', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}
                                                                title="Quick Preview"
                                                            >
                                                                <Eye size={15} />
                                                            </button>

                                                            <a
                                                                href={`${BASE_URL}${file.url}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ 
                                                                    width: 34, height: 34, borderRadius: '10px', border: '1px solid #e0f2fe', 
                                                                    background: '#f0f9ff', color: '#0284c7', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    textDecoration: 'none'
                                                                }}
                                                                title="Download Asset"
                                                            >
                                                                <Download size={15} />
                                                            </a>

                                                            <button
                                                                onClick={() => handleDelete(file._id)}
                                                                style={{ 
                                                                    width: 34, height: 34, borderRadius: '10px', border: '1px solid #fee2e2', 
                                                                    background: '#fef2f2', color: '#ef4444', cursor: 'pointer',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}
                                                                title="Delete Permanently"
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: '80px 0' }}>
                                                        <div style={{ color: '#cbd5e1', marginBottom: 12 }}><FileIcon size={48} style={{ opacity: 0.5 }} /></div>
                                                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 600 }}>No documents found in this directory</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* ── PDF Preview Modal ── */}
            {previewFile && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 20 }}>
                    <div style={{ background: 'white', borderRadius: 12, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Proof sheet preview</h3>
                            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
                            <iframe src={`${BASE_URL}${previewFile}`} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}