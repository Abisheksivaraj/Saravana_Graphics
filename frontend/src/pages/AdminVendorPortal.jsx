import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { vendorAPI, BASE_URL } from '../api';
import {
    Search, Filter, RefreshCcw, FileText, Clock, Package, Truck,
    MessageSquare, Edit, AlertCircle, Loader2, Calendar, Upload, Trash2,
    FileSpreadsheet, FileSearch, CheckCircle2, CreditCard, ShieldCheck, User, X,
    Paperclip, Send,
    CheckCircle,
    Eye,
    History,
    Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';
import FileHistory from '../components/FileHistory';
import './AdminVendorPortal.css';

const STATUS_OPTIONS = [
    'Excel Uploaded', 'Layout Uploaded', 'Artwork Rejected', 'Revised Artwork Uploaded',
    'Artwork Approved', 'Performa Invoice Uploaded', 'Performa Invoice Approved',
    'Payment Proof Uploaded', 'Production', 'Delivered'
];

// Only statuses the Admin can manually set
const ADMIN_STATUS_OPTIONS = [
    'Layout Uploaded',
    'Revised Artwork Uploaded',
    'Performa Invoice Upload',
    'Production',
    'Delivered',
];

const STAGES = [
    { label: 'Excel', dotLabel: 'E', icon: FileSpreadsheet },
    { label: 'Artwork', dotLabel: 'A', icon: CheckCircle2 },
    { label: 'Performa Invoice', dotLabel: 'PI', icon: FileText },
    { label: 'Payment', dotLabel: 'P', icon: CreditCard },
    { label: 'Under Production', dotLabel: 'UP', icon: Package },
    { label: 'Delivered', dotLabel: 'D', icon: Truck },
];

function getStageIndex(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('excel')) return 0;
    if (s.includes('layout') || s.includes('artwork rejected') || s.includes('revised') || s.includes('artwork approved')) return 1;
    if (s.includes('performa')) return 2;
    if (s.includes('payment')) return 3;
    if (s.includes('production')) return 4;
    if (s.includes('delivered') || s.includes('completed')) return 5;
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
    if (s.includes('performa invoice approved')) return 'badge-approved';
    if (s.includes('performa') || s.includes('invoice')) return 'badge-invoice';
    if (s.includes('layout')) return 'badge-layout';
    if (s.includes('check uploaded')) return 'badge-payment';
    return 'badge-default';
}

export const handleDownload = async (e, url, filename) => {
    e.preventDefault();
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename || 'download';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        document.body.removeChild(a);
    } catch (err) {
        console.error("Download failed via fetch, falling back to open:", err);
        window.open(url, '_blank');
    }
};


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
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <a
                                            href={`${BASE_URL}/${order.paymentDetails.chequeScanUrl}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="jm-upload-btn payment-btn"
                                            style={{ textDecoration: 'none', padding: '8px 16px' }}
                                        >
                                            <Eye size={14} style={{ marginRight: '4px' }} /> View
                                        </a>
                                        <button
                                            onClick={(e) => handleDownload(e, `${BASE_URL}/${order.paymentDetails.chequeScanUrl}`, `cheque_${order.orderId}`)}
                                            className="jm-upload-btn payment-btn"
                                            style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', textDecoration: 'none', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
                                        >
                                            <Download size={14} style={{ marginRight: '4px' }} /> Download
                                        </button>
                                    </div>
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

// 3. Add the ArtworkHistoryModal component (add before AdminVendorPortal export)
function ArtworkHistoryModal({ order, onClose }) {
    const allEntries = [
        // Original layout
        ...(order.layoutHistory || []).map(h => ({ ...h, type: 'Layout' })),
        // All revised artworks
        ...(order.revisedArtworkHistory || []).map(h => ({ ...h, type: 'Revised Artwork' })),
        // Current layoutFileUrl if no history recorded
        ...(order.layoutFileUrl && !(order.layoutHistory?.length) ? [{
            type: 'Layout',
            fileUrl: order.layoutFileUrl,
            uploadedAt: order.updatedAt,
        }] : []),
    ].sort((a, b) => new Date(a.uploadedAt) - new Date(b.uploadedAt));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="ah-modal" onClick={e => e.stopPropagation()}>
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title">Artwork History</h2>
                        <span className="jm-order-id">#{order.orderId} · {order.vendorId?.name}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>

                <div className="ah-timeline">
                    {allEntries.length === 0 ? (
                        <p style={{ color: '#94a3b8', padding: '20px' }}>No artwork history found.</p>
                    ) : allEntries.map((entry, idx) => (
                        <div key={idx} className={`ah-entry ${entry.type === 'Layout' ? 'layout' : 'revised'}`}>
                            <div className="ah-entry-badge">
                                {entry.type === 'Layout' ? 'L' : `RA${idx}`}
                            </div>
                            <div className="ah-entry-info">
                                <div className="ah-entry-type">{entry.type}</div>
                                <div className="ah-entry-date">
                                    {new Date(entry.uploadedAt).toLocaleString()}
                                </div>
                            </div>
                            <a
                                href={`${BASE_URL}/${entry.fileUrl}`}
                                target="_blank"
                                rel="noreferrer"
                                className="jm-upload-btn"
                                style={{ textDecoration: 'none' }}
                            >
                                <Eye size={14} /> View
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function QuantityInput({ order, onRefresh }) {
    const [isEditing, setIsEditing] = useState(false);
    const [quantity, setQuantity] = useState(order.adminQuantity || '');
    const [saving, setSaving] = useState(false);

    const handleBlur = async () => {
        setIsEditing(false);
        if (quantity === (order.adminQuantity || '')) return;
        setSaving(true);
        try {
            await vendorAPI.updateQuantity(order._id, { adminQuantity: quantity });
            toast.success('Quantity updated');
            onRefresh();
        } catch (err) {
            toast.error('Failed to update quantity');
            setQuantity(order.adminQuantity || '');
        } finally {
            setSaving(false);
        }
    };

    if (isEditing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <input
                    autoFocus
                    type="text"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={e => e.key === 'Enter' && handleBlur()}
                    disabled={saving}
                    style={{
                        padding: '6px 10px',
                        fontSize: '1rem',
                        fontWeight: '800',
                        color: '#000',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        width: '100px',
                        textAlign: 'center',
                        outline: 'none',
                        backgroundColor: '#fff',
                        whiteSpace: 'nowrap'
                    }}
                />
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            style={{
                padding: '6px 10px',
                fontSize: '1.1rem',
                fontWeight: '900',
                color: '#000',
                cursor: 'pointer',
                textAlign: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '80px',
                whiteSpace: 'nowrap'
            }}
            title="Click to edit quantity"
            className="qty-view"
        >
            {quantity || '0'}
            {saving && <Loader2 size={12} className="oc-spin" color="#94a3b8" style={{ marginLeft: '6px' }} />}
        </div>
    );
}

function ProductionStartModal({ order, onClose, onRefresh }) {
    const [startDate, setStartDate] = useState(
        order.productionStartDate ? new Date(order.productionStartDate).toISOString().split('T')[0] : ''
    );
    const [comment, setComment] = useState(order.productionStartComment || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!startDate) return toast.error('Please select a date');
        setSaving(true);
        try {
            await vendorAPI.updateProductionStart(order._id, {
                productionStartDate: startDate,
                isProductionStarted: true,
                productionStartComment: comment
            });
            toast.success('Production started');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="jm-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title">Production Start Date</h2>
                        <span className="jm-order-id">#{order.orderId}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>
                <div className="jm-body" style={{ padding: '20px' }}>
                    <div className="jm-field">
                        <label>Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '15px' }}
                        />
                    </div>
                    <div className="jm-field">
                        <label>Comment / Remarks</label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Add production notes..."
                            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>
                </div>
                <div className="jm-footer">
                    <button className="jm-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="jm-btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? <><Loader2 size={16} className="oc-spin" /> Saving...</> : 'Save & Start'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function StopProductionModal({ order, onClose, onRefresh }) {
    const [saving, setSaving] = useState(false);

    const handleStop = async () => {
        setSaving(true);
        try {
            await vendorAPI.updateProductionStart(order._id, {
                isProductionStarted: false,
                productionStartDate: null,
                productionStartComment: ''
            });
            toast.success('Production stopped');
            onRefresh();
            onClose();
        } catch (err) {
            toast.error('Failed to stop production');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="jm-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title" style={{ color: '#ef4444' }}>Stop Production?</h2>
                        <span className="jm-order-id">#{order.orderId}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>
                <div className="jm-body" style={{ padding: '20px' }}>
                    <p style={{ fontSize: '1rem', color: '#1e293b' }}>Are you sure you want to stop production for <strong>{order.brand}</strong>?</p>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '10px' }}>This will reset the production start status and clear the recorded date.</p>
                </div>
                <div className="jm-footer">
                    <button className="jm-btn-cancel" onClick={onClose}>Keep Running</button>
                    <button className="jm-btn-save" style={{ background: '#ef4444' }} onClick={handleStop} disabled={saving}>
                        {saving ? <><Loader2 size={16} className="oc-spin" /> Stopping...</> : 'Yes, Stop Production'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProductionInfoModal({ order, onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="jm-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title">Production Information</h2>
                        <span className="jm-order-id">#{order.orderId}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>
                <div className="jm-body" style={{ padding: '20px' }}>
                    <div style={{ marginBottom: '15px' }}>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Brand</strong>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{order.brand}</span>
                    </div>
                    <div>
                        <strong style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Front Matter Production Started Date</strong>
                        <span style={{ fontSize: '1.1rem', color: '#f97316', fontWeight: 600 }}>
                            {new Date(order.productionStartDate).toLocaleDateString()}
                        </span>
                    </div>
                    {order.productionStartComment && (
                        <div style={{ marginTop: '15px' }}>
                            <strong style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Notes</strong>
                            <div style={{
                                padding: '12px',
                                background: '#fff7ed',
                                border: '1px solid #fed7aa',
                                borderRadius: '8px',
                                color: '#9a3412',
                                fontSize: '0.95rem',
                                marginTop: '4px'
                            }}>
                                {order.productionStartComment}
                            </div>
                        </div>
                    )}
                    <div style={{ marginTop: '20px', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.9rem', color: '#475569' }}>
                        Production has officially started for this brand.
                    </div>
                </div>
                <div className="jm-footer">
                    <button className="jm-btn-save" style={{ width: '100%' }} onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

function PaymentHistoryModal({ order, onClose }) {
    const history = order.paymentHistory || [];
    const current = order.paymentDetails || {};

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="jm-modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                <div className="jm-header">
                    <div>
                        <h2 className="jm-title">Payment Details & History</h2>
                        <span className="jm-order-id">#{order.orderId} · {order.vendorId?.name}</span>
                    </div>
                    <button className="jm-close" onClick={onClose}><X size={22} /></button>
                </div>

                <div className="jm-body" style={{ padding: '24px' }}>
                    {/* Current Payment Details */}
                    <div className="jm-section" style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 className="jm-section-title" style={{ margin: 0 }}>Current Payment Details</h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f97316', background: '#fff7ed', padding: '4px 12px', borderRadius: '20px' }}>
                                {current.paymentMode || 'N/A'}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Amount Paid</label>
                                <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>₹{current.amountPaid?.toLocaleString() || '0'}</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Cheque Number</label>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{current.chequeNumber || '—'}</span>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Cheque Date</label>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                                    {current.chequeDate ? new Date(current.chequeDate).toLocaleDateString() : '—'}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
                            {current.chequeScanUrl && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <a
                                        href={`${BASE_URL}/${current.chequeScanUrl}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="jm-upload-btn payment-btn"
                                        style={{ textDecoration: 'none', padding: '8px 16px' }}
                                    >
                                        <Eye size={16} style={{ marginRight: '8px' }} /> View Scan
                                    </a>
                                    <button
                                        onClick={(e) => handleDownload(e, `${BASE_URL}/${current.chequeScanUrl}`, `cheque_${order.orderId}`)}
                                        className="jm-upload-btn payment-btn"
                                        style={{ border: 'none', cursor: 'pointer', padding: '8px 16px', textDecoration: 'none', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}
                                    >
                                        <Download size={16} style={{ marginRight: '8px' }} /> Download
                                    </button>
                                </div>
                            )}
                            {current.purchaseOrdersUrl && (
                                <a href={`${BASE_URL}/${current.purchaseOrdersUrl}`} target="_blank" rel="noreferrer" className="jm-upload-btn" style={{ textDecoration: 'none', padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                                    <FileText size={16} style={{ marginRight: '8px' }} /> View Purchase Order
                                </a>
                            )}
                        </div>

                        {current.remarks && (
                            <div style={{ marginTop: '20px', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Vendor Remarks</label>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>{current.remarks}</p>
                            </div>
                        )}
                    </div>

                    {/* History Timeline */}
                    <div className="jm-section">
                        <h3 className="jm-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <History size={18} /> Payment History
                        </h3>
                        <div className="ah-timeline">
                            {history.length === 0 ? (
                                <p style={{ color: '#94a3b8', padding: '10px' }}>No previous payment records found.</p>
                            ) : [...history].reverse().map((h, idx) => (
                                <div key={idx} className="ah-entry" style={{ marginBottom: '12px', padding: '12px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                                    <div className="ah-entry-badge" style={{ background: '#f8fafc', color: '#64748b', fontSize: '0.7rem' }}>
                                        {history.length - idx}
                                    </div>
                                    <div className="ah-entry-info" style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div className="ah-entry-type" style={{ fontWeight: 800 }}>₹{h.amountPaid?.toLocaleString()} via {h.paymentMode}</div>
                                                <div className="ah-entry-date">{new Date(h.submittedAt || h.chequeDate).toLocaleString()}</div>
                                            </div>
                                            {h.chequeScanUrl && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <a
                                                        href={`${BASE_URL}/${h.chequeScanUrl}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="jm-link"
                                                        style={{ fontSize: '0.75rem', textDecoration: 'underline' }}
                                                    >
                                                        View Scan ↗
                                                    </a>
                                                    <button
                                                        onClick={(e) => handleDownload(e, `${BASE_URL}/${h.chequeScanUrl}`, `cheque_${order.orderId}_${idx}`)}
                                                        className="jm-link"
                                                        style={{ fontSize: '0.75rem', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                                    >
                                                        Download ⬇
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="jm-footer">
                    <button className="jm-btn-save" style={{ width: '100%' }} onClick={onClose}>Close</button>
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
    const [vendorFilter, setVendorFilter] = useState('All');
    const [brandFilter, setBrandFilter] = useState('All');
    const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'
    const [activeChat, setActiveChat] = useState(null);
    const [managingOrder, setManagingOrder] = useState(null);
    const [editingProductionStart, setEditingProductionStart] = useState(null);
    const [stoppingProduction, setStoppingProduction] = useState(null);
    const [viewingProductionInfo, setViewingProductionInfo] = useState(null);
    const [viewingPaymentHistory, setViewingPaymentHistory] = useState(null);
    const [deletingOrderId, setDeletingOrderId] = useState(null);
    const [deletePassInput, setDeletePassInput] = useState('');

    const handleDelete = async () => {
        if (deletePassInput !== 'sara@1234') {
            toast.error('Invalid admin password');
            return;
        }
        try {
            await vendorAPI.deleteOrder(deletingOrderId);
            toast.success('Order deleted successfully');
            setDeletingOrderId(null);
            setDeletePassInput('');
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
        const matchesVendor = vendorFilter === 'All' || o.vendorId?.name === vendorFilter;
        const matchesBrand = brandFilter === 'All' || o.brand === brandFilter;

        // Tab filtering
        const isCompleted = o.status === 'Delivered';
        const isProduction = o.status === 'Production';
        const isCancelled = o.status === 'Cancelled';

        let matchesTab = false;
        if (activeTab === 'active') matchesTab = !isProduction && !isCompleted && !isCancelled;
        else if (activeTab === 'production') matchesTab = isProduction;
        else if (activeTab === 'completed') matchesTab = isCompleted;
        else if (activeTab === 'cancelled') matchesTab = isCancelled;

        return matchesSearch && matchesStatus && matchesVendor && matchesBrand && matchesTab;
    });

    const uniqueVendors = ['All', ...new Set(orders.map(o => o.vendorId?.name).filter(Boolean))].sort();
    const uniqueBrands = ['All', ...new Set(orders.map(o => o.brand).filter(Boolean))].sort();



    const stats = STATUS_OPTIONS.reduce((acc, s) => {
        acc[s] = orders.filter(o => o.status === s).length;
        return acc;
    }, {});

    function getArtworkState(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('artwork rejected')) return 'rejected';
        if (s.includes('revised artwork uploaded')) return 'revised';
        return null;
    }

    const [artworkHistory, setArtworkHistory] = useState(null);

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

                {artworkHistory && (
                    <ArtworkHistoryModal
                        order={artworkHistory}
                        onClose={() => setArtworkHistory(null)}
                    />
                )}

                {editingProductionStart && (
                    <ProductionStartModal
                        order={editingProductionStart}
                        onRefresh={fetchData}
                        onClose={() => setEditingProductionStart(null)}
                    />
                )}

                {viewingProductionInfo && (
                    <ProductionInfoModal
                        order={viewingProductionInfo}
                        onClose={() => setViewingProductionInfo(null)}
                    />
                )}

                {stoppingProduction && (
                    <StopProductionModal
                        order={stoppingProduction}
                        onRefresh={fetchData}
                        onClose={() => setStoppingProduction(null)}
                    />
                )}

                {viewingPaymentHistory && (
                    <PaymentHistoryModal
                        order={viewingPaymentHistory}
                        onClose={() => setViewingPaymentHistory(null)}
                    />
                )}

                {deletingOrderId && (
                    <div className="ap-modal-overlay">
                        <div className="ap-modal-content" style={{ maxWidth: '400px' }}>
                            <div className="ap-modal-header">
                                <h3 style={{ color: '#ef4444' }}>Confirm Order Deletion</h3>
                                <button className="ap-close-btn" onClick={() => { setDeletingOrderId(null); setDeletePassInput(''); }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="ap-modal-body">
                                <p style={{ marginBottom: '15px', fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                                    This action is permanent and cannot be undone. Please enter the admin password to confirm deletion.
                                </p>
                                <input 
                                    type="password" 
                                    className="ap-input" 
                                    placeholder="Enter Admin Password" 
                                    value={deletePassInput}
                                    onChange={(e) => setDeletePassInput(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                                    style={{ 
                                        width: '100%', 
                                        padding: '12px', 
                                        borderRadius: '10px', 
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </div>
                            <div className="ap-modal-footer">
                                <button 
                                    className="ap-btn" 
                                    onClick={() => { setDeletingOrderId(null); setDeletePassInput(''); }}
                                    style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className="ap-btn" 
                                    onClick={handleDelete}
                                    style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Delete Permanently
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Strip */}
                <div className="ap-stats-strip">
                    {[
                        { label: 'Total', value: orders.length, color: '#f97316' },
                        { label: 'Pending Layout', value: stats['Excel Uploaded'] || 0, color: '#6366f1' },
                        { label: 'Artwork Review', value: (stats['Layout Uploaded'] || 0) + (stats['Revised Artwork Uploaded'] || 0), color: '#3b82f6' },
                        { label: 'Rejected', value: stats['Artwork Rejected'] || 0, color: '#ef4444' },
                        { label: 'Invoice Pending', value: (stats['Artwork Approved'] || 0) + (stats['Performa Invoice Uploaded'] || 0), color: '#f59e0b' },
                        { label: 'In Production', value: stats['Production'] || 0, color: '#8b5cf6' },
                        { label: 'Delivered', value: stats['Delivered'] || 0, color: '#10b981' },
                    ].map(s => (
                        <div key={s.label} className="ap-stat-card" onClick={() => {
                            if (s.label === 'Delivered') setActiveTab('completed');
                            else if (s.label === 'In Production') setActiveTab('production');
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
                            type="text"
                            placeholder="Search by Order ID, File, or Vendor..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="ap-filter">
                        <Filter size={18} color="#94a3b8" />
                        <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                            <option value="All">All Vendors</option>
                            {uniqueVendors.filter(v => v !== 'All').map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ap-filter">
                        <Filter size={18} color="#94a3b8" />
                        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                            <option value="All">All Brands</option>
                            {uniqueBrands.filter(b => b !== 'All').map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ap-filter">
                        <Filter size={18} color="#94a3b8" />
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="All">All Statuses</option>
                            {STATUS_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
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
                            {orders.filter(o => o.status !== 'Production' && o.status !== 'Delivered' && o.status !== 'Cancelled').length}
                        </span>
                    </button>
                    <button
                        className={`ap-tab ${activeTab === 'production' ? 'active' : ''}`}
                        onClick={() => setActiveTab('production')}
                    >
                        In Production
                        <span className="ap-tab-count">
                            {orders.filter(o => o.status === 'Production').length}
                        </span>
                    </button>
                    <button
                        className={`ap-tab ${activeTab === 'completed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('completed')}
                    >
                        Delivered
                        <span className="ap-tab-count">
                            {orders.filter(o => o.status === 'Delivered').length}
                        </span>
                    </button>
                    <button
                        className={`ap-tab ${activeTab === 'cancelled' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cancelled')}
                    >
                        Cancelled
                        <span className="ap-tab-count">
                            {orders.filter(o => o.status === 'Cancelled').length}
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
                                <th>Buyer</th>
                                <th>File</th>
                                <th>QTY</th>
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
                                const artworkState = getArtworkState(o.status);
                                return (
                                    <tr key={o._id} className={`ap-row ${o.status === 'Cancelled' ? 'cancelled-row' : ''}`} style={o.status === 'Cancelled' ? { opacity: 0.6, textDecoration: 'line-through' } : {}}>
                                        <td className="ap-td-num">{idx + 1}</td>
                                        <td className="ap-td-id" style={{ whiteSpace: 'nowrap' }}>{o.orderId}</td>
                                        <td>
                                            <div className="ap-vendor-info style={{ whiteSpace: 'nowrap' }}">
                                                <span className="ap-vendor-name">{o.vendorId?.name || 'Unknown'}</span>
                                                <span className="ap-vendor-code">{o.vendorId?.vendorCode || '—'}</span>
                                            </div>
                                        </td>
                                        <td className="ap-td-group" style={{ whiteSpace: 'nowrap' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f97316', background: '#fff7ed', padding: '2px 8px', borderRadius: '6px' }}>
                                                {o.groupName || '—'}
                                            </span>
                                        </td>
                                        <td className="ap-file-cell">
                                            <FileText size={15} />
                                            {o.filePath ? (
                                                <a href={`${BASE_URL}/${o.filePath.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="ap-file-link" title={o.fileName}>
                                                    {o.fileName?.length > 22 ? o.fileName.slice(0, 22) + '…' : o.fileName}
                                                </a>
                                            ) : (
                                                <span title={o.fileName}>{o.fileName?.length > 22 ? o.fileName.slice(0, 22) + '…' : o.fileName}</span>
                                            )}
                                        </td>
                                        <td className="ap-td-qty">
                                            <QuantityInput order={o} onRefresh={fetchData} />
                                        </td>
                                        <td className="ap-td-brand" style={{ backgroundColor: o.isProductionStarted ? '#f0fdf4' : 'transparent', transition: 'background-color 0.3s' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {o.isProductionStarted ? (
                                                    <CheckCircle
                                                        size={20}
                                                        fill="#22c55e"
                                                        color="#ffffff"
                                                        style={{ filter: 'drop-shadow(0 2px 4px rgba(34, 197, 94, 0.3))', cursor: 'pointer' }}
                                                        onClick={(e) => { e.stopPropagation(); setStoppingProduction(o); }}
                                                    />
                                                ) : (
                                                    <div
                                                        onClick={() => setEditingProductionStart(o)}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            border: '2px solid #94a3b8',
                                                            cursor: 'pointer',
                                                            backgroundColor: '#fff'
                                                        }}
                                                    />
                                                )}
                                                <span
                                                    onClick={() => o.isProductionStarted && setViewingProductionInfo(o)}
                                                    style={{
                                                        cursor: o.isProductionStarted ? 'pointer' : 'default',
                                                        textDecoration: o.isProductionStarted ? 'underline' : 'none',
                                                        color: o.isProductionStarted ? '#1e40af' : 'inherit',
                                                        fontWeight: o.isProductionStarted ? 700 : 'inherit',
                                                        display: 'flex',
                                                        flexDirection: 'column'
                                                    }}
                                                >
                                                    <span style={{ fontSize: '0.85rem' }}>{o.brandName || o.brand || '—'}</span>
                                                    {o.manualBrand && (
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500, marginTop: '1px' }}>
                                                            {o.manualBrand}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {/* Mini progress bar */}
                                            <div className="ap-mini-progress">
                                                {STAGES.map((stage, i) => {
                                                    let extraClass = '';
                                                    let dotLabel = stage.dotLabel;

                                                    if (i === 1 && artworkState === 'rejected') extraClass = 'rejected';
                                                    if (i === 1 && artworkState === 'revised') {
                                                        extraClass = 'revised';
                                                        dotLabel = 'RA';
                                                    }

                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`ap-mini-step ${i < stageIdx ? 'done' : ''} ${i === stageIdx ? 'active' : ''} ${extraClass} ${i === 1 ? 'clickable' : ''}`}
                                                            title={i === 1 ? 'View Artwork History' : stage.label}
                                                            onClick={i === 1 ? (e) => { e.stopPropagation(); setArtworkHistory(o); } : undefined}
                                                        >
                                                            {dotLabel}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="ap-mini-label">{stageIdx + 1}/6</div>
                                        </td>
                                        <td>
                                            <span
                                                className={`ap-status-badge ${getStatusBadgeClass(o.status)} ${o.status === 'Check Uploaded' ? 'clickable' : ''}`}
                                                onClick={() => o.status === 'Check Uploaded' && setViewingPaymentHistory(o)}
                                                style={{ cursor: o.status === 'Check Uploaded' ? 'pointer' : 'default' }}
                                            >
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
                                                    onClick={() => o.status !== 'Cancelled' && setManagingOrder(o)}
                                                    disabled={o.status === 'Cancelled'}
                                                    style={{ opacity: o.status === 'Cancelled' ? 0.4 : 1, cursor: o.status === 'Cancelled' ? 'not-allowed' : 'pointer' }}
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    className="ap-icon-btn delete"
                                                    title="Delete Order"
                                                    onClick={() => o.status !== 'Cancelled' && setDeletingOrderId(o._id)}
                                                    style={{ background: '#fef2f2', color: '#ef4444', opacity: o.status === 'Cancelled' ? 0.4 : 1, cursor: o.status === 'Cancelled' ? 'not-allowed' : 'pointer' }}
                                                    disabled={o.status === 'Cancelled'}
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
