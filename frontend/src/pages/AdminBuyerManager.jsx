import React, { useState, useEffect } from 'react';
import { buyerAPI, vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { UserPlus, Search, Building2, ChevronRight, History } from 'lucide-react';
import './AdminVendorPortal.css';

export default function AdminBuyerManager() {
    const [buyers, setBuyers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // New buyer form state
    const [formData, setFormData] = useState({
        name: '', email: '', username: '', password: '', companyName: '', assignedVendors: []
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [buyersRes, vendorsRes] = await Promise.all([
                buyerAPI.getAccounts(),
                vendorAPI.getAccounts()
            ]);
            setBuyers(buyersRes.data);
            setVendors(vendorsRes.data);
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleVendorToggle = (vendorId) => {
        const assigned = [...formData.assignedVendors];
        const idx = assigned.indexOf(vendorId);
        if (idx > -1) assigned.splice(idx, 1);
        else assigned.push(vendorId);
        setFormData({ ...formData, assignedVendors: assigned });
    };

    const handleCreateBuyer = async (e) => {
        e.preventDefault();
        try {
            await buyerAPI.createAccount(formData);
            toast.success('Buyer account created successfully');
            setShowModal(false);
            setFormData({ name: '', email: '', username: '', password: '', companyName: '', assignedVendors: [] });
            fetchData();
        } catch (err) {
             toast.error(err.response?.data?.message || 'Failed to create buyer');
        }
    };

    const filteredBuyers = buyers.filter(b => 
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>Buyer Management</h1>
                        <p>Manage buyer accounts and assign vendor access</p>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                         <UserPlus size={16} style={{ marginRight: 8 }}/> Add New Buyer
                    </button>
                </header>

                <div className="ap-controls">
                    <div className="ap-search">
                        <Search size={18} color="#94a3b8" />
                        <input 
                            placeholder="Search buyers by name or company..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="ap-table-container">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Buyer / Company</th>
                                <th>Username</th>
                                <th>Assigned Vendors</th>
                                <th>Created</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="5" className="ap-loading-cell">Loading buyers...</td></tr>
                            ) : filteredBuyers.length === 0 ? (
                                <tr><td colSpan="5" className="ap-empty-cell">No buyers found.</td></tr>
                            ) : (
                                filteredBuyers.map(b => (
                                    <tr key={b._id} className="ap-row">
                                        <td>
                                            <div className="ap-vendor-name">{b.name}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{b.companyName} • {b.email}</div>
                                        </td>
                                        <td className="ap-td-id">{b.username}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {b.assignedVendors?.length > 0 ? (
                                                    b.assignedVendors.map(vId => {
                                                        const v = vendors.find(vend => vend._id === vId);
                                                        return v ? (
                                                            <span key={vId} className="ap-status-badge badge-layout" style={{ fontSize: '9px' }}>
                                                                {v.vendorName || v.name}
                                                            </span>
                                                        ) : null;
                                                    })
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>None</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="ap-icon-btn chat" title="View History">
                                                <History size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title text-[white]">Create Buyer Account</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <form onSubmit={handleCreateBuyer} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div className="modal-body" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label block text-sm font-semibold mb-2">Buyer Contact Name *</label>
                                            <input required name="name" className="input w-full" value={formData.name} onChange={handleChange} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label block text-sm font-semibold mb-2">Email *</label>
                                            <input required type="email" name="email" className="input w-full" value={formData.email} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className="form-group mt-4">
                                        <label className="form-label block text-sm font-semibold mb-2">Company Name *</label>
                                        <input required name="companyName" className="input w-full" value={formData.companyName} onChange={handleChange} />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <div className="form-group">
                                            <label className="form-label block text-sm font-semibold mb-2">Login Username *</label>
                                            <input required name="username" className="input w-full" value={formData.username} onChange={handleChange} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label block text-sm font-semibold mb-2">Login Password *</label>
                                            <input required type="password" name="password" className="input w-full" value={formData.password} onChange={handleChange} />
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        <label className="form-label block text-sm font-bold mb-3 text-primary uppercase letter-spacing-1">Assign Vendors</label>
                                        
                                        <div className="flex gap-3 mb-4">
                                            <select 
                                                className="input flex-1"
                                                value=""
                                                onChange={(e) => {
                                                    const vId = e.target.value;
                                                    if (vId && !formData.assignedVendors.includes(vId)) {
                                                        handleVendorToggle(vId);
                                                    }
                                                }}
                                            >
                                                <option value="">-- Select Vendor to Add --</option>
                                                {vendors
                                                    .filter(v => !formData.assignedVendors.includes(v._id))
                                                    .map(v => (
                                                        <option key={v._id} value={v._id}>
                                                            {v.vendorName || 'No Business Name'} ({v.name}) - {v.vendorCode}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>

                                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '80px' }}>
                                            {formData.assignedVendors.length === 0 ? (
                                                <div className="text-center py-4 text-slate-400 text-sm italic">No vendors assigned yet. Select from the dropdown above.</div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    {formData.assignedVendors.map(vId => {
                                                        const v = vendors.find(vend => vend._id === vId);
                                                        return v ? (
                                                            <div key={vId} className="flex items-center gap-3 bg-white border border-orange-100 px-4 py-2 rounded-xl shadow-sm animate-in fade-in zoom-in duration-200">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-bold text-slate-800">{v.vendorName || 'No Business Name'}</span>
                                                                    <span className="text-[10px] text-slate-500 font-medium">Contact: {v.name}</span>
                                                                    <span className="text-[10px] text-primary font-mono font-bold tracking-wider">{v.vendorCode}</span>
                                                                </div>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleVendorToggle(vId)}
                                                                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Create Buyer Account</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
