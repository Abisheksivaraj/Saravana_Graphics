import React, { useEffect, useState } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Skeleton, Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FolderIcon from '@mui/icons-material/Folder';

const STATS_CONFIG = [
    { key: 'Queued', label: 'Queued', icon: <AccessTimeIcon />, color: '#f59e0b', bg: '#fef3c7' },
    { key: 'Layout Uploaded', label: 'Layout Ready', icon: <ImageSearchIcon />, color: '#3b82f6', bg: '#dbeafe' },
    { key: 'Artwork Rejected', label: 'Rejected', icon: <CancelIcon />, color: '#ef4444', bg: '#fee2e2' },
    { key: 'Artwork Approved', label: 'Approved', icon: <CheckCircleOutlineIcon />, color: '#8b5cf6', bg: '#ede9fe' },
    { key: 'Production', label: 'Production', icon: <PrecisionManufacturingIcon />, color: '#06b6d4', bg: '#cffafe' },
    { key: 'Despatch', label: 'Despatch', icon: <LocalShippingIcon />, color: '#10b981', bg: '#d1fae5' },
    { key: 'Payment Follow-up', label: 'Payment', icon: <AccountBalanceWalletIcon />, color: '#22c55e', bg: '#dcfce7' },
    { key: 'TotalFile', label: 'Total', icon: <FolderIcon />, color: '#64748b', bg: '#f1f5f9' }
];

const statusColor = (status) => {
    const map = {
        'Queued': 'warning', 'Excel Uploaded': 'warning', 'Layout Uploaded': 'info',
        'Artwork Rejected': 'error', 'Artwork Approved': 'secondary',
        'Production': 'primary', 'Despatch': 'success', 'Payment Follow-up': 'success'
    };
    return map[status] || 'default';
};

export default function Dashboard() {
    const [stats, setStats] = useState({});
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
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

    useEffect(() => { fetchData(); }, []);

    const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>Dashboard</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>Overview of your order activity</Typography>
                </Box>
                <Tooltip title="Refresh">
                    <IconButton onClick={fetchData} sx={{ bgcolor: '#f1f5f9', '&:hover': { bgcolor: '#e2e8f0' } }}>
                        <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Stats Cards */}
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {STATS_CONFIG.map(config => (
                    <Grid size={{ xs: 6, sm: 3, md: 1.5 }} key={config.key}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 2, textAlign: 'center', border: '1px solid #f1f5f9',
                                transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' },
                            }}
                        >
                            <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1, color: config.color }}>
                                {React.cloneElement(config.icon, { sx: { fontSize: 20 } })}
                            </Box>
                            {loading ? (
                                <Skeleton width={30} sx={{ mx: 'auto' }} />
                            ) : (
                                <Typography variant="h5" sx={{ fontWeight: 800, color: config.color, lineHeight: 1 }}>
                                    {stats[config.key] || 0}
                                </Typography>
                            )}
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {config.label}
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Orders Table */}
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#0f172a' }}>Recent Orders</Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#7c3aed' }}>
                            {['#', 'Order ID', 'File Name', 'Brand', 'Upload Date', 'Production', 'Status'].map(h => (
                                <TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>
                                    {h}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <TableRow key={i}>
                                    {Array.from({ length: 7 }).map((_, j) => (
                                        <TableCell key={j}><Skeleton /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : orders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                                    No orders found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            orders.slice(0, 15).map((order, i) => (
                                <TableRow key={order._id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                    <TableCell sx={{ fontWeight: 600, color: '#64748b' }}>{i + 1}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.8rem' }}>{order.orderId}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{order.fileName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', color: '#475569' }}>{order.brand}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem', color: '#64748b' }}>{formatDate(order.createdAt)}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8rem' }}>
                                        {order.productionDate ? (
                                            <Typography variant="caption" sx={{ fontWeight: 600, color: new Date() > new Date(order.productionDate) ? '#ef4444' : '#10b981' }}>
                                                {formatDate(order.productionDate)}
                                            </Typography>
                                        ) : <Typography variant="caption" sx={{ color: '#cbd5e1' }}>—</Typography>}
                                    </TableCell>
                                    <TableCell>
                                        <Chip label={order.status} color={statusColor(order.status)} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
