import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    Typography, Avatar, Divider, IconButton, Tooltip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BrushIcon from '@mui/icons-material/Brush';
import PaymentIcon from '@mui/icons-material/Payment';
import LogoutIcon from '@mui/icons-material/Logout';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const DRAWER_WIDTH = 260;

const vendorTheme = createTheme({
    palette: {
        primary: { main: '#7c3aed' },
        secondary: { main: '#f59e0b' },
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

const navItems = [
    { path: '/vendor-portal/dashboard', icon: <DashboardIcon />, label: 'Dashboard' },
    { path: '/vendor-portal/create', icon: <UploadFileIcon />, label: 'Create Order' },
    { path: '/vendor-portal/artwork', icon: <BrushIcon />, label: 'Artwork Approval' },
    { path: '/vendor-portal/payments', icon: <PaymentIcon />, label: 'Payment Details' },
];

export default function VendorLayout() {
    const { user, logout } = useAuthStore();
    const location = useLocation();
    const navigate = useNavigate();

    return (
        <ThemeProvider theme={vendorTheme}>
            <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
                {/* Sidebar Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        width: DRAWER_WIDTH,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: DRAWER_WIDTH,
                            boxSizing: 'border-box',
                            bgcolor: '#0f172a',
                            color: '#e2e8f0',
                            borderRight: 'none',
                        },
                    }}
                >
                    {/* Brand */}
                    <Box sx={{ px: 3, py: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#f59e0b', letterSpacing: -0.5 }}>
                            Saravana Graphicss
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, fontSize: '0.65rem' }}>
                            Vendor Portal
                        </Typography>
                    </Box>

                    <Divider sx={{ borderColor: '#1e293b', mb: 1 }} />

                    {/* Navigation */}
                    <List sx={{ px: 1.5, flex: 1 }}>
                        {navItems.map(item => {
                            const isActive = location.pathname.startsWith(item.path);
                            return (
                                <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => navigate(item.path)}
                                        sx={{
                                            borderRadius: 2,
                                            py: 1.2,
                                            bgcolor: isActive ? 'primary.main' : 'transparent',
                                            color: isActive ? '#fff' : '#94a3b8',
                                            '&:hover': {
                                                bgcolor: isActive ? 'primary.main' : '#1e293b',
                                                color: '#fff',
                                            },
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                                            {item.icon}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={
                                                <Typography sx={{ fontSize: '0.875rem', fontWeight: isActive ? 700 : 500 }}>
                                                    {item.label}
                                                </Typography>
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                            );
                        })}
                    </List>

                    <Divider sx={{ borderColor: '#1e293b' }} />

                    {/* User Profile */}
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <Avatar sx={{ width: 36, height: 36, bgcolor: '#1e293b', color: '#f59e0b', fontSize: 14, fontWeight: 700, border: '2px solid #334155' }}>
                                {user?.name?.charAt(0)?.toUpperCase() || 'V'}
                            </Avatar>
                            <Box sx={{ overflow: 'hidden' }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#e2e8f0', lineHeight: 1.2 }}>
                                    {user?.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user?.email}
                                </Typography>
                            </Box>
                        </Box>
                        <Tooltip title="Logout">
                            <IconButton
                                onClick={() => { logout(); navigate('/login'); }}
                                sx={{
                                    width: '100%', borderRadius: 2, py: 1,
                                    bgcolor: '#1e293b', color: '#94a3b8',
                                    '&:hover': { bgcolor: '#7f1d1d', color: '#fca5a5' },
                                    transition: 'all 0.2s',
                                }}
                            >
                                <LogoutIcon sx={{ fontSize: 18, mr: 1 }} />
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>Logout</Typography>
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Drawer>

                {/* Main Content */}
                <Box component="main" sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, md: 4 } }}>
                    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                        <Outlet />
                    </Box>
                </Box>
            </Box>
        </ThemeProvider>
    );
}
