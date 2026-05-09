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
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                            <Loader className="animate-spin" style={{ margin: '0 auto' }} />
                        </div>
                    ) : (
                        <>
                            {/* Breadcrumb Navigation */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 20 }}>
                                <Home size={12} className="cursor-pointer" onClick={() => setCurrentFolder(null)} />
                                <ChevronRight size={10} />
                                <span
                                    className={!currentFolder ? 'font-bold' : 'cursor-pointer'}
                                    style={{ color: !currentFolder ? '#7c3aed' : 'inherit' }}
                                    onClick={() => setCurrentFolder(null)}
                                >
                                    All Folders
                                </span>
                                {currentFolder && (
                                    <>
                                        <ChevronRight size={10} />
                                        <span style={{ color: '#7c3aed' }}>{currentFolder}</span>
                                    </>
                                )}
                            </div>

                            {/* Folders Grid (Only in Root or Search) */}
                            {!currentFolder && !isSearching && allFolders.length > 0 && (
                                <div style={{ marginBottom: 32 }}>
                                    <h3 style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Folders</h3>
                                    <div className="folder-grid">
                                        {allFolders.map(name => {
                                            const folderFiles = files.filter(f => f.folder === name);
                                            return (
                                                <div key={name} className="folder-card" onClick={() => setCurrentFolder(name)}>
                                                    <div className="folder-icon-wrapper">
                                                        <Folder size={40} className="folder-icon" />
                                                        <div className="folder-actions" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                className="btn btn-ghost btn-icon btn-xs"
                                                                style={{ padding: 4, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 6 }}
                                                                onClick={() => handleDeleteFolder(name)}
                                                            >
                                                                <Trash2 size={12} color="#ef4444" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="folder-info">
                                                        <div className="folder-name">{name}</div>
                                                        <div className="folder-count">{folderFiles.length} proof sheets</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Files List */}
                            <div style={{ marginTop: currentFolder ? 0 : 12 }}>
                                <h3 style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                                    {currentFolder ? 'Files' : isSearching ? 'Search Results' : 'Recent Files'}
                                </h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                                <th style={{ padding: 12, fontWeight: 600 }}>File name</th>
                                                <th style={{ padding: 12, fontWeight: 600 }}>Date saved</th>
                                                <th style={{ padding: 12, fontWeight: 600 }}>Uploaded by</th>
                                                <th style={{ padding: 12, fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayItems.filter(i => !i.isFolder).map(file => (
                                                <tr key={file._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                                    <td style={{ padding: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{ width: 36, height: 36, background: '#e0f2fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                                                <FileIcon size={18} />
                                                            </div>
                                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                {file.originalName || file.filename}
                                                                {file.folder && isSearching && (
                                                                    <span style={{ marginLeft: 8, fontSize: 10, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#64748b' }}>in {file.folder}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                                                        {new Date(file.createdAt).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: 12, color: 'var(--text-muted)' }}>
                                                        {file.uploadedBy?.name || 'Admin'}
                                                    </td>
                                                    <td style={{ padding: 12, textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => setPreviewFile(file.url)}
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="View inline"
                                                                style={{ color: '#10b981', background: '#d1fae5', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
                                                            >
                                                                <Eye size={16} />
                                                            </button>

                                                            <a
                                                                href={`${BASE_URL}${file.url}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="Download"
                                                                style={{ color: '#0284c7', background: '#e0f2fe', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                                            >
                                                                <Download size={16} />
                                                            </a>

                                                            <button
                                                                onClick={() => handleDelete(file._id)}
                                                                className="btn btn-ghost btn-sm btn-icon"
                                                                title="Delete"
                                                                style={{ color: '#ef4444', background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: 7, cursor: 'pointer' }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredFiles.length === 0 && (
                                                <tr>
                                                    <td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                                        No saved files found.
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