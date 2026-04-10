import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import { Users, Plus, UserPlus, FileText, CheckCircle } from 'lucide-react';
import './AdminVendorPortal.css'; // Reuse CSS if applicable

export default function AdminVendorManager() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // New vendor form state
    const [formData, setFormData] = useState({
        name: '', email: '', username: '', password: '', vendorCode: '', vendorGstin: '', vendorName: ''
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

    useEffect(() => {
        fetchVendors();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateVendor = async (e) => {
        e.preventDefault();
        try {
            await vendorAPI.createAccount(formData);
            toast.success('Vendor account created successfully');
            setShowModal(false);
            setFormData({ name: '', email: '', username: '', password: '', vendorCode: '', vendorGstin: '', vendorName: '' });
            fetchVendors();
        } catch (err) {
             toast.error(err.response?.data?.message || 'Failed to create vendor');
        }
    };

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>Vendor Accounts Management</h1>
                        <p>Create and oversee your vendor partners</p>
                    </div>
                </header>

                <div className="ap-controls" style={{ justifyContent: 'flex-end', padding: '15px 30px' }}>
                     <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                         <UserPlus size={16} style={{ marginRight: 8 }}/> Add New Vendor
                     </button>
                </div>

                <div className="ap-table-container">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Name / Email</th>
                                <th>Vendor Name</th>
                                <th>Vendor Code</th>
                                <th>GSTIN</th>
                                <th>Username</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="text-center p-8">Loading vendors...</td></tr>
                            ) : vendors.length === 0 ? (
                                <tr><td colSpan="6" className="text-center p-8">No vendors found.</td></tr>
                            ) : (
                                vendors.map(v => (
                                    <tr key={v._id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{v.name}</div>
                                            <small style={{ color: 'var(--text-muted)' }}>{v.email}</small>
                                        </td>
                                        <td className="font-semibold">{v.vendorName || '-'}</td>
                                        <td className="font-mono text-primary font-bold">{v.vendorCode || '-'}</td>
                                        <td>{v.vendorGstin || '-'}</td>
                                        <td>{v.username || '-'}</td>
                                        <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {showModal && (
                    <div className="modal-overlay" onClick={() => setShowModal(false)}>
                        <div className="modal" style={{ maxWidth: 650, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Create Vendor Account</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <form onSubmit={handleCreateVendor} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div className="modal-body" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                                    <div className="flex gap-4">
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Contact Name *</label>
                                            <input required name="name" className="input w-full" value={formData.name} onChange={handleChange} />
                                        </div>
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Email *</label>
                                            <input required type="email" name="email" className="input w-full" value={formData.email} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <div className="form-group mt-4">
                                        <label className="form-label block text-sm font-semibold mb-2">Business/Vendor Name</label>
                                        <input name="vendorName" className="input w-full" value={formData.vendorName} onChange={handleChange} />
                                    </div>
                                    <div className="flex gap-4 mt-4">
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Vendor Code *</label>
                                            <input required name="vendorCode" className="input w-full uppercase" value={formData.vendorCode} onChange={handleChange} />
                                        </div>
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Vendor GSTIN</label>
                                            <input name="vendorGstin" className="input w-full uppercase" value={formData.vendorGstin} onChange={handleChange} />
                                        </div>
                                    </div>
                                    <hr className="my-5" style={{ borderColor: 'var(--border-light)' }}/>
                                    <div className="flex gap-4">
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Login Username *</label>
                                            <input required name="username" className="input w-full" value={formData.username} onChange={handleChange} />
                                        </div>
                                        <div className="form-group flex-1">
                                            <label className="form-label block text-sm font-semibold mb-2">Login Password * (Min 6 chars)</label>
                                            <input required type="password" name="password" className="input w-full" value={formData.password} onChange={handleChange} />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Create Account</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
