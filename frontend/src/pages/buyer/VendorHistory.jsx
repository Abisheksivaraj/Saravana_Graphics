import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { buyerAPI } from '../../api';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, Calendar, FileText, Download, CheckCircle2, Clock } from 'lucide-react';
import '../AdminVendorPortal.css';

export default function VendorHistory() {
    const { vendorId } = useParams();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchHistory = async () => {
        try {
            const res = await buyerAPI.getVendorHistory(vendorId);
            setHistory(res.data.orders || []);
            setVendor(res.data.vendor);
        } catch (err) {
            toast.error('Failed to load vendor history');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [vendorId]);

    const getStatusClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered': return 'badge-delivered';
            case 'production': return 'badge-production';
            case 'approved': return 'badge-approved';
            case 'rejected': return 'badge-rejected';
            default: return 'badge-default';
        }
    };

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="ap-main">
                <header className="ap-header">
                    <div className="flex items-center gap-4">
                        <button className="ap-refresh-btn" onClick={() => navigate('/buyer/dashboard')}>
                            <ArrowLeft size={20} />
                        </button>
                        <div className="ap-header-title">
                            <h1>{vendor?.vendorName || 'Vendor'} History</h1>
                            <p>{vendor?.vendorCode} • Detailed order and activity logs</p>
                        </div>
                    </div>
                </header>

                <div className="ap-table-container">
                    <table className="ap-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Order Date</th>
                                <th>Items / Description</th>
                                <th>Status</th>
                                <th>Commit Date</th>
                                <th>Documents</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="ap-loading-cell">Loading history...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan="6" className="ap-empty-cell">No order history found for this vendor.</td></tr>
                            ) : (
                                history.map(order => (
                                    <tr key={order._id} className="ap-row">
                                        <td className="ap-td-id">#{order.orderNumber || order._id.slice(-6).toUpperCase()}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400" />
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="font-semibold">{order.itemName || 'Bulk Label Order'}</div>
                                            <div className="text-xs text-slate-400">{order.quantity || 0} units</div>
                                        </td>
                                        <td>
                                            <span className={`ap-status-badge ${getStatusClass(order.status)}`}>
                                                {order.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td>
                                            {order.commitDate ? (
                                                <div className="flex items-center gap-2 text-emerald-600 font-bold">
                                                    <Clock size={14} />
                                                    {new Date(order.commitDate).toLocaleDateString()}
                                                </div>
                                            ) : '--'}
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                {order.artworkUrl && (
                                                    <a href={order.artworkUrl} target="_blank" rel="noreferrer" className="ap-icon-btn chat" title="Download Artwork">
                                                        <FileText size={14} />
                                                    </a>
                                                )}
                                                {order.invoiceUrl && (
                                                    <a href={order.invoiceUrl} target="_blank" rel="noreferrer" className="ap-icon-btn manage" title="Download Invoice">
                                                        <Download size={14} />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
