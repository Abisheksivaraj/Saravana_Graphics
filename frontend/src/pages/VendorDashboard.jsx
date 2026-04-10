import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { vendorAPI } from '../api';
import { 
    Upload, FileText, CheckCircle, Clock, XCircle, 
    AlertCircle, Truck, Package, List, Search,
    LogOut, User as UserIcon, RefreshCcw, Layout
} from 'lucide-react';
import toast from 'react-hot-toast';
import './VendorDashboard.css';

const STATS_CONFIG = [
    { key: 'Excel Uploaded', label: 'Uploaded', icon: Clock, color: '#f59e0b' },
    { key: 'Layout Uploaded', label: 'Layout Ready', icon: Search, color: '#3b82f6' },
    { key: 'Artwork Rejected', label: 'Artwork Rejected', icon: XCircle, color: '#ef4444' },
    { key: 'Artwork Approved', label: 'Artwork Approved', icon: Layout, color: '#8b5cf6' },
    { key: 'Production', label: 'Production', icon: Package, color: '#06b6d4' },
    { key: 'Despatch', label: 'Despatch', icon: Truck, color: '#10b981' },
    { key: 'Payment Follow-up', label: 'Payment', icon: CheckCircle, color: '#22c55e' },
    { key: 'TotalFile', label: 'TotalFile', icon: List, color: '#64748b' }
];

export default function VendorDashboard() {
    const { user, logout } = useAuthStore();
    const [stats, setStats] = useState({});
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [brand, setBrand] = useState('');
    const [barcodeId, setBarcodeId] = useState('');
    
    const [reviewOrder, setReviewOrder] = useState(null);
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [datesOrder, setDatesOrder] = useState(null);
    const [prodDate, setProdDate] = useState('');
    const [dispDate, setDispDate] = useState('');

    const [paymentOrder, setPaymentOrder] = useState(null);
    const [paymentData, setPaymentData] = useState({
        amountPaid: '', tdsApplicable: false, paymentMode: 'PDC',
        chequeNumber: '', chequeDate: '', dispatchedBy: '',
        trackingNumber: '', deliveryDate: '', purchaseOrders: '', remarks: ''
    });
    const [chequeFile, setChequeFile] = useState(null);
    const [trackingFile, setTrackingFile] = useState(null);
    const [poFile, setPoFile] = useState(null);

    const fetchData = async () => {
        try {
            const [statsRes, ordersRes] = await Promise.all([
                vendorAPI.getStats(),
                vendorAPI.getOrders()
            ]);
            setStats(statsRes.data);
            setOrders(ordersRes.data);
        } catch (err) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a file first');
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('brand', brand);
        formData.append('barcodeFileId', barcodeId);

        setUploading(true);
        try {
            const res = await vendorAPI.upload(formData);
            toast.success(res.data.message);
            // Reset form
            setSelectedFile(null);
            setBrand('');
            setBarcodeId('');
            // Refresh data
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleReviewSubmit = async (status) => {
        if(!reviewOrder) return;
        try {
            await vendorAPI.updateStatus(reviewOrder._id, { status, remarks: reviewRemarks });
            toast.success(`Layout ${status === 'Artwork Approved' ? 'approved' : 'rejected'}`);
            setReviewOrder(null);
            setReviewRemarks('');
            fetchData();
        } catch(err) {
            toast.error('Failed to update review status');
        }
    };

    const handleDatesSubmit = async (e) => {
        e.preventDefault();
        try {
            await vendorAPI.updateDates(datesOrder._id, { productionDate: prodDate, dispatchDate: dispDate });
            toast.success('Dates submitted, order moved to Production');
            setDatesOrder(null);
            setProdDate('');
            setDispDate('');
            fetchData();
        } catch(err) {
             toast.error('Failed to submit dates');
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        Object.keys(paymentData).forEach(key => {
            if (paymentData[key] !== '' && paymentData[key] !== null) {
                formData.append(key, paymentData[key]);
            }
        });
        if (chequeFile) formData.append('chequeScanImage', chequeFile);
        if (trackingFile) formData.append('trackingScanCopy', trackingFile);
        if (poFile) formData.append('purchaseOrderCopy', poFile);

        try {
            await vendorAPI.submitPayment(paymentOrder._id, formData);
            toast.success('Payment details submitted successfully');
            setPaymentOrder(null);
            setChequeFile(null);
            setTrackingFile(null);
            setPoFile(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to submit payment details');
        }
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="vendor-portal">
            {/* Navbar */}
            <nav className="vp-nav">
                <div className="vp-nav-container">
                    <div className="vp-logo">
                        <span className="vp-logo-text">Saravana Graphics</span>
                        <div className="vp-logo-divider"></div>
                        <span className="vp-logo-sub">Vendor Portal</span>
                    </div>
                    <div className="vp-user-info">
                        <div className="vp-user-details">
                            <span className="vp-username">{user?.name}</span>
                            <span className="vp-user-role">Vendor Portal</span>
                        </div>
                        <div className="vp-avatar">
                            <UserIcon size={20} />
                        </div>
                        <button className="vp-logout-btn" onClick={logout} title="Logout">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>
            </nav>

            <div className="vp-content">
                <div className="vp-header">
                    <div className="vp-header-title">
                        <RefreshCcw size={20} className={loading ? 'spin' : ''} onClick={fetchData} style={{ cursor: 'pointer' }} />
                        <h1>Vendor Upload</h1>
                    </div>
                </div>

                {/* Compact Top Bar */}
                <div className="vp-compact-topbar">
                    {/* Horizontal Stats */}
                    <div className="vp-compact-stats">
                        <div className="vp-donut-chart">
                            <div className="vp-donut-inner"></div>
                        </div>
                        <div className="vp-stats-divider"></div>
                        {STATS_CONFIG.map(config => (
                            <div key={config.key} className="vp-stat-item">
                                <span className="vp-stat-value" style={{ color: config.color }}>{stats[config.key] || 0}</span>
                                <span className="vp-stat-label">{config.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Inline Upload */}
                    <div className="vp-inline-upload">
                        <input 
                            type="file" 
                            id="file-upload" 
                            accept=".xls,.xlsx" 
                            onChange={handleFileChange} 
                        />
                        <label htmlFor="file-upload" className="vp-upload-select" title={selectedFile ? selectedFile.name : 'Choose file'}>
                            {selectedFile ? 'Ready' : 'Select File'}
                        </label>
                        <div className="vp-upload-divider"></div>
                        <button 
                            className="vp-upload-action" 
                            onClick={handleUpload} 
                            disabled={uploading || !selectedFile}
                        >
                            <Upload size={14} style={{ marginRight: 6 }} /> {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="vp-table-container">
                    <table className="vp-table">
                        <thead>
                            <tr>
                                <th>SrNo</th>
                                <th>Order ID</th>
                                <th>FileName</th>
                                <th>Brand</th>
                                <th>Uploaded By</th>
                                <th>Dates</th>
                                <th>Status</th>
                                <th>Actions</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="vp-empty-state">
                                        No files uploaded yet.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order, index) => (
                                    <tr key={order._id}>
                                        <td>{index + 1}</td>
                                        <td className="font-mono text-xs">{order.orderId}</td>
                                        <td>{order.fileName}</td>
                                        <td>{order.brand}</td>
                                        <td>{order.uploadedBy?.name || user?.name}</td>
                                        <td>
                                            <div className="text-xs">
                                                <div className="text-muted">Up: {formatDate(order.createdAt)}</div>
                                                {order.productionDate && <div className="text-primary font-semibold mt-1">Prod: {formatDate(order.productionDate)}</div>}
                                                {order.dispatchDate && <div className="text-blue-600 font-semibold mt-1">Disp: {formatDate(order.dispatchDate)}</div>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`vp-status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td>
                                            {order.status === 'Layout Uploaded' && (
                                                 <button className="btn btn-primary btn-sm" onClick={() => { setReviewOrder(order); setReviewRemarks(order.remarks || ''); }}>
                                                     Review Layout
                                                 </button>
                                            )}
                                            {order.status === 'Artwork Approved' && (
                                                 <button className="btn btn-secondary btn-sm" onClick={() => setDatesOrder(order)}>
                                                     Set Dates
                                                 </button>
                                            )}
                                            {(order.status === 'Despatch' || order.status === 'Payment Follow-up') && (
                                                 <button className="btn btn-secondary btn-sm" onClick={() => setPaymentOrder(order)}>
                                                     Add Payment Details
                                                 </button>
                                            )}
                                        </td>
                                        <td className="vp-remarks">{order.remarks || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Layout Review Modal */}
                {reviewOrder && (
                    <div className="modal-overlay" onClick={() => setReviewOrder(null)}>
                        <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Review Layout</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setReviewOrder(null)}>✕</button>
                            </div>
                            <div className="modal-body space-y-4">
                                <div className="p-4 bg-secondary rounded-lg flex items-center justify-between">
                                    <span className="font-semibold text-sm">Download Admin Layout:</span>
                                    {reviewOrder.layoutFileUrl ? (
                                         <button className="btn btn-primary btn-sm" onClick={() => window.open(`http://localhost:5000/${reviewOrder.layoutFileUrl.replace(/\\/g, '/')}`, '_blank')}>
                                            <FileText size={16} className="mr-2"/> View Layout
                                         </button>
                                    ) : (
                                         <span className="text-muted text-sm">No layout file found.</span>
                                    )}
                                </div>
                                <div className="form-group mt-4">
                                     <label className="form-label block text-sm font-semibold mb-2">Remarks</label>
                                     <textarea 
                                         className="textarea w-full p-2 h-24" 
                                         placeholder="Add your remarks or reasons for rejection..."
                                         value={reviewRemarks}
                                         onChange={e => setReviewRemarks(e.target.value)}
                                     />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ gap: 10 }}>
                                <button className="btn btn-secondary" onClick={() => setReviewOrder(null)}>Cancel</button>
                                <button className="btn btn-danger" style={{ backgroundColor: '#ef4444', color: 'white' }} onClick={() => handleReviewSubmit('Artwork Rejected')}>Reject Layout</button>
                                <button className="btn btn-primary" style={{ backgroundColor: '#22c55e', color: 'white', borderColor: '#22c55e' }} onClick={() => handleReviewSubmit('Artwork Approved')}>Approve Layout</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Date Submission Modal */}
                {datesOrder && (
                    <div className="modal-overlay" onClick={() => setDatesOrder(null)}>
                        <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Production & Dispatch Dates</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setDatesOrder(null)}>✕</button>
                            </div>
                            <form onSubmit={handleDatesSubmit}>
                                <div className="modal-body space-y-4">
                                    <div className="form-group mb-4">
                                         <label className="form-label block text-sm font-semibold mb-2">Production Required Date</label>
                                         <input required type="date" className="input w-full" value={prodDate} onChange={e => setProdDate(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                         <label className="form-label block text-sm font-semibold mb-2">Dispatch Required Date</label>
                                         <input required type="date" className="input w-full" value={dispDate} onChange={e => setDispDate(e.target.value)} />
                                    </div>
                                </div>
                                <div className="modal-footer mt-4">
                                    <button type="button" className="btn btn-secondary" onClick={() => setDatesOrder(null)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Submit Dates</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Payment Acknowledgement Modal */}
                {paymentOrder && (
                    <div className="modal-overlay" onClick={() => setPaymentOrder(null)} style={{ alignItems: 'flex-start', padding: '2rem 0', overflowY: 'auto' }}>
                        <div className="modal" style={{ maxWidth: 1000, width: '95%' }} onClick={e => e.stopPropagation()}>
                            <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: 12, marginBottom: 16 }}>
                                <h2 className="modal-title" style={{ fontSize: 18 }}>Payment Acknowledgement - SINGLE MODE</h2>
                                <button className="btn btn-ghost btn-icon" onClick={() => setPaymentOrder(null)}>✕</button>
                            </div>
                            <form onSubmit={handlePaymentSubmit}>
                                <div className="modal-body">
                                    {/* Top Section */}
                                    <div className="form-group mb-4">
                                        <label className="text-sm font-bold text-red-500 mb-1 block">* Total Amount Paid:</label>
                                        <input required type="number" className="input w-full" placeholder="0" value={paymentData.amountPaid} onChange={e => setPaymentData({...paymentData, amountPaid: e.target.value})} />
                                    </div>
                                    <div className="flex items-center gap-2 mb-6">
                                        <input type="checkbox" id="tds" checked={paymentData.tdsApplicable} onChange={e => setPaymentData({...paymentData, tdsApplicable: e.target.checked})} />
                                        <label htmlFor="tds" className="text-sm font-semibold text-gray-700">TDS Applicable</label>
                                    </div>

                                    {/* Modes */}
                                    <div className="mb-6">
                                        <label className="text-sm font-bold text-gray-700 mb-2 block">Payment Mode: {paymentData.paymentMode}</label>
                                        <div className="flex justify-center gap-4">
                                            {['PDC', 'NEFT/RTGS', 'UPI'].map(mode => (
                                                <button 
                                                    key={mode} type="button"
                                                    className={`px-6 py-3 rounded-lg border-2 font-bold transition flex items-center gap-2 ${paymentData.paymentMode === mode ? 'border-primary text-primary bg-blue-50' : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'}`}
                                                    onClick={() => setPaymentData({...paymentData, paymentMode: mode})}
                                                >
                                                    {mode === 'PDC' && <Layout size={18} />}
                                                    {mode === 'NEFT/RTGS' && <Layout size={18} />}
                                                    {mode === 'UPI' && <Layout size={18} />}
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dense Grid matching screenshot */}
                                    <div className="grid grid-cols-5 gap-4 mb-4">
                                        {/* Row 1 */}
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-red-500 block mb-1">* Cheque Number:</label>
                                            <input required type="text" className="input text-xs w-full p-2" placeholder="Cheque No" value={paymentData.chequeNumber} onChange={e => setPaymentData({...paymentData, chequeNumber: e.target.value})} />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-red-500 block mb-1">* Cheque Scan Image:</label>
                                            <div className="flex bg-gray-50 border border-gray-200 rounded text-xs overflow-hidden h-8">
                                                <label className="bg-gray-100 flex-1 px-2 py-1 border-r border-gray-200 truncate cursor-pointer text-gray-600 flex items-center justify-center">
                                                    {chequeFile ? chequeFile.name : 'Choose File'}
                                                    <input required type="file" className="hidden" onChange={e => setChequeFile(e.target.files[0])} />
                                                </label>
                                            </div>
                                        </div>
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-red-500 block mb-1">* Cheque Date:</label>
                                            <input required type="date" className="input text-xs w-full p-2 h-8" value={paymentData.chequeDate} onChange={e => setPaymentData({...paymentData, chequeDate: e.target.value})} />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-red-500 block mb-1">* Dispatched By:</label>
                                            <input required type="text" className="input text-xs w-full p-2 h-8" placeholder="Courier Name" value={paymentData.dispatchedBy} onChange={e => setPaymentData({...paymentData, dispatchedBy: e.target.value})} />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="text-xs font-bold text-gray-700 block mb-1">Tracking Scan Copy:</label>
                                            <div className="flex bg-gray-50 border border-gray-200 rounded text-xs overflow-hidden h-8">
                                                <label className="bg-gray-100 flex-1 px-2 py-1 border-r border-gray-200 truncate cursor-pointer text-gray-600 flex items-center justify-center">
                                                    {trackingFile ? trackingFile.name : 'Choose File'}
                                                    <input type="file" className="hidden" onChange={e => setTrackingFile(e.target.files[0])} />
                                                </label>
                                            </div>
                                        </div>

                                        {/* Row 2 */}
                                        <div className="col-span-1 mt-2">
                                            <label className="text-xs font-bold text-gray-700 block mb-1">Tracking No:</label>
                                            <input type="text" className="input text-xs w-full p-2" placeholder="Courier AWB/Tracking" value={paymentData.trackingNumber} onChange={e => setPaymentData({...paymentData, trackingNumber: e.target.value})} />
                                        </div>
                                        <div className="col-span-1 mt-2">
                                            <label className="text-xs font-bold text-red-500 block mb-1">* Approx Delivery Date:</label>
                                            <input required type="date" className="input text-xs w-full p-2 h-8" value={paymentData.deliveryDate} onChange={e => setPaymentData({...paymentData, deliveryDate: e.target.value})} />
                                        </div>
                                        <div className="col-span-2 mt-2">
                                            <label className="text-xs font-bold text-gray-700 block mb-1">Purchase Order(s):</label>
                                            <input type="text" className="input text-xs w-full p-2 h-8" placeholder="PO Numbers" value={paymentData.purchaseOrders} onChange={e => setPaymentData({...paymentData, purchaseOrders: e.target.value})} />
                                        </div>
                                        <div className="col-span-1 mt-2">
                                            <label className="text-xs font-bold text-gray-700 block mb-1">Purchase Order(s) Copy:</label>
                                            <div className="flex bg-gray-50 border border-gray-200 rounded text-xs overflow-hidden h-8">
                                                <label className="bg-gray-100 flex-1 px-2 py-1 border-r border-gray-200 truncate cursor-pointer text-gray-600 flex items-center justify-center">
                                                    {poFile ? poFile.name : 'Choose File'}
                                                    <input type="file" className="hidden" onChange={e => setPoFile(e.target.files[0])} />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Additional Remarks:</label>
                                        <textarea className="textarea input text-xs w-full p-2 h-16 bg-gray-50" placeholder="Remarks" value={paymentData.remarks} onChange={e => setPaymentData({...paymentData, remarks: e.target.value})}></textarea>
                                    </div>

                                    {/* Mock Invoice Table */}
                                    <div className="border border-gray-200 rounded overflow-hidden">
                                        <div className="bg-gray-100 p-2 text-xs font-bold border-b border-gray-200">Invoices:</div>
                                        <table className="w-full text-xs text-left text-gray-700">
                                            <thead className="bg-gray-200">
                                                <tr>
                                                    <th className="p-2 font-bold border-r border-gray-300">Invoice No</th>
                                                    <th className="p-2 font-bold border-r border-gray-300">Total Payable</th>
                                                    <th className="p-2 font-bold border-r border-gray-300">TDS %</th>
                                                    <th className="p-2 font-bold border-r border-gray-300">TDS Amt</th>
                                                    <th className="p-2 font-bold border-r border-gray-300">Post-TDS</th>
                                                    <th className="p-2 font-bold border-r border-gray-300">Rounded</th>
                                                    <th className="p-2 font-bold">Diff w/ Paid</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="bg-white">
                                                    <td className="p-2 border-r border-gray-200">BPIOTST_{paymentOrder.orderId}</td>
                                                    <td className="p-2 border-r border-gray-200 py-3">₹ {paymentData.amountPaid || '0.00'}</td>
                                                    <td className="p-2 border-r border-gray-200 text-gray-500">0.00%</td>
                                                    <td className="p-2 border-r border-gray-200 text-gray-500">₹ 0.00</td>
                                                    <td className="p-2 border-r border-gray-200 text-gray-500">₹ {paymentData.amountPaid || '0.00'}</td>
                                                    <td className="p-2 border-r border-gray-200 text-gray-500">₹ {paymentData.amountPaid || '0.00'}</td>
                                                    <td className="p-2 text-gray-500">Exact</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer mt-6" style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16 }}>
                                    <button type="submit" className="px-6 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded shadow transition">
                                        Submit PDC Details
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
