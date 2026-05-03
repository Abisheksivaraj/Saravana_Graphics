import React, { useState, useEffect } from 'react';
import { Download, Trash2, File as FileIcon, Search, Eye, X } from 'lucide-react';
import { filesAPI, BASE_URL } from '../api';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import toast from 'react-hot-toast';

export default function AdminFilesManager() {
    const { isSidebarCollapsed } = useUIStore();
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewFile, setPreviewFile] = useState(null);

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

    const filteredFiles = files.filter(f => 
        f.originalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.filename?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={`layout-page ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ background: '#f8fafc', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--text-primary)' }}>Saved Proof Sheets</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage all generated and saved proof sheets</p>
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
                                style={{
                                    width: '100%', padding: '10px 10px 10px 36px',
                                    border: '1px solid var(--border-light)', borderRadius: 8,
                                    fontSize: 14
                                }}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: 12, fontWeight: 600 }}>File Name</th>
                                        <th style={{ padding: 12, fontWeight: 600 }}>Date Saved</th>
                                        <th style={{ padding: 12, fontWeight: 600 }}>Uploaded By</th>
                                        <th style={{ padding: 12, fontWeight: 600, textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.map(file => (
                                        <tr key={file._id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 36, height: 36, background: '#e0f2fe', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                                        <FileIcon size={18} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{file.originalName || file.filename}</div>
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
                                                        title="View Inline"
                                                        style={{ color: '#10b981', background: '#d1fae5' }}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <a
                                                        href={`${BASE_URL}${file.url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        title="Download"
                                                        style={{ color: '#0284c7', background: '#e0f2fe' }}
                                                    >
                                                        <Download size={16} />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(file._id)}
                                                        className="btn btn-ghost btn-sm btn-icon"
                                                        title="Delete"
                                                        style={{ color: '#ef4444', background: '#fee2e2' }}
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
                    )}
                </div>
            </main>

            {previewFile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
                    display: 'flex', flexDirection: 'column', padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', flex: 1,
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '12px 20px', borderBottom: '1px solid #eee',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Proof Sheet Preview</h3>
                            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f0f0f0' }}>
                            <iframe 
                                src={`${BASE_URL}${previewFile}`} 
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="PDF Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
