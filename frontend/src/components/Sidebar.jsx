import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Cpu, Grid, LayoutTemplate, Layers, LogOut, ChevronLeft, Menu, Users, Upload
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import './Sidebar.css';

const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuthStore();
    const { isSidebarCollapsed, setSidebarCollapsed, toggleSidebar } = useUIStore();

    React.useEffect(() => {
        // Automatically collapse sidebar on every navigation
        setSidebarCollapsed(true);
    }, [location.pathname]);

    const navItems = [
        { path: '/dashboard', icon: Grid, label: 'My Designs' },
        { path: '/templates', icon: LayoutTemplate, label: 'Templates' },
        { path: '/rfid-format', icon: Cpu, label: 'RFID Format' },
        { path: '/layout', icon: Layers, label: 'Layout' },
    ];

    if (user?.role === 'admin') {
        navItems.push({ path: '/admin/vendors', icon: Users, label: 'Manage Vendors' });
        navItems.push({ path: '/admin/vendor-portal', icon: Upload, label: 'Vendor Orders' });
    }

    const handleNavigation = (path) => {
        setSidebarCollapsed(true);
        navigate(path);
    };

    return (
        <aside className={`db-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
            <div className="db-sidebar-header">
                <div className="db-logo">
                    <div className="db-logo-icon"><Layers size={20} color="white" /></div>
                    {!isSidebarCollapsed && <span>Saravana<b>Graphics</b></span>}
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
                        >
                            <Icon size={16} />
                            {!isSidebarCollapsed && item.label}
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
