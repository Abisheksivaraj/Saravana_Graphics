import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { buyerAPI } from '../../api';
import Sidebar from '../../components/Sidebar';
import OrderChat from '../../components/OrderChat';
import FileHistory from '../../components/FileHistory';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Clock, MessageSquare, History } from 'lucide-react';
import './BuyerDashboard.css';

export default function VendorHistory() {
    const { vendorId } = useParams();
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeChat, setActiveChat] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);

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
            case 'completed': return 'badge-delivered';
            default: return 'badge-default';
        }
    };

    const getStageIndex = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('excel')) return 0;
        if (s.includes('layout')) return 1;
        if (s.includes('artwork approved')) return 2;
        if (s.includes('artwork rejected') || s.includes('revised')) return 1;
        if (s.includes('performa')) return 3;
        if (s.includes('payment')) return 4;
        if (s.includes('production')) return 5;
        if (s.includes('delivered') || s.includes('completed')) return 6;
        return 0;
    };

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="bd-main">
                <header className="bd-header">
                    <div className="bd-header-flex">
                        <button className="bd-back-btn" onClick={() => navigate('/buyer/dashboard')}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1>{vendor?.vendorName || 'Vendor'} History</h1>
                            <p>{vendor?.vendorCode} • Detailed order and activity logs</p>
                        </div>
                    </div>
                </header>

                <div className="bd-table-container">
                    <table className="bd-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Order Date</th>
                                <th>Items / Description</th>
                                <th>Status</th>
                                <th>Commit Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" className="ap-loading-cell">Loading history...</td></tr>
                            ) : history.length === 0 ? (
                                <tr><td colSpan="6" className="ap-empty-cell">No order history found for this vendor.</td></tr>
                            ) : (
                                history.map(order => (
                                    <React.Fragment key={order._id}>
                                        <tr>
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
                                            <div className="ap-mini-progress" style={{ marginTop: '8px' }}>
                                                {[...Array(7)].map((_, i) => (
                                                    <div 
                                                        key={i} 
                                                        className={`ap-mini-step ${i < getStageIndex(order.status) ? 'done' : ''} ${i === getStageIndex(order.status) ? 'active' : ''}`}
                                                    />
                                                ))}
                                            </div>
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
                                                <button 
                                                    className="ap-icon-btn chat" 
                                                    title="View Conversation"
                                                    onClick={() => setActiveChat(order)}
                                                >
                                                    <MessageSquare size={14} />
                                                </button>
                                                {/* Files are hidden for Buyers — show history toggle instead */}
                                                {((order.layoutHistory?.length > 0) || (order.revisedArtworkHistory?.length > 0) || (order.reviewHistory?.length > 0)) && (
                                                    <button
                                                        className="ap-icon-btn manage"
                                                        title="History"
                                                        onClick={() => setExpandedRow(expandedRow === order._id ? null : order._id)}
                                                        style={{ background: expandedRow === order._id ? '#eff6ff' : '#f8fafc', color: expandedRow === order._id ? '#3b82f6' : '#475569' }}
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                    {expandedRow === order._id && (
                                        <tr>
                                            <td colSpan="6" style={{ background: '#fafafa', padding: '8px 24px 16px', borderBottom: '1px solid #f1f5f9' }}>
                                                <FileHistory
                                                    layoutHistory={order.layoutHistory || []}
                                                    revisedArtworkHistory={order.revisedArtworkHistory || []}
                                                    reviewHistory={order.reviewHistory || []}
                                                    readOnly
                                                />
                                            </td>
                                        </tr>
                                    )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {activeChat && <OrderChat order={activeChat} onClose={() => setActiveChat(null)} />}
            </main>
        </div>
    );
}
