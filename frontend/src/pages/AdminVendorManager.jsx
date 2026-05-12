import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { 
    Users, Plus, UserPlus, FileText, CheckCircle, Eye, EyeOff, Trash2, Pencil, X,
    Building2, Search, Filter, RefreshCcw, Mail, Lock, ShieldCheck, MapPin, Tag
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import './AdminVendorPortal.css'; 

export default function AdminVendorManager() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editVendor, setEditVendor] = useState(null);
    const [editForm, setEditForm] = useState({ vendorName: '', name: '', address: '', groupNames: [], entities: [] });
    const [newGroupName, setNewGroupName] = useState('');
    const [newEditGroupName, setNewEditGroupName] = useState('');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [editAvatarFile, setEditAvatarFile] = useState(null);
    const [editAvatarPreview, setEditAvatarPreview] = useState(null);
    const { user } = useAuthStore();
    
    // New vendor form state — entities as unified rows
    const [formData, setFormData] = useState({
        name: '', email: '', vendorName: '', adminCode: '',
        address: '', groupNames: [],
        entities: [{ vendorCode: '', brandName: '', gstin: '', groupName: '' }]
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

    // Row-based entity helpers
    const handleEntityChange = (index, field, value) => {
        const updated = formData.entities.map((ent, i) =>
            i === index ? { ...ent, [field]: value } : ent
        );
        setFormData({ ...formData, entities: updated });
    };

    const addEntityRow = () => {
        setFormData({ ...formData, entities: [...formData.entities, { vendorCode: '', brandName: '', gstin: '', groupName: '' }] });
    };

    const removeEntityRow = (index) => {
        if (formData.entities.length === 1) return toast.error('At least one vendor entity is required');
        setFormData({ ...formData, entities: formData.entities.filter((_, i) => i !== index) });
    };

    // Group name helpers (create form)
    const addGroupName = () => {
        const g = newGroupName.trim();
        if (!g) return;
        if (formData.groupNames.includes(g)) return toast.error('Group already added');
        setFormData({ ...formData, groupNames: [...formData.groupNames, g] });
        setNewGroupName('');
    };
    const removeGroupName = (idx) => {
        setFormData({ ...formData, groupNames: formData.groupNames.filter((_, i) => i !== idx) });
    };

    // Edit modal helpers
    const openEditModal = (v) => {
        setEditVendor(v);
        setEditForm({
            vendorName: v.vendorName || '',
            name: v.name || '',
            address: v.address || '',
            groupNames: v.groupNames || [],
            entities: (v.entities || []).map(e => ({ 
                vendorCode: e.vendorCode || '', 
                brandName: e.brandName || '', 
                gstin: e.vendorGstin || '',
                groupName: e.groupName || ''
            }))
        });
        setNewEditGroupName('');
        setEditAvatarFile(null);
        setEditAvatarPreview(v.avatar ? `http://localhost:5000/${v.avatar}` : null);
        setShowEditModal(true);
    };
    const handleEditAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditAvatarFile(file);
            setEditAvatarPreview(URL.createObjectURL(file));
        }
    };
    const addEditGroupName = () => {
        const g = newEditGroupName.trim();
        if (!g) return;
        if (editForm.groupNames.includes(g)) return toast.error('Group already added');
        setEditForm({ ...editForm, groupNames: [...editForm.groupNames, g] });
        setNewEditGroupName('');
    };
    const removeEditGroupName = (idx) => {
        setEditForm({ ...editForm, groupNames: editForm.groupNames.filter((_, i) => i !== idx) });
    };
    const handleEditEntityChange = (index, field, value) => {
        const updated = editForm.entities.map((ent, i) => i === index ? { ...ent, [field]: value } : ent);
        setEditForm({ ...editForm, entities: updated });
    };
    const addEditEntityRow = () => {
        setEditForm({ ...editForm, entities: [...editForm.entities, { vendorCode: '', brandName: '', gstin: '', groupName: '' }] });
    };
    const removeEditEntityRow = (idx) => {
        if (editForm.entities.length === 1) return toast.error('At least one entity required');
        setEditForm({ ...editForm, entities: editForm.entities.filter((_, i) => i !== idx) });
    };

    const handleUpdateVendor = async (e) => {
        e.preventDefault();
        const t = toast.loading('Updating vendor...');
        try {
            // Auto-add any typed but un-added group name
            let finalGroupNames = [...editForm.groupNames];
            if (newEditGroupName.trim() && !finalGroupNames.includes(newEditGroupName.trim())) {
                finalGroupNames.push(newEditGroupName.trim());
            }

            const data = new FormData();
            data.append('vendorName', editForm.vendorName);
            data.append('name', editForm.name);
            data.append('address', editForm.address);
            data.append('groupNames', JSON.stringify(finalGroupNames));
            const mappedEntities = editForm.entities.map(ent => ({
                vendorCode: ent.vendorCode.trim(),
                brandName: ent.brandName.trim(),
                vendorGstin: ent.gstin.trim(),
                groupName: ent.groupName,
                vendorName: editForm.vendorName
            }));
            data.append('entities', JSON.stringify(mappedEntities));
            if (editAvatarFile) data.append('avatar', editAvatarFile);
            await vendorAPI.updateAccount(editVendor._id, data);
            toast.success('Vendor updated!', { id: t });
            setShowEditModal(false);
            setEditAvatarFile(null);
            setEditAvatarPreview(null);
            setNewEditGroupName('');
            fetchVendors();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed', { id: t });
        }
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
        for (const ent of formData.entities) {
            if (!ent.vendorCode.trim()) return toast.error('Every row must have a Vendor Code');
        }

        const loadingToast = toast.loading('Creating vendor account...');
        try {
            // Auto-add any typed but un-added group name
            let finalGroupNames = [...formData.groupNames];
            if (newGroupName.trim() && !finalGroupNames.includes(newGroupName.trim())) {
                finalGroupNames.push(newGroupName.trim());
            }

            const data = new FormData();

            // Core fields
            data.append('name', formData.name);
            data.append('email', formData.email);
            data.append('vendorName', formData.vendorName);
            data.append('adminCode', formData.adminCode);
            data.append('address', formData.address || '');
            data.append('groupNames', JSON.stringify(finalGroupNames));
            // Convenience top-level fields from first entity
            data.append('vendorCode', formData.entities[0]?.vendorCode || '');
            data.append('vendorGstin', formData.entities[0]?.gstin || '');
            data.append('vendorBrand', formData.entities[0]?.brandName || '');
            data.append('autoGenerate', true);

            // All entities — saved to entities[] array in DB
            const entities = formData.entities.map(ent => ({
                vendorCode: ent.vendorCode.trim(),
                brandName: ent.brandName.trim(),
                vendorGstin: ent.gstin.trim(),
                groupName: ent.groupName,
                vendorName: formData.vendorName
            }));
            data.append('entities', JSON.stringify(entities));

            if (avatarFile) data.append('avatar', avatarFile);

            await vendorAPI.createAccount(data);
            toast.success(`Vendor added with ${entities.length} entity(ies)! Credentials sent via email.`, { id: loadingToast });
            setShowModal(false);
            setFormData({
                name: '', email: '', vendorName: '', adminCode: '',
                address: '', groupNames: [],
                entities: [{ vendorCode: '', brandName: '', gstin: '', groupName: '' }]
            });
            setNewGroupName('');
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
                                address: '', groupNames: [],
                                entities: [{ vendorCode: '', brandName: '', gstin: '', groupName: '' }]
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
                                <th style={{ padding: '14px 20px', color: '#94a3b8', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Groups</th>
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

                                        {/* Groups */}
                                        <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {(v.groupNames || []).length > 0 ? (
                                                    v.groupNames.map((g, i) => (
                                                        <span key={i} style={{ 
                                                            fontSize: '0.62rem', fontWeight: 800, background: '#f0f9ff', 
                                                            color: '#0369a1', padding: '2px 8px', borderRadius: '6px',
                                                            border: '1px solid #e0f2fe'
                                                        }}>
                                                            {g}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span style={{ color: '#cbd5e1', fontSize: '0.7rem', fontStyle: 'italic' }}>None</span>
                                                )}
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
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => openEditModal(v)}
                                                    title="Edit Vendor"
                                                    style={{
                                                        width: 32, height: 32, borderRadius: '10px', border: 'none',
                                                        background: '#eff6ff', color: '#3b82f6', cursor: 'pointer',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#dbeafe'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#eff6ff'}
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <button
                                                    onClick={() => { if(window.confirm('Permanently delete this vendor account?')) vendorAPI.deleteAccount(v._id).then(fetchVendors) }}
                                                    title="Delete Vendor"
                                                    style={{
                                                        width: 32, height: 32, borderRadius: '10px', border: 'none',
                                                        background: '#fef2f2', color: '#ef4444', cursor: 'pointer',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'background 0.15s'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                                                    onMouseLeave={e => e.currentTarget.style.background = '#fef2f2'}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
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
                                padding: '10px 24px', 
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
                                <div className="modal-body" style={{ padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    
                                    {/* Main Form Section */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 16, alignItems: 'start' }}>
                                        {/* Logo Column */}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ 
                                                width: 80, height: 80, borderRadius: '20px', 
                                                background: '#f8fafc', border: '2px dashed #e2e8f0', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                overflow: 'hidden'
                                            }}>
                                                {avatarPreview ? (
                                                    <img src={avatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Building2 size={24} color="#94a3b8" />
                                                )}
                                            </div>
                                            <label style={{ 
                                                position: 'absolute', bottom: -4, right: -4, 
                                                background: '#f97316', color: 'white', width: 28, height: 28, 
                                                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                cursor: 'pointer', border: '2px solid white', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                            }}>
                                                <Plus size={14} />
                                                <input type="file" hidden accept="image/*" onChange={handleAvatarChange} />
                                            </label>
                                        </div>

                                        {/* Row 1 & 2 combined into columns */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>1. Admin Ref Code (Read-Only)</label>
                                                <input 
                                                    readOnly
                                                    name="adminCode"
                                                    style={{ width: '100%', background: '#f1f5f9', border: '1.5px solid #e2e8f0', color: '#64748b', padding: '10px 14px', borderRadius: '12px', fontWeight: 900, fontSize: '0.9rem', fontFamily: 'monospace', outline: 'none', cursor: 'not-allowed' }} 
                                                    value={formData.adminCode || ''} 
                                                    placeholder="AUTO-GENERATED"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>2. Vendor Name *</label>
                                                <input required name="vendorName" 
                                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }} 
                                                    placeholder="e.g. Saravana Graphics" value={formData.vendorName || ''} onChange={handleChange} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>3. Mail ID *</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input required type="email" name="email" 
                                                        style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none' }} 
                                                        placeholder="vendor@example.com" value={formData.email || ''} onChange={handleChange} />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>4. Contact Person</label>
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
                                        padding: '6px 12px', background: 'rgba(2, 132, 199, 0.05)', 
                                        border: '1px solid rgba(2, 132, 199, 0.1)', borderRadius: '10px', 
                                        display: 'flex', gap: 8, alignItems: 'center'
                                    }}>
                                        <Lock size={14} color="#0284c7" />
                                        <p style={{ fontSize: '0.7rem', color: '#0369a1', margin: 0, fontWeight: 600 }}>
                                            System will auto-generate credentials and notify the vendor via email.
                                        </p>
                                    </div>


                                    {/* Address & Group Names Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {/* Address */}
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
                                                <MapPin size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />5. Address
                                            </label>
                                            <textarea
                                                name="address"
                                                rows={2}
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', resize: 'vertical', color: '#334155' }}
                                                placeholder="Full business address"
                                                value={formData.address || ''}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        {/* Group Names */}
                                        <div className="form-group">
                                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
                                                <Tag size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />6. Group Names
                                            </label>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                <input
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.85rem' }}
                                                    placeholder="Add group name & press +"
                                                    value={newGroupName}
                                                    onChange={e => setNewGroupName(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGroupName())}
                                                />
                                                <button type="button" onClick={addGroupName}
                                                    style={{ width: 34, height: 34, borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Plus size={15} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36 }}>
                                                {(formData.groupNames || []).map((g, i) => (
                                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#f97316', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                        {g}
                                                        <button type="button" onClick={() => removeGroupName(i)}
                                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex' }}>
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                                {(formData.groupNames || []).length === 0 && (
                                                    <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>No groups added yet</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Row-based Entity Builder */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Vendor Entities <span style={{ color: '#f97316' }}>({formData.entities.length})</span>
                                            </label>
                                            <button type="button" onClick={addEntityRow}
                                                style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Plus size={13} /> Add Entity
                                            </button>
                                        </div>

                                        {/* Column Header */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 34px', gap: 8, padding: '7px 12px', background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: '10px 10px 0 0' }}>
                                            {['Group Name', 'Vendor Code *', 'Brand Name', 'GSTIN Number'].map(h => (
                                                <span key={h} style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                                            ))}
                                            <span />
                                        </div>

                                        {/* Entity Rows */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                                            {formData.entities.map((ent, idx) => (
                                                <div key={idx} style={{
                                                    display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 34px', gap: 8,
                                                    padding: '10px 12px',
                                                    background: idx % 2 === 0 ? '#ffffff' : '#fafbfc',
                                                    borderBottom: idx < formData.entities.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                    alignItems: 'center',
                                                    transition: 'background 0.15s'
                                                }}>
                                                    {/* Group Name Select */}
                                                    <select 
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.8rem', outline: 'none', color: '#334155' }}
                                                        value={ent.groupName}
                                                        onChange={e => handleEntityChange(idx, 'groupName', e.target.value)}
                                                    >
                                                        <option value="">Select Group</option>
                                                        {formData.groupNames.map(gn => <option key={gn} value={gn}>{gn}</option>)}
                                                    </select>
                                                    {/* Vendor Code */}
                                                    <input
                                                        required
                                                        placeholder="e.g. SG000001"
                                                        style={{ width: '100%', background: '#fff7ed', border: '1.5px solid #fed7aa', color: '#f97316', padding: '4px 8px', borderRadius: '7px', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }}
                                                        value={ent.vendorCode}
                                                        onChange={e => handleEntityChange(idx, 'vendorCode', e.target.value.toUpperCase())}
                                                    />
                                                    {/* Brand Name */}
                                                    <input
                                                        placeholder="e.g. Nike"
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.82rem', outline: 'none', color: '#334155' }}
                                                        value={ent.brandName}
                                                        onChange={e => handleEntityChange(idx, 'brandName', e.target.value)}
                                                    />
                                                    {/* GSTIN */}
                                                    <input
                                                        placeholder="Optional GSTIN"
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.78rem', outline: 'none', color: '#64748b', textTransform: 'uppercase' }}
                                                        value={ent.gstin}
                                                        onChange={e => handleEntityChange(idx, 'gstin', e.target.value.toUpperCase())}
                                                    />
                                                    {/* Remove button */}
                                                    {idx > 0 ? (
                                                        <button type="button" onClick={() => removeEntityRow(idx)}
                                                            style={{ width: 30, height: 30, borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    ) : (
                                                        <div style={{ width: 30 }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '8px 0 0', fontStyle: 'italic' }}>
                                            Each row = one vendor entity. All will appear in the vendor's "Create Order" dropdown.
                                        </p>
                                    </div>
                                </div>


                                <div className="modal-footer" style={{ 
                                    padding: '10px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', 
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

                {/* ─── Edit Vendor Modal ─── */}
                {showEditModal && editVendor && (
                    <div className="modal-overlay" style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)'
                    }} onClick={() => setShowEditModal(false)}>
                        <div className="modal" style={{
                            width: '95%', maxWidth: 860, borderRadius: '24px', overflow: 'hidden',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid rgba(59,130,246,0.4)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{
                                padding: '16px 32px',
                                background: 'linear-gradient(135deg, #1e40af 0%, #1e293b 100%)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <h2 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0, color: '#fff' }}>Edit Vendor</h2>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', margin: 0 }}>{editVendor.vendorName || editVendor.name} · {editVendor.adminCode}</p>
                                </div>
                                <button onClick={() => setShowEditModal(false)}
                                    style={{ color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}>✕ Close</button>
                            </div>
                            <form onSubmit={handleUpdateVendor} style={{ background: '#ffffff' }}>
                                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 20, alignItems: 'start' }}>
                                        {/* Edit Logo Column */}
                                        <div style={{ position: 'relative' }}>
                                            <div style={{ 
                                                width: 80, height: 80, borderRadius: '20px', 
                                                background: '#f8fafc', border: '2px dashed #e2e8f0', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                overflow: 'hidden'
                                            }}>
                                                {editAvatarPreview ? (
                                                    <img src={editAvatarPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <Building2 size={24} color="#94a3b8" />
                                                )}
                                            </div>
                                            <label style={{ 
                                                position: 'absolute', bottom: -4, right: -4, 
                                                background: '#3b82f6', color: 'white', width: 28, height: 28, 
                                                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                cursor: 'pointer', border: '2px solid white', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                            }}>
                                                <Plus size={14} />
                                                <input type="file" hidden accept="image/*" onChange={handleEditAvatarChange} />
                                            </label>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Vendor Name *</label>
                                                <input required style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }}
                                                    placeholder="Vendor Name" value={editForm.vendorName}
                                                    onChange={e => setEditForm({ ...editForm, vendorName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>Contact Person</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Users size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }}
                                                        placeholder="Full Name" value={editForm.name}
                                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {/* Security Note or placeholder to keep layout balanced */}
                                            <div style={{ 
                                                padding: '10px 15px', background: '#f0f9ff', border: '1px solid #e0f2fe', 
                                                borderRadius: '12px', display: 'flex', gap: 10, alignItems: 'center'
                                            }}>
                                                <ShieldCheck size={16} color="#0369a1" />
                                                <p style={{ fontSize: '0.68rem', color: '#0369a1', margin: 0, fontWeight: 600 }}>
                                                    Editing core vendor details. Admin Ref Code remains fixed.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
                                                <MapPin size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Address
                                            </label>
                                            <textarea rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: '12px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.85rem', resize: 'vertical', color: '#334155' }}
                                                placeholder="Full business address" value={editForm.address}
                                                onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 2 }}>
                                                <Tag size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Group Names
                                            </label>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                                <input style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', outline: 'none', fontSize: '0.85rem' }}
                                                    placeholder="Add group name & press +"
                                                    value={newEditGroupName}
                                                    onChange={e => setNewEditGroupName(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addEditGroupName())} />
                                                <button type="button" onClick={addEditGroupName}
                                                    style={{ width: 34, height: 34, borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Plus size={15} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 36 }}>
                                                {editForm.groupNames.map((g, i) => (
                                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 700 }}>
                                                        {g}
                                                        <button type="button" onClick={() => removeEditGroupName(i)}
                                                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex' }}>
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                                {editForm.groupNames.length === 0 && (
                                                    <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic' }}>No groups added yet</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Vendor Entities <span style={{ color: '#3b82f6' }}>({editForm.entities.length})</span>
                                            </label>
                                            <button type="button" onClick={addEditEntityRow}
                                                style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                                                <Plus size={13} /> Add Entity
                                            </button>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 34px', gap: 8, padding: '7px 12px', background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: '10px 10px 0 0' }}>
                                            {['Group Name', 'Vendor Code *', 'Brand Name', 'GSTIN'].map(h => (
                                                <span key={h} style={{ fontSize: '0.6rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
                                            ))}
                                            <span />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 140, overflowY: 'auto', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                                            {editForm.entities.map((ent, idx) => (
                                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 34px', gap: 8, padding: '10px 12px', background: idx % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: idx < editForm.entities.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                                                    <select 
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.8rem', outline: 'none', color: '#334155' }}
                                                        value={ent.groupName}
                                                        onChange={e => handleEditEntityChange(idx, 'groupName', e.target.value)}
                                                    >
                                                        <option value="">Select Group</option>
                                                        {editForm.groupNames.map(gn => <option key={gn} value={gn}>{gn}</option>)}
                                                    </select>
                                                    <input required placeholder="e.g. SG000001"
                                                        style={{ width: '100%', background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1d4ed8', padding: '4px 8px', borderRadius: '7px', fontWeight: 900, fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }}
                                                        value={ent.vendorCode}
                                                        onChange={e => handleEditEntityChange(idx, 'vendorCode', e.target.value.toUpperCase())} />
                                                    <input placeholder="Brand Name"
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.82rem', outline: 'none', color: '#334155' }}
                                                        value={ent.brandName}
                                                        onChange={e => handleEditEntityChange(idx, 'brandName', e.target.value)} />
                                                    <input placeholder="Optional GSTIN"
                                                        style={{ width: '100%', background: '#fff', border: '1.5px solid #e2e8f0', padding: '4px 8px', borderRadius: '7px', fontSize: '0.78rem', outline: 'none', color: '#64748b', textTransform: 'uppercase' }}
                                                        value={ent.gstin}
                                                        onChange={e => handleEditEntityChange(idx, 'gstin', e.target.value.toUpperCase())} />
                                                    {idx > 0 ? (
                                                        <button type="button" onClick={() => removeEditEntityRow(idx)}
                                                            style={{ width: 30, height: 30, borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    ) : <div style={{ width: 30 }} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ padding: '12px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    <button type="button"
                                        style={{ borderRadius: '10px', fontWeight: 700, padding: '6px 16px', border: '1px solid #e2e8f0', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
                                        onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <button type="submit"
                                        style={{ borderRadius: '10px', fontWeight: 900, padding: '6px 20px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', border: 'none', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
                                        Save Changes
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
