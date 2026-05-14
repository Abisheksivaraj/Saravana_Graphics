import React, { useState, useEffect } from 'react';
import { buyerAPI, vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { 
    UserPlus, Search, Building2, ChevronRight, 
    History, Mail, User, ShieldCheck, Info, X 
} from 'lucide-react';
import './AdminBuyerManager.css';

export default function AdminBuyerManager() {
    const [buyers, setBuyers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState({
        name: '', email: '', companyName: '', assignedGroup: ''
    });

    const uniqueGroupNames = [...new Set(vendors.flatMap(v => v.groupNames || []).filter(Boolean))].sort();

    const fetchData = async () => {
        try {
            setLoading(true);
            const [buyersRes, vendorsRes] = await Promise.all([
                buyerAPI.getAccounts(),
                vendorAPI.getAccounts()
            ]);
            setBuyers(buyersRes.data || []);
            setVendors(vendorsRes.data || []);
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

    const handleCreateBuyer = async (e) => {
        e.preventDefault();
        try {
            const loadingToast = toast.loading('Creating buyer account...');
            await buyerAPI.createAccount(formData);
            toast.dismiss(loadingToast);
            toast.success('Buyer account created. Credentials sent via email.');
            setShowModal(false);
            setFormData({ name: '', email: '', companyName: '', assignedGroup: '' });
            fetchData();
        } catch (err) {
             toast.error(err.response?.data?.message || 'Failed to create buyer');
        }
    };

    const filteredBuyers = buyers.filter(b => 
        (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (b.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="buyer-manager-container">
            <Sidebar />
            <main className="bm-main">
                <header className="bm-header">
                    <div className="bm-header-title">
                        <h1>Buyer Management</h1>
                        <p>Manage accounts and assign vendor group permissions</p>
                    </div>
                    <button className="bm-add-btn" onClick={() => setShowModal(true)}>
                        <UserPlus size={18} /> Add New Buyer
                    </button>
                </header>

                <div className="bm-controls">
                    <div className="bm-search-wrapper">
                        <Search size={20} className="bm-search-icon" />
                        <input 
                            className="bm-search-input"
                            placeholder="Search by name, company, or email..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bm-table-container">
                    <table className="bm-table">
                        <thead>
                            <tr>
                                <th>Buyer / Company</th>
                                <th>Username</th>
                                <th>Assigned Group</th>
                                <th>Join Date</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5">
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                            <div className="animate-spin" style={{ display: 'inline-block', marginBottom: 12 }}>⏳</div>
                                            <p>Loading buyer accounts...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredBuyers.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div style={{ textAlign: 'center', padding: '60px 40px', color: '#94a3b8' }}>
                                            <User size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                            <p style={{ fontSize: 16, fontWeight: 600 }}>No buyer accounts found</p>
                                            <p style={{ fontSize: 13 }}>Try adjusting your search or add a new buyer.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredBuyers.map(b => (
                                    <tr key={b._id} className="bm-row">
                                        <td>
                                            <div className="bm-buyer-info">
                                                <div className="bm-buyer-name">{b.name}</div>
                                                <div className="bm-buyer-sub">{b.companyName} • {b.email}</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'monospace', fontSize: 13, background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, color: '#475569' }}>
                                                {b.username}
                                            </span>
                                        </td>
                                        <td>
                                            {b.assignedGroup ? (
                                                <span className="bm-badge bm-badge-group">
                                                    <ShieldCheck size={12} style={{ marginRight: 6 }} /> {b.assignedGroup}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: 12, fontStyle: 'italic' }}>Unassigned</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                                {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                <button className="bm-action-btn" title="View Order History">
                                                    <History size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className="bm-modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="bm-modal" onClick={e => e.stopPropagation()}>
                            <div className="bm-modal-header">
                                <h2>Create Buyer Account</h2>
                                <button className="bm-modal-close" onClick={() => setShowModal(false)}>
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleCreateBuyer}>
                                <div className="bm-modal-body">
                                    <div className="bm-grid">
                                        <div className="bm-input-group">
                                            <label className="bm-label">Contact Name *</label>
                                            <div className="bm-input-wrapper">
                                                <User size={18} />
                                                <input required name="name" className="bm-input" placeholder="Full Name" value={formData.name} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="bm-input-group">
                                            <label className="bm-label">Email Address *</label>
                                            <div className="bm-input-wrapper">
                                                <Mail size={18} />
                                                <input required type="email" name="email" className="bm-input" placeholder="email@example.com" value={formData.email} onChange={handleChange} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bm-grid">
                                        <div className="bm-input-group">
                                            <label className="bm-label">Company Name *</label>
                                            <div className="bm-input-wrapper">
                                                <Building2 size={18} />
                                                <input required name="companyName" className="bm-input" placeholder="Company Ltd." value={formData.companyName} onChange={handleChange} />
                                            </div>
                                        </div>
                                        <div className="bm-input-group">
                                            <label className="bm-label">Assigned Vendor Group *</label>
                                            <div className="bm-input-wrapper">
                                                <ShieldCheck size={18} />
                                                <select 
                                                    required
                                                    name="assignedGroup" 
                                                    className="bm-input bm-select" 
                                                    value={formData.assignedGroup} 
                                                    onChange={handleChange}
                                                >
                                                    <option value="">Select Group</option>
                                                    {uniqueGroupNames.map(group => (
                                                        <option key={group} value={group}>{group}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bm-note">
                                        <Info size={20} className="bm-note-icon" />
                                        <p>
                                            <strong>Security Note:</strong> Account credentials will be automatically generated and dispatched to the provided email. This buyer will inherit view permissions for all vendors within the selected group.
                                        </p>
                                    </div>
                                </div>
                                <div className="bm-modal-footer">
                                    <button type="button" className="bm-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="bm-btn-primary">Create Account</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

