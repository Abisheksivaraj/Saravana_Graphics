import React, { useState, useEffect } from 'react';
import { buyerAPI } from '../../api';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Building2, ChevronRight, History, Package, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './BuyerDashboard.css';

export default function DashboardBuyer() {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchVendors = async () => {
        try {
            const res = await buyerAPI.getVendors();
            setVendors(res.data);
        } catch (err) {
            toast.error('Failed to load your assigned vendors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVendors();
    }, []);

    return (
        <div className="admin-portal-layout">
            <Sidebar />
            <main className="bd-main">
                <header className="bd-header">
                    <h1>Vendor Overview</h1>
                    <p>Track progress and history of your assigned vendors</p>
                </header>

                <div className="bd-stats">
                    <div className="bd-stat-card">
                        <div className="bd-stat-value">{vendors.length}</div>
                        <div className="bd-stat-label">Total Vendors</div>
                    </div>
                    <div className="bd-stat-card">
                        <div className="bd-stat-value">--</div>
                        <div className="bd-stat-label">Active Orders</div>
                    </div>
                </div>

                <div className="bd-grid">
                    {loading ? (
                        <div className="col-span-full text-center p-20 text-slate-400">Loading your vendors...</div>
                    ) : vendors.length === 0 ? (
                        <div className="bd-empty">
                            <div className="bd-empty-icon"><Package size={64} className="mx-auto" /></div>
                            <h3>No Vendors Assigned</h3>
                            <p>Please contact Saravana Graphics Admin to assign vendors to your account.</p>
                        </div>
                    ) : (
                        vendors.map(v => (
                            <div key={v._id} className="bd-vendor-card">
                                <div className="bd-vendor-header">
                                    <div className="bd-vendor-icon">
                                        <Building2 size={28} />
                                    </div>
                                    <span className="bd-vendor-status">Active</span>
                                </div>
                                
                                <h3 className="bd-vendor-name">{v.vendorName || v.name}</h3>
                                <span className="bd-vendor-code">{v.vendorCode || 'NO-CODE'}</span>
                                
                                <div className="bd-vendor-details">
                                    <div className="bd-detail-item">
                                        <Clock size={18} />
                                        <span>Last Activity: {v.lastActivity ? new Date(v.lastActivity).toLocaleDateString() : 'No history yet'}</span>
                                    </div>
                                    <div className="bd-detail-item">
                                        <CheckCircle2 size={18} />
                                        <span>Completed Orders: {v.completedCount || 0}</span>
                                    </div>
                                </div>

                                <button 
                                    className="bd-action-btn"
                                    onClick={() => navigate(`/buyer/vendor-history/${v._id}`)}
                                >
                                    <History size={18} />
                                    View Full History
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
