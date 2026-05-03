import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { vendorAPI, BASE_URL } from '../api';
import { 
    Search, Filter, RefreshCcw, FileText, Clock, Package, Truck, 
    MessageSquare, Edit, AlertCircle, Loader2, Calendar, Upload, Trash2,
    FileSpreadsheet, FileSearch, CheckCircle2, CreditCard, ShieldCheck, User, X,
    Paperclip, Send,
    CheckCircle,
    Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import FileHistory from '../components/FileHistory';
import './AdminVendorPortal.css';

const STATUS_OPTIONS = [
    'Excel Uploaded', 'Layout Uploaded', 'Artwork Rejected', 'Revised Artwork Uploaded',
    'Artwork Approved', 'Performa Invoice Uploaded', 'Performa Invoice Upload',
    'Payment Proof Uploaded', 'Production', 'Delivered', 'Completed'
];

// Only statuses the Admin can manually set
const ADMIN_STATUS_OPTIONS = [
    'Layout Uploaded',
    'Revised Artwork Uploaded',
    'Performa Invoice Upload',
    'Production',
    'Delivered',
    'Completed',
];

const STAGES = [
    { label: 'Excel', icon: FileSpreadsheet },
    { label: 'Layout', icon: FileSearch },
    { label: 'Artwork', icon: CheckCircle2 },
    { label: 'Invoice', icon: FileText },
    { label: 'Payment', icon: CreditCard },
    { label: 'Production', icon: Package },
    { label: 'Delivered', icon: Truck },
];

function getStageIndex(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('excel')) return 0;
    if (s.includes('layout')) return 1;
    if (s.includes('artwork rejected') || s.includes('revised')) return 1;
    if (s.includes('artwork approved')) return 2;
    if (s.includes('performa')) return 3;
    if (s.includes('payment')) return 4;
    if (s.includes('production')) return 5;
    if (s.includes('delivered') || s.includes('completed')) return 6;
    return 0;
}

function getStatusBadgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('rejected')) return 'badge-rejected';
    if (s.includes('approved')) return 'badge-approved';
    if (s.includes('delivered')) return 'badge-delivered';
    if (s.includes('production')) return 'badge-production';
    if (s.includes('despatch')) return 'badge-despatch';
    if (s.includes('payment')) return 'badge-payment';
    if (s.includes('performa') || s.includes('invoice')) return 'badge-invoice';
    if (s.includes('layout')) return 'badge-layout';
    return 'badge-default';
}

// ─── Admin Chat Panel ────────────────────────────────────────────────────────
function AdminChat({ order, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef();

    const fetchMessages = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await vendorAPI.getMessages(order._id);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages(true);
        const interval = setInterval(() => fetchMessages(), 5000);
        return () => clearInterval(interval);
    }, [order._id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            const res = await vendorAPI.sendMessage(order._id, input);
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) {
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });

    return (
        <div className="order-chat-overlay" onClick={onClose}>
            <div className="order-chat-window" onClick={e => e.stopPropagation()}>
                <div className="oc-header">
                    <div className="oc-title">
                        <div className="oc-avatar-group">
                            <div className="oc-avatar admin"><ShieldCheck size={14} /></div>
                            <div className="oc-avatar vendor"><User size={14} /></div>
                        </div>
                        <div>
                            <h3>Order Chat — Admin</h3>
                            <span>#{order.orderId} · {order.vendorId?.name || 'Vendor'}</span>
                        </div>
                    </div>
                    <button className="oc-close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="oc-messages" ref={scrollRef}>
                    <div className="oc-notice">
                        Private channel with <strong>{order.vendorId?.name || 'the vendor'}</strong>. Only you and the vendor can see these messages.
                    </div>

                    {loading ? (
                        <div className="oc-loading">
                            <Loader2 size={24} className="oc-spin" />
                            <span>Loading conversation...</span>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="oc-empty">No messages yet. Start the conversation!</div>
                    ) : (() => {
                        let lastDate = '';
                        return messages.map(msg => {
                            const msgDate = formatDate(msg.createdAt);
                            const showDate = msgDate !== lastDate;
                            lastDate = msgDate;
                            return (
                                <React.Fragment key={msg._id}>
                                    {showDate && <div className="oc-date-divider">{msgDate}</div>}
                                    {/* Admin sent = role 'admin', shown on RIGHT for admin view */}
                                    <div className={`oc-msg-row ${msg.role === 'admin' ? 'vendor' : 'admin'}`}>
                                        <div className="oc-msg-bubble">
                                            <div className="oc-msg-info">
                                                <span className="oc-sender">{msg.role === 'admin' ? 'You (Admin)' : (order.vendorId?.name || 'Vendor')}</span>
                                                <span className="oc-time">{formatTime(msg.createdAt)}</span>
                                            </div>
                                            <div className="oc-msg-text">{msg.text}</div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        });
                    })()}
                </div>

                <div className="oc-input-area">
                    <button className="oc-attach-btn" title="Attach file"><Paperclip size={20} /></button>
                    <input
                        type="text"
                        placeholder="Type a message to vendor..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={sending}
                    />
                    <button className="oc-send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
                        {sending ? <Loader2 size={18} className="oc-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Job Management Modal ────────────────────────────────────────────────────
function JobModal({ order, onClose, onRefresh }) {
    const [newStatus, setNewStatus] = useState(order.status);
    const [remarks, setRemarks] = useState(order.remarks || '');
    const [productionDate, setProductionDate] = useState(
        order.productionDate ? new Date(order.productionDate).toISOString().split('T')[0] : ''
    );
    const [commitmentDate, setCommitmentDate] = useState(
        order.dispatchDate ? new Date(order.dispatchDate).toISOString().split('T')[0] : ''
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const stageIdx = getStageIndex(order.status);

    const [deliveryRemarks, setDeliveryRemarks] = useState(order.deliveryRemarks || '');
    const [deliveryFile, setDeliveryFile] = useState(null);

    const handleSave = async () => {
        setSaving(true);
        try {
            // If Delivered is selected, upload the proof first if exists
            if (newStatus === 'Delivered' && deliveryFile) {
                const fd = new FormData();
                fd.append('file', deliveryFile);
                await vendorAPI.uploadDeliveryProof(order._id, fd);
            }

            await vendorAPI.updateStatus(order._id, {
                status: newStatus,
                remarks,
                productionDate,
                dispatchDate: commitmentDate,
                deliveryRemarks: newStatus === 'Delivered' ? deliveryRemarks : undefined
            });
            toast.success('Order updated successfully');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleLayoutUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            await vendorAPI.uploadLayout(order._id, fd);
            toast.success('Layout uploaded — vendor notified');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to upload layout');
        } finally {
            setUploading(false);
        }
    };

    const handleInvoiceUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            await vendorAPI.uploadPerformaInvoice(order._id, fd);
            toast.success('Performa Invoice uploaded');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to upload invoice');
        } finally {
            setUploading(false);
        }
    };

    const handleRevisedArtworkUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        try {
            await vendorAPI.uploadRevisedArtwork(order._id, fd);
            toast.success('Revised artwork uploaded');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to upload revised artwork');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="jm-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title">Job Management</h2>
                        <span className="jm-order-id">#{order.orderId} · {order.vendorId?.name || 'Vendor'}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>

                {/* Progress Bar */}
                <div className="jm-progress">
                    {STAGES.map((s, i) => {
                        const Icon = s.icon;
                        const done = i < stageIdx;
                        const active = i === stageIdx;
                        return (
                            <React.Fragment key={s.label}>
                                <div className={`jm-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                                    <div className="jm-step-icon"><Icon size={14} /></div>
                                    <span className="jm-step-label">{s.label}</span>
                                </div>
                                {i < STAGES.length - 1 && <div className={`jm-connector ${done ? 'done' : ''}`} />}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="jm-body">
                    {/* Status + Dates */}
                    <div className="jm-section">
                        <h3 className="jm-section-title">Order Control</h3>
                        <div className="jm-grid-3">
                            <div className="jm-field">
                                <label>Status</label>
                                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                                    {ADMIN_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            {newStatus === 'Production' && (
                                <div className="jm-field">
                                    <label>Commitment Date</label>
                                    <input type="date" value={commitmentDate} onChange={e => setCommitmentDate(e.target.value)} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Workflow Actions */}
                    <div className="jm-section">
                        <h3 className="jm-section-title">Workflow Documents</h3>
                        <div className="jm-action-cards">
                            {/* Layout Upload */}
                            <div className="jm-action-card">
                                <div className="jm-action-info">
                                    <FileSearch size={18} className="jm-action-icon layout" />
                                    <div>
                                        <div className="jm-action-name">Layout Proof</div>
                                        <div className="jm-action-sub">
                                            {order.layoutFileUrl
                                                ? <a href={`${BASE_URL}/${order.layoutFileUrl}`} target="_blank" rel="noreferrer" className="jm-link">View Uploaded ↗</a>
                                                : 'No layout uploaded yet'}
                                        </div>
                                    </div>
                                </div>
                                <label className={`jm-upload-btn ${uploading ? 'disabled' : ''}`}>
                                    <Upload size={14} />
                                    {order.layoutFileUrl ? 'Replace' : 'Upload'}
                                    <input type="file" className="hidden-input" onChange={e => handleLayoutUpload(e.target.files[0])} />
                                </label>
                            </div>

                            {/* Performa Invoice Upload — only shown when status is Performa Invoice Upload */}
                            {newStatus === 'Performa Invoice Upload' && (
                                <div className="jm-action-card invoice">
                                    <div className="jm-action-info">
                                        <FileText size={18} className="jm-action-icon invoice" />
                                        <div>
                                            <div className="jm-action-name">Performa Invoice</div>
                                            <div className="jm-action-sub">
                                                {order.performaInvoiceUrl
                                                    ? <a href={`${BASE_URL}/${order.performaInvoiceUrl}`} target="_blank" rel="noreferrer" className="jm-link">View Invoice ↗</a>
                                                    : 'Upload the Performa Invoice for vendor approval'}
                                            </div>
                                        </div>
                                    </div>
                                    <label className={`jm-upload-btn invoice-btn ${uploading ? 'disabled' : ''}`}>
                                        <Upload size={14} />
                                        {order.performaInvoiceUrl ? 'Replace' : 'Upload'}
                                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden-input" onChange={e => handleInvoiceUpload(e.target.files[0])} />
                                    </label>
                                </div>
                            )}

                            {/* Revised Artwork Upload — only shown when status is Revised Artwork Uploaded */}
                            {newStatus === 'Revised Artwork Uploaded' && (
                                <div className="jm-action-card revised">
                                    <div className="jm-action-info">
                                        <Eye size={18} className="jm-action-icon revised" />
                                        <div>
                                            <div className="jm-action-name">Revised Artwork</div>
                                            <div className="jm-action-sub">
                                                {order.revisedArtworkUrl
                                                    ? <a href={`${BASE_URL}/${order.revisedArtworkUrl}`} target="_blank" rel="noreferrer" className="jm-link">View Latest ↗</a>
                                                    : 'Upload revised artwork'}
                                            </div>
                                        </div>
                                    </div>
                                    <label className={`jm-upload-btn revised-btn ${uploading ? 'disabled' : ''}`}>
                                        <Upload size={14} />
                                        Upload New
                                        <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden-input" onChange={e => handleRevisedArtworkUpload(e.target.files[0])} />
                                    </label>
                                </div>
                            )}

                            {/* Payment Proof from Vendor */}
                            {order.paymentDetails?.chequeScanUrl && (
                                <div className="jm-action-card payment">
                                    <div className="jm-action-info">
                                        <CreditCard size={18} className="jm-action-icon payment" />
                                        <div>
                                            <div className="jm-action-name">Payment Proof (from Vendor)</div>
                                            <div className="jm-action-sub">
                                                {order.paymentDetails?.paymentMode} ·
                                                {order.paymentDetails?.chequeNumber ? ` Chq: ${order.paymentDetails.chequeNumber}` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <a
                                        href={`${BASE_URL}/${order.paymentDetails.chequeScanUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="jm-upload-btn payment-btn"
                                    >
                                        <Eye size={14} /> View
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* File Upload History */}
                    <FileHistory
                        layoutHistory={order.layoutHistory || []}
                        revisedArtworkHistory={order.revisedArtworkHistory || []}
                        reviewHistory={order.reviewHistory || []}
                    />

                    {/* Remarks / Comment Box */}
                    <div className="jm-section">
                        <h3 className="jm-section-title">Remarks & Comments</h3>
                        <textarea
                            className="jm-textarea"
                            placeholder="Add remarks, rejection reasons, or instructions for the vendor..."
                            value={remarks}
                            onChange={e => setRemarks(e.target.value)}
                            rows={3}
                        />
                        <p className="jm-hint">These remarks will be visible to the vendor when they check the order status.</p>
                    </div>

                    {/* Delivery Section (Conditional) */}
                    {newStatus === 'Delivered' && (
                        <div className="jm-section" style={{ border: '2px solid #22c55e', background: '#f0fdf4' }}>
                            <h3 className="jm-section-title" style={{ color: '#166534' }}>Delivery Details</h3>
                            <div className="jm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="jm-field">
                                    <label>Delivery Remarks / Data</label>
                                    <input 
                                        type="text" 
                                        className="jm-input" 
                                        placeholder="Enter delivery details..."
                                        value={deliveryRemarks}
                                        onChange={e => setDeliveryRemarks(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #bdf1cc' }}
                                    />
                                </div>
                                <div className="jm-field">
                                    <label>Upload Delivery Proof (POD)</label>
                                    <label className="jm-upload-btn" style={{ background: '#22c55e', border: 'none' }}>
                                        <Upload size={14} />
                                        {deliveryFile ? deliveryFile.name : 'Choose Proof'}
                                        <input type="file" className="hidden-input" onChange={e => setDeliveryFile(e.target.files[0])} />
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="jm-footer">
                    <button className="jm-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="jm-btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 size={16} className="oc-spin" /> Saving...</> : <><CheckCircle size={16} /> Save Changes</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminVendorPortal() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'
    const [activeChat, setActiveChat] = useState(null);
    const [managingOrder, setManagingOrder] = useState(null);

    const handleDelete = async (orderId) => {
        if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
        try {
            await vendorAPI.deleteOrder(orderId);
            toast.success('Order deleted successfully');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete order');
        }
    };

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

    useEffect(() => { fetchData(); }, []);

    const filteredOrders = orders.filter(o => {
        const matchesSearch = 
            o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
            o.vendorId?.name?.toLowerCase().includes(search.toLowerCase()) ||
            o.fileName?.toLowerCase().includes(search.toLowerCase());
        
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        
        // Tab filtering
        const isCompleted = o.status === 'Delivered' || o.status === 'Completed';
        const matchesTab = activeTab === 'active' ? !isCompleted : isCompleted;

        return matchesSearch && matchesStatus && matchesTab;
    });

    const stats = STATUS_OPTIONS.reduce((acc, s) => {
        acc[s] = orders.filter(o => o.status === s).length;
        return acc;
    }, {});

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>Vendor Portal Management</h1>
                        <p>Track, manage and communicate with vendors for every order</p>
                    </div>
                    <button className="ap-refresh-btn" onClick={fetchData} title="Refresh">
                        <RefreshCcw size={18} />
                    </button>
                </header>

                {/* Stats Strip */}
                <div className="ap-stats-strip">
                    {[
                        { label: 'Total', value: orders.length, color: '#f97316' },
                        { label: 'Pending Layout', value: stats['Excel Uploaded'] || 0, color: '#6366f1' },
                        { label: 'Artwork Review', value: (stats['Layout Uploaded'] || 0) + (stats['Revised Artwork Uploaded'] || 0), color: '#3b82f6' },
                        { label: 'Rejected', value: stats['Artwork Rejected'] || 0, color: '#ef4444' },
                        { label: 'Invoice Pending', value: (stats['Artwork Approved'] || 0) + (stats['Performa Invoice Uploaded'] || 0), color: '#f59e0b' },
                        { label: 'In Production', value: stats['Production'] || 0, color: '#8b5cf6' },
                        { label: 'Delivered', value: (stats['Delivered'] || 0) + (stats['Completed'] || 0), color: '#10b981' },
                    ].map(s => (
                        <div key={s.label} className="ap-stat-card" onClick={() => {
                            if (s.label === 'Delivered') setActiveTab('completed');
                            else if (s.label !== 'Total') setActiveTab('active');
                            setStatusFilter(s.label === 'Total' ? 'All' : s.label);
                        }}>
                            <div className="ap-stat-value" style={{ color: s.color }}>{s.value}</div>
                            <div className="ap-stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="ap-controls">
                    <div className="ap-search">
                        <Search size={18} color="#94a3b8" />
                        <input
                            placeholder="Search by Order ID, File, or Vendor..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="ap-filter">
                        <Filter size={18} color="#f97316" />
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* Tabs */}
                <div className="ap-tabs">
                    <button 
                        className={`ap-tab ${activeTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Active Orders
                        <span className="ap-tab-count">
                            {orders.filter(o => o.status !== 'Delivered' && o.status !== 'Completed').length}
                        </span>
                    </button>
                    <button 
                        className={`ap-tab ${activeTab === 'completed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('completed')}
                    >
                        Completed
                        <span className="ap-tab-count">
                            {orders.filter(o => o.status === 'Delivered' || o.status === 'Completed').length}
                        </span>
                    </button>
                </div>

                {/* Table */}
                <div className="ap-table-container">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Order ID</th>
                                <th>Vendor</th>
                                <th>File</th>
                                <th>Brand</th>
                                <th>Progress</th>
                                <th>Status</th>
                                <th>Dates</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="9" className="ap-loading-cell">
                                    <Loader2 size={24} className="oc-spin" /> Loading orders...
                                </td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan="9" className="ap-empty-cell">
                                    <AlertCircle size={32} /> No orders found.
                                </td></tr>
                            ) : filteredOrders.map((o, idx) => {
                                const stageIdx = getStageIndex(o.status);
                                return (
                                    <tr key={o._id} className="ap-row">
                                        <td className="ap-td-num">{idx + 1}</td>
                                        <td className="ap-td-id">{o.orderId}</td>
                                        <td>
                                            <div className="ap-vendor-info">
                                                <span className="ap-vendor-name">{o.vendorId?.name || 'Unknown'}</span>
                                                <span className="ap-vendor-code">{o.vendorId?.vendorCode || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="ap-file-cell">
                                            <FileText size={15} />
                                            <span title={o.fileName}>{o.fileName?.length > 22 ? o.fileName.slice(0, 22) + '…' : o.fileName}</span>
                                        </td>
                                        <td className="ap-td-brand">{o.brand || '—'}</td>
                                        <td>
                                            {/* Mini progress bar */}
                                            <div className="ap-mini-progress">
                                                {STAGES.map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`ap-mini-step ${i < stageIdx ? 'done' : ''} ${i === stageIdx ? 'active' : ''}`}
                                                    />
                                                ))}
                                            </div>
                                            <div className="ap-mini-label">{stageIdx + 1}/7</div>
                                        </td>
                                        <td>
                                            <span className={`ap-status-badge ${getStatusBadgeClass(o.status)}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ap-dates-cell">
                                                <div className="ap-date-row">
                                                    <Clock size={12} /> {new Date(o.createdAt).toLocaleDateString()}
                                                </div>
                                                {o.productionDate && (
                                                    <div className="ap-date-row prod">
                                                        <Package size={12} /> {new Date(o.productionDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {o.dispatchDate && (
                                                    <div className="ap-date-row commit">
                                                        <Truck size={12} /> {new Date(o.dispatchDate).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ap-action-btns">
                                                <button
                                                    className="ap-icon-btn chat"
                                                    title="Open Chat with Vendor"
                                                    onClick={() => setActiveChat(o)}
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                                <button
                                                    className="ap-icon-btn manage"
                                                    title="Manage Order"
                                                    onClick={() => setManagingOrder(o)}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="ap-icon-btn delete"
                                                    title="Delete Order"
                                                    onClick={() => handleDelete(o._id)}
                                                    style={{ background: '#fef2f2', color: '#ef4444' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                {o.remarks && (
                                                    <span className="ap-remark-dot" title={o.remarks} />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Admin Chat Panel */}
                {activeChat && <AdminChat order={activeChat} onClose={() => setActiveChat(null)} />}

                {/* Job Management Modal */}
                {managingOrder && (
                    <JobModal
                        order={managingOrder}
                        onClose={() => setManagingOrder(null)}
                        onRefresh={fetchData}
                    />
                )}
            </main>
        </div>
    );
}
