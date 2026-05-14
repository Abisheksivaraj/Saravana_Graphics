import React, { useState, useEffect } from 'react';
import { vendorAPI } from '../api';
import Sidebar from '../components/Sidebar';
import { useUIStore } from '../store/uiStore';
import { IndianRupee, Package, CalendarDays } from 'lucide-react';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const { isSidebarCollapsed } = useUIStore();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAmountThisMonth: 0,
        totalOrdersThisMonth: 0,
        currentMonthName: ''
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await vendorAPI.getOrders();
                const allOrders = res.data;

                // Determine current month and year
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

                // Filter orders for the current month based on createdAt
                const currentMonthOrders = allOrders.filter(order => {
                    const orderDate = new Date(order.createdAt);
                    return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
                });

                // Calculate total amount (sum of paymentDetails.amountPaid)
                const totalAmount = currentMonthOrders.reduce((sum, order) => {
                    return sum + (order.paymentDetails?.amountPaid || 0);
                }, 0);

                setOrders(currentMonthOrders);
                setStats({
                    totalAmountThisMonth: totalAmount,
                    totalOrdersThisMonth: currentMonthOrders.length,
                    currentMonthName
                });
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const getStatusBadge = (status) => {
        const s = (status || '').toLowerCase();
        if (s.includes('delivered')) return 'ad-badge ad-badge-success';
        if (s.includes('production')) return 'ad-badge ad-badge-primary';
        if (s.includes('rejected')) return 'ad-badge ad-badge-warning';
        return 'ad-badge ad-badge-default';
    };

    return (
        <div className={`dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
            <Sidebar />
            <main className="db-main" style={{ padding: 0 }}>
                <div className="admin-dashboard">
                    <div className="admin-dashboard-header">
                        <h1>Admin Dashboard</h1>
                        <div className="ad-badge ad-badge-default" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
                            <CalendarDays size={16} style={{ marginRight: 8 }} />
                            {stats.currentMonthName}
                        </div>
                    </div>

                    <div className="ad-summary-cards">
                        <div className="ad-card">
                            <div className="ad-card-icon primary">
                                <Package size={32} />
                            </div>
                            <div className="ad-card-content">
                                <h3>Orders This Month</h3>
                                <p className="ad-card-value">{stats.totalOrdersThisMonth}</p>
                            </div>
                        </div>
                        <div className="ad-card">
                            <div className="ad-card-icon success">
                                <IndianRupee size={32} />
                            </div>
                            <div className="ad-card-content">
                                <h3>Total Amount This Month</h3>
                                <p className="ad-card-value">₹ {stats.totalAmountThisMonth.toLocaleString('en-IN')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="ad-table-container">
                        <div className="ad-table-header">
                            <h2>Monthly Order Details</h2>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="ad-table">
                                <thead>
                                    <tr>
                                        <th>Order ID</th>
                                        <th>Vendor</th>
                                        <th>Quantity</th>
                                        <th>Progress / Status</th>
                                        <th>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                                                <div className="spinner" style={{ margin: '0 auto' }}></div>
                                                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading data...</p>
                                            </td>
                                        </tr>
                                    ) : orders.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                                No orders found for {stats.currentMonthName}.
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map(order => (
                                            <tr key={order._id}>
                                                <td style={{ fontWeight: 600 }}>{order.orderId}</td>
                                                <td>{order.vendorId?.name || 'Unknown Vendor'}</td>
                                                <td>
                                                    {order.adminQuantity ? (
                                                        <span className="ad-quantity">{order.adminQuantity}</span>
                                                    ) : '-'}
                                                </td>
                                                <td>
                                                    <span className={getStatusBadge(order.status)}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className="ad-amount">
                                                    ₹ {(order.paymentDetails?.amountPaid || 0).toLocaleString('en-IN')}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
