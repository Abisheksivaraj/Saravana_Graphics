import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { vendorAPI } from '../../api';
import {
    Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Typography, Avatar, Divider, IconButton, Tooltip, Badge, AppBar, Toolbar
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BrushIcon from '@mui/icons-material/Brush';
import PaymentIcon from '@mui/icons-material/Payment';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const DRAWER_WIDTH = 260;
const COLLAPSED_WIDTH = 80;

const vendorTheme = createTheme({
    palette: {
        primary: { main: '#f97316' }, // Orange
        secondary: { main: '#eab308' }, // Yellow
        background: { default: '#f8fafc', paper: '#ffffff' },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { borderRadius: 12 },
            },
        },
    },
});

export default function VendorLayout() {
    const { user, logout } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const fetchUnreadCount = async () => {
        try {
            const res = await vendorAPI.getOrders();
            const total = res.data.reduce((sum, order) => sum + (order.unreadCount || 0), 0);
            setUnreadTotal(total);
        } catch (err) {
            console.error('Failed to fetch unread count', err);
        }
    };

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 10000);
        return () => clearInterval(interval);
    }, []);

    const navItems = [
        { path: '/vendor-portal/dashboard', icon: <DashboardIcon />, label: 'Dashboard', showBadge: true },
        { path: '/vendor-portal/create', icon: <UploadFileIcon />, label: 'Create Order' },
        { path: '/vendor-portal/artwork', icon: <BrushIcon />, label: 'Artwork Approval' },
        { path: '/vendor-portal/payments', icon: <PaymentIcon />, label: 'Payment Details' },
    ];

    return (
        <ThemeProvider theme={vendorTheme}>
            <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
                {/* Sidebar Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        width: isSidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH,
                        flexShrink: 0,
                        transition: 'width 0.3s ease',
                        '& .MuiDrawer-paper': {
                            width: isSidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH,
                            transition: 'width 0.3s ease',
                            boxSizing: 'border-box',
                            bgcolor: '#ffffff',
                            color: '#1e293b',
                            borderRight: '1px solid #e2e8f0',
                            overflowX: 'hidden'
                        },
                    }}
                >
                    {/* Brand Logo & Toggle */}
                    <Box sx={{
                        px: isSidebarOpen ? 2 : 0,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSidebarOpen ? 'space-between' : 'center',
                        flexDirection: isSidebarOpen ? 'row' : 'column'
                    }}>
                        {isSidebarOpen && (
                            <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => navigate('/vendor-portal/dashboard')}>
                                <img src="/logo.png" alt="Saravana Graphics" style={{ height: 40, objectFit: 'contain' }} />
                            </Box>
                        )}
                        <IconButton
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            sx={{ color: '#64748b', mt: isSidebarOpen ? 0 : 1, bgcolor: isSidebarOpen ? 'transparent' : '#f1f5f9' }}
                        >
                            {isSidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
                        </IconButton>
                    </Box>

                    <Divider sx={{ borderColor: '#f1f5f9', mb: 1 }} />

                    {/* Navigation */}
                    <List sx={{ px: isSidebarOpen ? 1.5 : 1, flex: 1 }}>
                        {navItems.map(item => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <ListItem key={item.path} disablePadding sx={{ mb: 0.5, display: 'block' }}>
                                    <Tooltip title={!isSidebarOpen ? item.label : ''} placement="right">
                                        <ListItemButton
                                            onClick={() => navigate(item.path)}
                                            sx={{
                                                minHeight: 48,
                                                justifyContent: isSidebarOpen ? 'initial' : 'center',
                                                px: 2.5,
                                                borderRadius: 2,
                                                bgcolor: isActive ? '#fff7ed' : 'transparent',
                                                color: isActive ? 'primary.main' : '#64748b',
                                                '&:hover': {
                                                    bgcolor: isActive ? '#fff7ed' : '#f8fafc',
                                                    color: isActive ? 'primary.main' : '#0f172a',
                                                },
                                                transition: 'all 0.2s',
                                                borderLeft: isActive ? '3px solid #f97316' : '3px solid transparent'
                                            }}
                                        >
                                            <ListItemIcon sx={{
                                                minWidth: 0,
                                                mr: isSidebarOpen ? 2 : 'auto',
                                                justifyContent: 'center',
                                                color: 'inherit'
                                            }}>
                                                {item.showBadge ? (
                                                    <Badge badgeContent={unreadTotal} color="error" sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                                                        {item.icon}
                                                    </Badge>
                                                ) : item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography sx={{ fontSize: '0.875rem', fontWeight: isActive ? 700 : 500 }}>
                                                        {item.label}
                                                    </Typography>
                                                }
                                                sx={{ opacity: isSidebarOpen ? 1 : 0, display: isSidebarOpen ? 'block' : 'none' }}
                                            />
                                        </ListItemButton>
                                    </Tooltip>
                                </ListItem>
                            );
                        })}
                    </List>
                </Drawer>

                {/* Right Area (Navbar + Main Content) */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Top Navbar for Profile & Logout */}
                    <AppBar position="static" elevation={0} sx={{ bgcolor: '#ffffff', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>
                        <Toolbar sx={{ justifyContent: 'flex-end', px: { xs: 2, md: 4 }, minHeight: '64px !important' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Avatar sx={{ width: 36, height: 36, bgcolor: '#f1f5f9', color: '#f97316', fontSize: 14, fontWeight: 700, border: '2px solid #fdba74' }}>
                                        {user?.name?.charAt(0)?.toUpperCase() || 'V'}
                                    </Avatar>
                                    <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>
                                            {user?.name || 'Vendor User'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                                            Vendor
                                        </Typography>
                                    </Box>
                                </Box>

                                <Divider orientation="vertical" variant="middle" flexItem sx={{ mx: 1, borderColor: '#e2e8f0' }} />

                                <Tooltip title="Logout">
                                    <IconButton
                                        onClick={() => { logout(); navigate('/login'); }}
                                        sx={{
                                            color: '#e11d48',
                                            bgcolor: '#fff1f2',
                                            '&:hover': { bgcolor: '#ffe4e6', color: '#be123c' },
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <LogoutIcon sx={{ fontSize: 20 }} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Toolbar>
                    </AppBar>

                    {/* Main Content */}
                    <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 }, bgcolor: '#f8fafc' }}>
                        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                            <Outlet />
                        </Box>
                    </Box>
                </Box>
            </Box>
        </ThemeProvider>
    );
}
