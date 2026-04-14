import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { useDesignStore, SIZE_PRESETS } from '../store/designStore';
import Sidebar from '../components/Sidebar';
import { designsAPI, companiesAPI } from '../api';
import { useCompanyStore } from '../store/companyStore';
import {
    Plus, Search, Layers, LogOut, Grid, List, Trash2, Copy,
    Edit2, ChevronRight, Tag, FileText, Clock, LayoutTemplate, Cpu,
    Filter, MoreVertical, Folder, FolderPlus, ChevronLeft, Home,
    CircleAlert
} from 'lucide-react';
import toast from 'react-hot-toast';
import './Dashboard.css';

const CATEGORY_ICONS = {
    'price-tag': '🏷️', 'clothing-tag': '👕', 'business-card': '💼',
    'label-small': '📋', 'label-large': '📄', 'shipping-label': '📦',
    'barcode-label': '⬛', 'id-card': '🪪', 'a4': '📝', 'custom': '✏️',
};

export default function Dashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { newDesign } = useDesignStore();
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('grid');
    const [showNewModal, setShowNewModal] = useState(false);
    const [customWidth, setCustomWidth] = useState(50);
    const [customHeight, setCustomHeight] = useState(75);
    const [unit, setUnit] = useState('mm');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [showFolderModal, setShowFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [folderDeleteConfirm, setFolderDeleteConfirm] = useState(null);

    const { 
        companies, fetchCompanies, createCompany, deleteCompany,
        currentFolder, setCurrentFolder 
    } = useCompanyStore();

    const fetchDesigns = async () => {
        try {
            const res = await designsAPI.getAll({ search });
            setDesigns(res.data.designs);
        } catch { toast.error('Failed to load designs'); }
        finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchDesigns(); 
        fetchCompanies();
    }, [search]);

    const handleNew = async () => {
        if (!currentFolder && !selectedCompany) {
            toast.error('Please select or create a company folder first');
            return;
        }

        const targetCompany = currentFolder?.name || selectedCompany;
        setLoading(true);
        try {
            const res = await designsAPI.getNextTitle(targetCompany);
            const nextTitle = res.data.nextTitle;
            
            // Convert to pixels (96 DPI)
            let pxW = customWidth;
            let pxH = customHeight;
            
            if (unit === 'mm') {
                pxW = customWidth * (96 / 25.4);
                pxH = customHeight * (96 / 25.4);
            } else if (unit === 'cm') {
                pxW = customWidth * 10 * (96 / 25.4);
                pxH = customHeight * 10 * (96 / 25.4);
            } else if (unit === 'inch') {
                pxW = customWidth * 96;
                pxH = customHeight * 96;
            }

            newDesign('custom', pxW, pxH);
            useDesignStore.getState().setTitle(nextTitle);
            useDesignStore.getState().setCompany(targetCompany);
            
            navigate('/editor');
        } catch (err) {
            console.error(err);
            toast.error('Failed to initialize design');
        } finally {
            setLoading(false);
            setShowNewModal(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        const company = await createCompany(newFolderName);
        if (company) {
            setNewFolderName('');
            setShowFolderModal(false);
        }
    };

    const handleEdit = (id) => navigate(`/editor/${id}`);

    const handleDuplicate = async (id, e) => {
        e.stopPropagation();
        try {
            await designsAPI.duplicate(id);
            toast.success('Design duplicated');
            fetchDesigns();
        } catch { toast.error('Failed to duplicate'); }
    };

    const handleDelete = async (id) => {
        try {
            await designsAPI.delete(id);
            toast.success('Design deleted');
            setDesigns(prev => prev.filter(d => d._id !== id));
            setDeleteConfirm(null);
        } catch { toast.error('Failed to delete'); }
    };

    const formatDate = (d) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));

    const { isSidebarCollapsed } = useUIStore();

    const renderDesignCard = (d) => (
        <div key={d._id} className={`design-card ${view === 'list' ? 'design-card-list' : ''}`} onClick={() => handleEdit(d._id)}>
            <div className="design-thumb">
                {d.thumbnail ? (
                    <img src={d.thumbnail} alt={d.title} />
                ) : (
                    <div className="design-thumb-placeholder" style={{ background: d.backgroundColor || '#ffffff' }}>
                        <span>{CATEGORY_ICONS[d.sizePreset] || '🏷️'}</span>
                        <small>{d.canvasWidth}×{d.canvasHeight}px</small>
                    </div>
                )}
                <div className="design-card-overlay">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(d._id)}><Edit2 size={14} /> Edit</button>
                </div>
            </div>
            <div className="design-info">
                <div className="flex items-start justify-between">
                    <div className="design-title">{d.title}</div>
                    {d.company && <span className="design-company-badge">{d.company}</span>}
                </div>
                <div className="design-meta">
                    <span><Tag size={11} /> {SIZE_PRESETS[d.sizePreset]?.label || d.sizePreset}</span>
                    <span><Clock size={11} /> {formatDate(d.updatedAt)}</span>
                </div>
                <div className="design-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-icon" title="Duplicate" onClick={(e) => handleDuplicate(d._id, e)}><Copy size={14} /></button>
                    <button className="btn btn-ghost btn-icon" title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(d._id); }}>
                        <Trash2 size={14} color="var(--danger)" />
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => handleEdit(d._id)}>
                        Open <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />

            {/* Main */}
            <main className="db-main">
                {/* Header */}
                <div className="db-header">
                    <div className="flex items-center gap-4">
                        {currentFolder && (
                            <button className="btn btn-ghost btn-icon" onClick={() => setCurrentFolder(null)}>
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-2 text-muted text-xs mb-1">
                                <Home size={12} className="cursor-pointer" onClick={() => setCurrentFolder(null)} />
                                <ChevronRight size={10} />
                                <span className={!currentFolder ? 'font-bold text-primary' : 'cursor-pointer'} onClick={() => setCurrentFolder(null)}>All Folders</span>
                                {currentFolder && (
                                    <>
                                        <ChevronRight size={10} />
                                        <span className="font-bold text-primary">{currentFolder.name}</span>
                                    </>
                                )}
                            </div>
                            <h1>{currentFolder ? currentFolder.name : 'My Folders'}</h1>
                        </div>
                    </div>
                    <div className="db-header-actions">
                        <div className="db-search">
                            <Search size={16} color="var(--text-muted)" />
                            <input placeholder="Search..." value={search}
                                onChange={e => setSearch(e.target.value)} className="input" style={{ border: 'none', background: 'transparent', paddingLeft: 0 }} />
                        </div>
                        {!currentFolder && (
                            <button className="btn btn-secondary" onClick={() => setShowFolderModal(true)}>
                                <FolderPlus size={16} /> New Folder
                            </button>
                        )}
                        {currentFolder && (
                            <button className="btn btn-primary" onClick={() => {
                                setSelectedCompany(currentFolder.name);
                                setShowNewModal(true);
                            }}>
                                <Plus size={16} /> New Design
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="db-content">
                    {loading ? (
                        <div className="db-loading">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }}></div>)}
                        </div>
                    ) : (
                        <>
                            {/* Folders View (Only shown when not inside a folder) */}
                            {!currentFolder && companies.length > 0 && (
                                <div className="section-block">
                                    <h3 className="section-title">Companies</h3>
                                    <div className="folder-grid">
                                        {companies.map(c => (
                                            <div key={c._id} className="folder-card" onClick={() => setCurrentFolder(c)}>
                                                <div className="folder-icon-wrapper">
                                                    <Folder size={40} className="folder-icon" />
                                                    <div className="folder-actions" onClick={e => e.stopPropagation()}>
                                                        <button className="btn btn-ghost btn-icon btn-xs" onClick={() => setFolderDeleteConfirm(c)}>
                                                            <Trash2 size={12} color="var(--danger)" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="folder-info">
                                                    <div className="folder-name">{c.name}</div>
                                                    <div className="folder-count">
                                                        {designs.filter(d => d.company === c.name).length} designs
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Designs View (Only shown when inside a folder) */}
                            {currentFolder && (
                                <div className="section-block mt-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="section-title">Designs</h3>
                                        <div className="db-view-toggle">
                                            <button className={`btn btn-ghost btn-icon ${view === 'grid' ? 'active-view' : ''}`} onClick={() => setView('grid')}><Grid size={16} /></button>
                                            <button className={`btn btn-ghost btn-icon ${view === 'list' ? 'active-view' : ''}`} onClick={() => setView('list')}><List size={16} /></button>
                                        </div>
                                    </div>
                                    
                                    {designs.filter(d => d.company === currentFolder.name).length === 0 ? (
                                        <div className="db-empty-mini">
                                            <FileText size={32} color="var(--text-muted)" />
                                            <p>No designs found in this folder</p>
                                            <button className="btn btn-primary btn-sm mt-2" onClick={() => {
                                                setSelectedCompany(currentFolder.name);
                                                setShowNewModal(true);
                                            }}>
                                                <Plus size={14} /> Create One
                                            </button>
                                        </div>
                                    ) : (
                                        <div className={view === 'grid' ? 'design-grid' : 'design-list'}>
                                            {designs
                                                .filter(d => d.company === currentFolder.name)
                                                .map(d => renderDesignCard(d))
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* New Design Modal */}
            {showNewModal && (
                <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">New Design</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowNewModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group mb-6">
                                <label className="form-label mb-2 block font-semibold text-sm">Select Company Folder</label>
                                <div className="company-input-wrapper">
                                    <Folder className="input-icon-left" size={16} />
                                    <select 
                                        className="select-input w-full pl-10" 
                                        value={currentFolder?.name || selectedCompany}
                                        onChange={(e) => setSelectedCompany(e.target.value)}
                                        disabled={!!currentFolder}
                                    >
                                        <option value="">-- Select a Folder --</option>
                                        {companies.map(c => (
                                            <option key={c._id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {!currentFolder && companies.length === 0 && (
                                    <p className="text-xs text-danger mt-2 px-1">
                                        <CircleAlert size={10} className="inline mr-1" />
                                        No folders found. Create one first!
                                    </p>
                                )}
                                <p className="text-xs text-muted mt-2 px-1">
                                    Design will be saved in <strong>{(currentFolder?.name || selectedCompany) || 'Folder'}</strong> folder
                                </p>
                            </div>

                            <div className="design-dimensions-form">
                                <div className="form-row">
                                    <div className="form-group flex-1">
                                        <label className="form-label mb-2 block font-semibold text-sm">Width</label>
                                        <input 
                                            type="number" 
                                            className="input w-full" 
                                            value={customWidth} 
                                            onChange={e => setCustomWidth(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label className="form-label mb-2 block font-semibold text-sm">Height</label>
                                        <input 
                                            type="number" 
                                            className="input w-full" 
                                            value={customHeight} 
                                            onChange={e => setCustomHeight(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group flex-1">
                                        <label className="form-label mb-2 block font-semibold text-sm">Unit</label>
                                        <select 
                                            className="select-input w-full" 
                                            value={unit}
                                            onChange={e => setUnit(e.target.value)}
                                        >
                                            <option value="mm">mm</option>
                                            <option value="cm">cm</option>
                                            <option value="inch">inch</option>
                                            <option value="px">px</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleNew}>
                                <Plus size={16} /> Create Design
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {showFolderModal && (
                <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
                    <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Create New Folder</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowFolderModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label mb-2 block font-semibold text-sm">Folder Name (Company)</label>
                                <div className="company-input-wrapper">
                                    <FolderPlus className="input-icon-left" size={16} />
                                    <input 
                                        className="input w-full pl-10" 
                                        placeholder="e.g. Nike, Apple, Amazon" 
                                        value={newFolderName}
                                        onChange={e => setNewFolderName(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                                Create Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Folder Confirm */}
            {folderDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setFolderDeleteConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Folder?</h2>
                        </div>
                        <div className="modal-body">
                            <p>Deleting <strong>{folderDeleteConfirm.name}</strong> will NOT delete its designs, but they will be moved to uncategorized.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setFolderDeleteConfirm(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => {
                                deleteCompany(folderDeleteConfirm._id);
                                setFolderDeleteConfirm(null);
                            }}>
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete Design?</h2>
                        </div>
                        <div className="modal-body">
                            <p>This action cannot be undone. The design will be permanently deleted.</p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
