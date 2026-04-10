import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { vendorAPI, BASE_URL } from '../api';
import { 
    FileText, CheckCircle, Clock, XCircle, Upload,
    AlertCircle, Truck, Package, List, Search,
    Filter, MoreVertical, Layout, Trash2, Edit
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import './AdminVendorPortal.css';

const STATUS_OPTIONS = [
    'Excel Uploaded', 'Layout Uploaded', 'Artwork Rejected', 'Artwork Approved', 'Production', 'Despatch', 'Payment Follow-up'
];

export default function AdminVendorPortal() {
    const { logout } = useAuthStore();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [editingOrder, setEditingOrder] = useState(null);
    const [newStatus, setNewStatus] = useState('');
    const [remarks, setRemarks] = useState('');
    const [productionDate, setProductionDate] = useState('');

    const fetchData = async () => {
        try {
            const res = await vendorAPI.getOrders();
            setOrders(res.data);
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdateStatus = async () => {
        if (!editingOrder) return;
        try {
            await vendorAPI.updateStatus(editingOrder._id, { status: newStatus, remarks, productionDate });
            toast.success('Status updated successfully');
            setEditingOrder(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesSearch = 
            o.orderId.toLowerCase().includes(search.toLowerCase()) ||
            o.fileName.toLowerCase().includes(search.toLowerCase()) ||
            (o.vendorId?.name || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>Vendor Portal Management</h1>
                        <p>Manage all vendor uploads and status updates</p>
                    </div>
                </header>

                <div className="ap-controls">
                    <div className="ap-search">
                        <Search size={18} />
                        <input 
                            placeholder="Search by Order ID, File, or Vendor..." 
                            value={search || ''}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="ap-filter">
                        <Filter size={18} />
                        <select value={statusFilter || 'All'} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="ap-table-container">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Vendor</th>
                                <th>File Name</th>
                                <th>Brand</th>
                                <th>Upload Date</th>
                                <th>Production Date <AlertCircle size={14} className="inline"/></th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" className="text-center p-8">Loading orders...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan="7" className="text-center p-8">No orders found.</td></tr>
                            ) : (
                                filteredOrders.map(o => (
                                    <tr key={o._id}>
                                        <td className="font-mono text-primary font-bold">{o.orderId}</td>
                                        <td>
                                            <div className="ap-vendor-info">
                                                <span className="font-semibold">{o.vendorId?.name || 'Unknown'}</span>
                                                <small>{o.vendorId?.vendorCode || '-'}</small>
                                            </div>
                                        </td>
                                        <td className="ap-file-cell">
                                            <FileText size={16} /> {o.fileName}
                                        </td>
                                        <td>{o.brand}</td>
                                        <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                                        <td>
                                            {o.productionDate ? (
                                                <div className={`font-medium ${new Date() > new Date(o.productionDate) && o.status !== 'Despatch' && o.status !== 'Payment Follow-up' ? 'text-red-500' : ''}`}>
                                                    {new Date(o.productionDate).toLocaleDateString()}
                                                    {new Date() > new Date(o.productionDate) && o.status !== 'Despatch' && o.status !== 'Payment Follow-up' && (
                                                        <AlertCircle size={14} className="inline ml-1" />
                                                    )}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <span className={`ap-status-badge ${o.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {/* File download button */}
                                                <button 
                                                    className="btn btn-ghost btn-icon btn-sm" 
                                                    title="Download Excel"
                                                    onClick={() => window.open(`${BASE_URL}/${o.filePath}`, '_blank')}
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                {/* Upload Layout Direct Action */}
                                                <label 
                                                    className="btn btn-ghost btn-icon btn-sm cursor-pointer m-0 p-2 flex items-center justify-center" 
                                                    title="Upload Admin Layout (PDF/Image)"
                                                    style={{ margin: 0, padding: 8, cursor: 'pointer' }}
                                                >
                                                    <Upload size={16} />
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        style={{ display: 'none' }}
                                                        accept="image/*,.pdf"
                                                        onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if(file) {
                                                                const formData = new FormData();
                                                                formData.append('file', file);
                                                                try {
                                                                    await vendorAPI.uploadLayout(o._id, formData);
                                                                    toast.success('Layout uploaded & status advanced!');
                                                                    fetchData();
                                                                } catch(err) {
                                                                    toast.error('Failed to upload layout');
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {/* Edit Status button */}
                                                <button 
                                                    className="btn btn-ghost btn-icon btn-sm" 
                                                    title="Update Status / Remarks"
                                                    onClick={() => {
                                                        setEditingOrder(o);
                                                        setNewStatus(o.status);
                                                        setRemarks(o.remarks || '');
                                                        setProductionDate(o.productionDate ? new Date(o.productionDate).toISOString().split('T')[0] : '');
                                                    }}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Status Edit Modal */}
                {editingOrder && (
                    <div className="modal-overlay" onClick={() => setEditingOrder(null)}>
                        <div className="modal" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Update Order Status</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setEditingOrder(null)}>✕</button>
                            </div>
                            <div className="modal-body space-y-4">
                                <div className="p-3 bg-secondary rounded-lg mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted">Order ID</span>
                                        <span className="font-bold">{editingOrder.orderId}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted">Vendor</span>
                                        <span className="font-semibold">{editingOrder.vendorId?.name}</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label block text-sm font-semibold mb-2">New Status</label>
                                    <select 
                                        className="select-input w-full" 
                                        value={newStatus || ''} 
                                        onChange={e => setNewStatus(e.target.value)}
                                    >
                                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                {newStatus === 'Layout Uploaded' && (
                                    <div className="form-group mt-4">
                                        <label className="form-label block text-sm font-semibold mb-2">Upload Layout File (Admin Drawn)</label>
                                        <input 
                                            type="file" 
                                            className="input w-full p-2" 
                                            accept="image/*,.pdf"
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if(file) {
                                                    const formData = new FormData();
                                                    formData.append('file', file);
                                                    try {
                                                        await vendorAPI.uploadLayout(editingOrder._id, formData);
                                                        toast.success('Layout uploaded successfully');
                                                        fetchData();
                                                    } catch(err) {
                                                        toast.error('Failed to upload layout');
                                                    }
                                                }
                                            }}
                                        />
                                        {editingOrder.layoutFileUrl && <small className="text-muted block mt-1">A layout is already assigned. Uploading again will overwrite it.</small>}
                                    </div>
                                )}

                                <div className="form-group mt-4">
                                    <label className="form-label block text-sm font-semibold mb-2">Estimated Production Date</label>
                                    <input 
                                        type="date" 
                                        className="input w-full p-2" 
                                        value={productionDate || ''}
                                        onChange={e => setProductionDate(e.target.value)}
                                    />
                                    <small className="text-muted block mt-1">Set the deadline for production completion.</small>
                                </div>
                                <div className="form-group mt-4">
                                    <label className="form-label block text-sm font-semibold mb-2">Remarks</label>
                                    <textarea 
                                        className="textarea w-full p-2 h-24" 
                                        placeholder="Add notes or reasons for rejection..."
                                        value={remarks || ''}
                                        onChange={e => setRemarks(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setEditingOrder(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleUpdateStatus}>Update Status</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
