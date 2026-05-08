import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { 
    Users, Plus, UserPlus, FileText, CheckCircle, Eye, EyeOff, Trash2, 
    Building2, Search, Filter, RefreshCcw, Mail, Lock, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import './AdminVendorPortal.css'; 

export default function AdminVendorManager() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const { user } = useAuthStore();
    
    // New vendor form state
    const [formData, setFormData] = useState({
        name: '', email: '', vendorName: '', adminCode: '',
        vendorCodes: [''],
        brandNames: [''],
        gstinNumbers: ['']
    });

    const fetchVendors = async () => {
        try {
            const res = await vendorAPI.getAccounts();
            setVendors(res.data);
        } catch (err) {
            toast.error('Failed to load vendors');
        } finally {
            setLoading(false);
        }
    };

    const generateVendorCode = (existingEntities = []) => {
        const initials = "SG";
        let maxNum = 0;
        vendors.forEach(v => {
            const allCodes = [v.vendorCode, ...(v.entities?.map(e => e.vendorCode) || [])];
            allCodes.forEach(code => {
                if (code && code.startsWith(initials)) {
                    const numPart = code.substring(initials.length);
                    const num = parseInt(numPart);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
        });
        existingEntities.forEach(e => {
            if (e.vendorCode && e.vendorCode.startsWith(initials)) {
                const numPart = e.vendorCode.substring(initials.length);
                const num = parseInt(numPart);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        return `${initials}${String(maxNum + 1).padStart(6, '0')}`;
    };

    const generateAdminCode = () => {
        const initials = "SG";
        let maxNum = 0;
        vendors.forEach(v => {
            if (v.adminCode && v.adminCode.startsWith(initials)) {
                const numPart = v.adminCode.substring(initials.length);
                const num = parseInt(numPart);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        return `${initials}${String(maxNum + 1).padStart(6, '0')}`;
    };

    useEffect(() => { fetchVendors(); }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Separate list helpers
    const handleListChange = (listName, index, value) => {
        const newList = [...formData[listName]];
        newList[index] = value;
        setFormData({ ...formData, [listName]: newList });
    };

    const addListItem = (listName) => {
        setFormData({ ...formData, [listName]: [...formData[listName], ''] });
    };

    const removeListItem = (listName, index) => {
        if (formData[listName].length === 1) return toast.error('At least one item is required');
        const newList = formData[listName].filter((_, i) => i !== index);
        setFormData({ ...formData, [listName]: newList });
    };

    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleCreateVendor = async (e) => {
        e.preventDefault();
        for (const code of formData.vendorCodes) {
            if (!code) return toast.error('Vendor Code is required');
        }

        const loadingToast = toast.loading('Creating vendor account...');
        try {
            const data = new FormData();
            
            // Core fields
            data.append('name', formData.name);
            data.append('email', formData.email);
            data.append('vendorName', formData.vendorName);
            data.append('adminCode', formData.adminCode);
            data.append('vendorCode', formData.vendorCodes[0] || '');
            data.append('vendorGstin', formData.gstinNumbers[0] || '');
            data.append('autoGenerate', true);
            
            // Build entities from the three separate lists
            const maxLen = Math.max(formData.vendorCodes.length, formData.brandNames.length, formData.gstinNumbers.length);
            const entities = [];
            for (let i = 0; i < maxLen; i++) {
                entities.push({
                    vendorCode: formData.vendorCodes[i] || '',
                    brandName: formData.brandNames[i] || '',
                    vendorGstin: formData.gstinNumbers[i] || '',
                    vendorName: formData.vendorName
                });
            }
            data.append('entities', JSON.stringify(entities));

            if (avatarFile) {
                data.append('avatar', avatarFile);
            }

            await vendorAPI.createAccount(data);
            toast.success('Vendor added! Login credentials sent via email.', { id: loadingToast });
            setShowModal(false);
            setFormData({ 
                name: '', email: '', vendorName: '', adminCode: '',
                vendorCodes: [''], brandNames: [''], gstinNumbers: ['']
            });
            setAvatarFile(null);
            setAvatarPreview(null);
            fetchVendors();
        } catch (err) {
             toast.error(err.response?.data?.message || 'Failed to create vendor', { id: loadingToast });
        }
    };

    const filteredVendors = vendors.filter(v => {
        const query = search.toLowerCase();
        const matchesSearch = 
            (v.name || '').toLowerCase().includes(query) ||
            (v.vendorName || '').toLowerCase().includes(query) ||
            (v.email || '').toLowerCase().includes(query) ||
            (v.adminCode || '').toLowerCase().includes(query) ||
            (v.entities || []).some(ent => 
                (ent.vendorCode || '').toLowerCase().includes(query) || 
                (ent.vendorGstin || '').toLowerCase().includes(query) ||
                (ent.brandName || '').toLowerCase().includes(query)
            );
        const matchesStatus = filterStatus === 'All' || v.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header style={{ padding: '28px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Vendor Management</h1>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' }}>Manage vendor accounts, codes & brand entities</p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button onClick={fetchVendors} style={{ 
                            width: 40, height: 40, borderRadius: '12px', border: '1px solid #e2e8f0', 
                            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                        }}><RefreshCcw size={16} color="#64748b" /></button>
                        <button className="btn btn-primary" onClick={() => {
                            const aCode = generateAdminCode();
                            setFormData({ 
                                name: '', email: '', vendorName: '', adminCode: aCode,
                                vendorCodes: [''], brandNames: [''], gstinNumbers: [''] 
                            });
                            setAvatarPreview(null);
                            setAvatarFile(null);
                            setShowModal(true);
                        }} style={{ 
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', 
                            borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem',
                            background: 'linear-gradient(135deg, #f97316, #ea580c)', border: 'none', color: '#fff',
                            boxShadow: '0 4px 14px rgba(249,115,22,0.3)', cursor: 'pointer'
                        }}>
                            <UserPlus size={16} /> Add Vendor
                        </button>
                    </div>
                </header>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '20px 32px' }}>
                    {[
                        { label: 'Total Vendors', value: vendors.length, color: '#3b82f6', bg: '#eff6ff' },
                        { label: 'Active', value: vendors.filter(v => v.status === 'active').length, color: '#059669', bg: '#ecfdf5' },
                        { label: 'Pending', value: vendors.filter(v => v.status === 'pending').length, color: '#f59e0b', bg: '#fffbeb' },
                        { label: 'Suspended', value: vendors.filter(v => v.status === 'suspended').length, color: '#ef4444', bg: '#fef2f2' }
                    ].map((stat, i) => (
                        <div key={i} style={{ 
                            background: stat.bg, borderRadius: '14px', padding: '16px 20px', 
                            border: `1px solid ${stat.color}15`, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: stat.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 900, color: stat.color }}>{stat.value}</span>
                        </div>
                    ))}
                </div>

                {/* Search & Filter */}
                <div style={{ padding: '0 32px 16px', display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            style={{ 
                                width: '100%', padding: '11px 14px 11px 42px', borderRadius: '12px', 
                                border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)', outline: 'none'
                            }}
                            placeholder="Search vendors, codes, brands..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select 
                        style={{ 
                            width: 160, padding: '11px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', 
                            appearance: 'none', background: '#fff', fontSize: '0.85rem', fontWeight: 600, color: '#475569',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)', cursor: 'pointer', outline: 'none'
                        }}
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="suspended">Suspended</option>
                    </select>
                </div>

                {/* Vendor Table */}
                <div style={{ 
                    margin: '0 32px 32px', borderRadius: '16px', overflow: 'hidden',
                    border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    background: '#fff'
                }}>
                    <div style={{ maxHeight: 'calc(100vh - 310px)', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vendor</th>
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ref Code</th>
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entities (Code / Brand / GSTIN)</th>
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Created</th>
                                <th style={{ padding: '14px 16px', color: '#94a3b8', textAlign: 'center', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', width: 60 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 50, color: '#94a3b8', fontSize: '0.9rem' }}>Loading vendors...</td></tr>
                            ) : filteredVendors.length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: 50, color: '#94a3b8', fontSize: '0.9rem' }}>No vendors found.</td></tr>
                            ) : (
                                filteredVendors.map((v, rowIdx) => (
                                    <tr key={v._id} style={{ 
                                        borderBottom: '1px solid #f1f5f9',
                                        background: rowIdx % 2 === 0 ? '#fff' : '#fafbfc',
                                        transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                    onMouseLeave={e => e.currentTarget.style.background = rowIdx % 2 === 0 ? '#fff' : '#fafbfc'}
                                    >
                                        {/* Vendor Info */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <div style={{ 
                                                    width: 40, height: 40, borderRadius: '12px', background: '#f1f5f9', 
                                                    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                    overflow: 'hidden', flexShrink: 0
                                                }}>
                                                    {v.avatar ? (
                                                        <img src={`http://localhost:5000/${v.avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    ) : (
                                                        <Building2 size={18} color="#94a3b8" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>{v.vendorName || v.name}</div>
                                                    <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Mail size={10} /> {v.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Admin Ref Code */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                                            {v.adminCode ? (
                                                <span style={{ 
                                                    background: '#f97316', color: '#fff', fontSize: '0.7rem', 
                                                    padding: '4px 10px', borderRadius: '8px', fontWeight: 900, fontFamily: 'monospace',
                                                    letterSpacing: '0.02em'
                                                }}>
                                                    {v.adminCode}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>—</span>
                                            )}
                                        </td>

                                        {/* Entities */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                                            {(v.entities || []).length > 0 ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {v.entities.map((ent, idx) => (
                                                        <div key={idx} style={{ 
                                                            display: 'inline-flex', gap: 8, alignItems: 'center', 
                                                            background: '#f8fafc', padding: '5px 12px', borderRadius: '8px',
                                                            border: '1px solid #f1f5f9', fontSize: '0.74rem'
                                                        }}>
                                                            {ent.vendorCode && (
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#f97316', fontSize: '0.78rem' }}>{ent.vendorCode}</span>
                                                            )}
                                                            {ent.vendorCode && (ent.brandName || ent.vendorGstin) && (
                                                                <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                                                            )}
                                                            {ent.brandName && (
                                                                <span style={{ fontWeight: 700, color: '#334155' }}>{ent.brandName}</span>
                                                            )}
                                                            {ent.brandName && ent.vendorGstin && (
                                                                <div style={{ width: 1, height: 12, background: '#e2e8f0' }} />
                                                            )}
                                                            {ent.vendorGstin && (
                                                                <span style={{ fontWeight: 600, color: '#64748b', fontSize: '0.7rem' }}>{ent.vendorGstin}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                                            <span style={{ 
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                padding: '4px 12px', borderRadius: '8px', fontSize: '0.68rem', fontWeight: 800,
                                                textTransform: 'uppercase',
                                                color: v.status === 'active' ? '#059669' : v.status === 'pending' ? '#d97706' : '#dc2626',
                                                background: v.status === 'active' ? '#ecfdf5' : v.status === 'pending' ? '#fffbeb' : '#fef2f2',
                                            }}>
                                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                                                {v.status}
                                            </span>
                                        </td>

                                        {/* Date */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                                            {new Date(v.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>

                                        {/* Action */}
                                        <td style={{ padding: '16px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                                            <button 
                                                onClick={() => { if(window.confirm('Permanently delete this vendor account?')) vendorAPI.deleteAccount(v._id).then(fetchVendors) }}
                                                style={{ 
                                                    width: 32, height: 32, borderRadius: '10px', border: 'none', 
                                                    background: '#fef2f2', color: '#ef4444', cursor: 'pointer',
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'background 0.15s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                                onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {showModal && (
                    <div className="modal-overlay" style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)' 
                    }} onClick={() => setShowModal(false)}>
                        <div className="modal" style={{ 
                            width: '95%', maxWidth: 950, borderRadius: '24px', overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid rgba(248, 105, 2, 0.9)'
                        }} onClick={e => e.stopPropagation()}>
                            
                            {/* Compact Premium Header */}
                            <div className="modal-header" style={{ 
                                padding: '16px 32px', 
                                background: 'linear-gradient(135deg, #e95d0cff 0%, #1e293b 100%)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <h2 className="modal-title text-[white]" style={{ fontWeight: 900, fontSize: '1.2rem', margin: 0 }}>Register New Vendor</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', margin: 0 }}>Set up a new business partner account</p>
                                </div>
                                <button className="btn btn-ghost" onClick={() => setShowModal(false)} 
                                    style={{ color: 'white', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', padding: '6px 12px', fontSize: '0.8rem' }}>✕ Close</button>
                            </div>

                            <form onSubmit={handleCreateVendor} style={{ background: '#ffffff' }}>
                                <div className="modal-body" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    
                                    {/* Main Form Section */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 24, alignItems: 'start' }}>
                                        {/* Logo Column */}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ 
                                                width: 110, height: 110, borderRadius: '24px', 
                                                background: '#f8fafc', border: '2px dashed #e2e8f0', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                overflow: 'hidden'
                                            }}>
                                                {avatarPreview ? (
                                                    <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Building2 size={32} color="#94a3b8" />
                                                )}
                                            </div>
                                            <label style={{ 
                                                position: 'absolute', bottom: -5, right: -5, 
                                                background: '#f97316', color: 'white', width: 32, height: 32, 
                                                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                cursor: 'pointer', border: '2px solid white', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                            }}>
                                                <Plus size={18} />
                                                <input type="file" hidden accept="image/*" onChange={handleAvatarChange} />
                                            </label>
                                        </div>

                                        {/* Row 1 & 2 combined into columns */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>1. Admin Ref Code (Read-Only)</label>
                                                <input 
                                                    readOnly
                                                    name="adminCode"
                                                    style={{ width: '100%', background: '#f1f5f9', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '10px 14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.9rem', fontFamily: 'monospace', outline: 'none', cursor: 'not-allowed' }} 
                                                    value={formData.adminCode || ''} 
                                                    placeholder="AUTO-GENERATED"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>2. Vendor Name *</label>
                                                <input required name="vendorName" 
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }} 
                                                    placeholder="e.g. Saravana Graphics" value={formData.vendorName || ''} onChange={handleChange} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>3. Mail ID *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input required type="email" name="email" 
                                                        style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none' }} 
                                                        placeholder="vendor@example.com" value={formData.email || ''} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>4. Contact Person</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Users size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input required name="name" 
                                                        style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none' }} 
                                                        placeholder="Full Name" value={formData.name || ''} onChange={handleChange} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Security Tip Overlay */}
                                    <div style={{ 
                                        padding: '10px 16px', background: 'rgba(2, 132, 199, 0.05)', 
                                        border: '1px solid rgba(2, 132, 199, 0.1)', borderRadius: '12px', 
                                        display: 'flex', gap: 10, alignItems: 'center'
                                    }}>
                                        <Lock size={14} color="#0284c7" />
                                        <p style={{ fontSize: '0.7rem', color: '#0369a1', margin: 0, fontWeight: 600 }}>
                                            System will auto-generate credentials and notify the vendor via email.
                                        </p>
                                    </div>

                                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: 0 }} />

                                    {/* Bottom Row: Three Separate Lists */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                        {/* Vendor Codes Column */}
                                        <div style={{ background: '#fbfcfd', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>Vendor Codes</label>
                                                <button type="button" onClick={() => addListItem('vendorCodes')} 
                                                    style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: 'none', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Add</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                                                {formData.vendorCodes.map((code, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <input 
                                                            style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', color: '#f97316', padding: '6px 10px', borderRadius: '8px', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }} 
                                                            value={code} 
                                                            onChange={e => handleListChange('vendorCodes', idx, e.target.value.toUpperCase())}
                                                        />
                                                        {idx > 0 && (
                                                            <button type="button" onClick={() => removeListItem('vendorCodes', idx)} 
                                                                style={{ width: 26, height: 26, borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Brand Names Column */}
                                        <div style={{ background: '#fbfcfd', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>Brand Names</label>
                                                <button type="button" onClick={() => addListItem('brandNames')} 
                                                    style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: 'none', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Add</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                                                {formData.brandNames.map((brand, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <input 
                                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.8rem' }} 
                                                            value={brand} 
                                                            onChange={e => handleListChange('brandNames', idx, e.target.value)}
                                                        />
                                                        {idx > 0 && (
                                                            <button type="button" onClick={() => removeListItem('brandNames', idx)} 
                                                                style={{ width: 26, height: 26, borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* GSTIN Numbers Column */}
                                        <div style={{ background: '#fbfcfd', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '14px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase' }}>GSTIN Numbers</label>
                                                <button type="button" onClick={() => addListItem('gstinNumbers')} 
                                                    style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: 'none', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}>+ Add</button>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                                                {formData.gstinNumbers.map((gstin, idx) => (
                                                    <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <input 
                                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.8rem', textTransform: 'uppercase' }} 
                                                            value={gstin} 
                                                            onChange={e => handleListChange('gstinNumbers', idx, e.target.value.toUpperCase())}
                                                        />
                                                        {idx > 0 && (
                                                            <button type="button" onClick={() => removeListItem('gstinNumbers', idx)} 
                                                                style={{ width: 26, height: 26, borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer" style={{ 
                                    padding: '16px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', 
                                    display: 'flex', justifyContent: 'flex-end', gap: 12 
                                }}>
                                    <button type="button" className="btn btn-secondary" 
                                        style={{ borderRadius: '10px', fontWeight: 700, padding: '8px 20px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} 
                                        onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" 
                                        style={{ 
                                            borderRadius: '10px', fontWeight: 900, padding: '8px 24px', 
                                            background: '#f97316', boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)', border: 'none', fontSize: '0.85rem'
                                        }}>
                                        Create & Send Credentials
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

function Typography({ children, style }) {
    return <span style={{ ...style }}>{children}</span>;
}
