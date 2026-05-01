import React, { useState, useEffect } from 'react';
import { buyerAPI } from '../../api';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Building2, ChevronRight, History, Package, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../AdminVendorPortal.css';

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
            <main className="ap-main">
                <header className="ap-header">
                    <div className="ap-header-title">
                        <h1>Vendor Overview</h1>
                        <p>Track progress and history of your assigned vendors</p>
                    </div>
                </header>

                <div className="ap-stats-strip">
                    <div className="ap-stat-card">
                        <div className="ap-stat-value text-primary">{vendors.length}</div>
                        <div className="ap-stat-label">Total Vendors</div>
                    </div>
                    {/* These would ideally come from a separate stats endpoint */}
                    <div className="ap-stat-card">
                        <div className="ap-stat-value text-blue-600">--</div>
                        <div className="ap-stat-label">Active Orders</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center p-20 text-slate-400">Loading your vendors...</div>
                    ) : vendors.length === 0 ? (
                        <div className="col-span-full text-center p-20 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="text-slate-300 mb-4"><Package size={48} className="mx-auto" /></div>
                            <h3 className="text-lg font-bold text-slate-800">No Vendors Assigned</h3>
                            <p className="text-slate-500 text-sm">Please contact Saravana Graphics Admin to assign vendors to your account.</p>
                        </div>
                    ) : (
                        vendors.map(v => (
                            <div key={v._id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-6 group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                        <Building2 size={24} />
                                    </div>
                                    <span className="ap-status-badge badge-approved">Active</span>
                                </div>
                                
                                <h3 className="text-xl font-extrabold text-slate-900 mb-1">{v.vendorName || v.name}</h3>
                                <p className="text-xs font-mono text-slate-400 mb-4 uppercase tracking-wider">{v.vendorCode || 'NO-CODE'}</p>
                                
                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <Clock size={16} className="text-slate-400" />
                                        <span>Last Activity: {v.lastActivity ? new Date(v.lastActivity).toLocaleDateString() : 'No history yet'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <CheckCircle2 size={16} className="text-slate-400" />
                                        <span>Completed Orders: {v.completedCount || 0}</span>
                                    </div>
                                </div>

                                <button 
                                    className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-primary hover:text-white text-slate-700 font-bold py-3 rounded-xl transition-all"
                                    onClick={() => navigate(`/buyer/vendor-history/${v._id}`)}
                                >
                                    <History size={18} />
                                    View Full History
                                    <ChevronRight size={16} className="ml-auto" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
