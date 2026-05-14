import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Cpu, Grid, LayoutTemplate, Layers, LogOut, ChevronLeft, Menu, Users, Upload, FileText,
    LayoutDashboard, UserCheck, Store
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { vendorAPI } from '../api';
import logo from '../assets/logo.png';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { isSidebarCollapsed, setSidebarCollapsed, toggleSidebar } = useUIStore();

    const [notifications, setNotifications] = React.useState({ chat: 0, orders: 0 });

    const fetchNotifications = async () => {
        if (user?.role === 'admin') {
            try {
                const res = await vendorAPI.getNotifications();
                setNotifications(res.data);
            } catch (err) {
                console.error('Failed to fetch notifications', err);
            }
        }
    };

    React.useEffect(() => {
        // Automatically collapse sidebar on every navigation
        setSidebarCollapsed(true);
    }, [location.pathname]);

    React.useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const navItems = [];

    if (user?.role === 'admin' || user?.role === 'user') {
        navItems.push({ path: '/dashboard', icon: Grid, label: 'My Designs' });
        navItems.push({ path: '/rfid-format', icon: Cpu, label: 'RFID Format' });
        navItems.push({ path: '/layout', icon: Layers, label: 'Layout' });
    }

    if (user?.role === 'admin') {
        navItems.unshift({ path: '/admin/dashboard', icon: LayoutDashboard, label: 'Admin Dashboard' }); // Add to the very top
        
        navItems.push({ path: '/admin/buyers', icon: UserCheck, label: 'Buyer Management' });
        navItems.push({ path: '/admin/vendors', icon: Store, label: 'Manage Vendors' });
        navItems.push({ 
            path: '/admin/vendor-portal', 
            icon: Upload, 
            label: 'Vendor Orders',
            badge: (notifications.orders || 0) + (notifications.chat || 0)
        });
        navItems.push({ path: '/admin/files', icon: FileText, label: 'Files' });
    }

    if (user?.role === 'buyer') {
    navItems.push({ path: '/buyer/dashboard', icon: LayoutTemplate, label: 'Vendor Overview' });
    }

    const handleNavigation = (path) => {
        setSidebarCollapsed(true);
        navigate(path);
    };

    return (
        <aside className={`db-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="db-sidebar-header">
                <div className="db-logo">
                    <img 
                        src={logo} 
                        alt="Saravana" 
                        style={{ 
                            height: 36, 
                            width: 'auto',
                            display: isSidebarCollapsed ? 'none' : 'block' 
                        }} 
                    />
                    {isSidebarCollapsed && <Layers size={20} color="white" />}
                </div>
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>
            <nav className="db-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                        <a
                            key={item.path}
                            className={`db-nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => handleNavigation(item.path)}
                            title={item.label}
                            style={{ position: 'relative' }}
                        >
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={16} />
                                {item.badge > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -6,
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        minWidth: '15px',
                                        height: '15px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 4px',
                                        border: '1.5px solid white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}>
                                        {item.badge}
                                    </span>
                                )}
                            </div>
                            {!isSidebarCollapsed && <span style={{ marginLeft: 12 }}>{item.label}</span>}
                        </a>
                    );
                })}
            </nav>
            <div className="db-sidebar-bottom">
                <div className="db-user">
                    <div className="db-avatar">{user?.name?.[0]?.toUpperCase()}</div>
                    {!isSidebarCollapsed && (
                        <div>
                            <div className="db-user-name">{user?.name}</div>
                            <div className="db-user-email">{user?.email}</div>
                        </div>
                    )}
                </div>
                <button
                    className="btn btn-ghost"
                    style={{
                        width: '100%',
                        justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                        gap: 8,
                        color: 'var(--text-muted)',
                        padding: '8px 12px'
                    }}
                    onClick={() => { logout(); navigate('/'); }}
                    title="Sign Out"
                >
                    <LogOut size={16} /> {!isSidebarCollapsed && "Sign Out"}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
