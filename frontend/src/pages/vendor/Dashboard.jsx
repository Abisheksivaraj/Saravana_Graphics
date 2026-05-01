import React, { useEffect, useState } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Skeleton, Tooltip, Badge
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
import MessageIcon from '@mui/icons-material/Message';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';

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
    const [activeChat, setActiveChat] = useState(null);

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
                            {['#', 'Order ID', 'File Name', 'Brand', 'Upload Date', 'Production', 'Status', 'Actions'].map(h => (
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
                                    <TableCell>
                                        <Tooltip title="View Order Chat">
                                            <IconButton onClick={() => setActiveChat(order)} size="small" sx={{ bgcolor: '#fff7ed', color: '#f97316', '&:hover': { bgcolor: '#ffedd5' } }}>
                                                <Badge badgeContent={order.unreadCount} color="error" overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 16, minWidth: 16 } }}>
                                                    <MessageIcon fontSize="small" />
                                                </Badge>
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Vendor Chat Modal */}
            {activeChat && <VendorChat order={activeChat} onClose={() => setActiveChat(null)} />}
        </Box>
    );
}

// ─── Vendor Chat Panel ────────────────────────────────────────────────────────
function VendorChat({ order, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = React.useRef();

    const fetchMessages = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await vendorAPI.getMessages(order._id);
            setMessages(res.data);
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages(true);
        // Mark as read when vendor opens
        vendorAPI.markAsRead(order._id);
        
        const interval = setInterval(() => fetchMessages(), 5000);
        return () => clearInterval(interval);
    }, [order._id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            const res = await vendorAPI.sendMessage(order._id, input);
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) {
            toast.error('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const formatDate = (d) => new Date(d).toLocaleDateString([], { day: '2-digit', month: 'short' });

    return (
        <Box sx={{
            position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, p: 3
        }} onClick={onClose}>
            <Paper elevation={24} sx={{
                width: 400, height: 600, borderRadius: 4, display: 'flex', flexDirection: 'column',
                overflow: 'hidden', animation: 'chatSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes chatSlideUp': { from: { transform: 'translateY(40px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } }
            }} onClick={e => e.stopPropagation()}>
                
                <Box sx={{ p: 2, bgcolor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ display: 'flex' }}>
                            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a', zIndex: 2 }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>V</Typography>
                            </Box>
                            <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0f172a', ml: '-8px', zIndex: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>A</Typography>
                            </Box>
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Order Chat</Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>#{order.orderId}</Typography>
                        </Box>
                    </Box>
                    <IconButton size="small" onClick={onClose} sx={{ color: '#94a3b8', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Box ref={scrollRef} sx={{ flex: 1, p: 2, bgcolor: '#f8fafc', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ fontSize: 12, textAlign: 'center', color: '#64748b', bgcolor: '#f1f5f9', p: 1, borderRadius: 2, mb: 1 }}>
                        Private channel with <strong>Admin</strong>.
                    </Box>

                    {loading ? (
                        <Box sx={{ textAlign: 'center', p: 4, color: '#94a3b8' }}>Loading conversation...</Box>
                    ) : messages.length === 0 ? (
                        <Box sx={{ textAlign: 'center', p: 4, color: '#94a3b8', fontStyle: 'italic' }}>No messages yet.</Box>
                    ) : (() => {
                        let lastDate = '';
                        return messages.map(msg => {
                            const msgDate = formatDate(msg.createdAt);
                            const showDate = msgDate !== lastDate;
                            lastDate = msgDate;
                            const isMe = msg.role === 'vendor';

                            return (
                                <React.Fragment key={msg._id}>
                                    {showDate && <Box sx={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', py: 0.5 }}>{msgDate}</Box>}
                                    <Box sx={{ display: 'flex', width: '100%', mb: 0.5, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                        <Box sx={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                                                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', fontSize: 11 }}>{isMe ? 'You' : 'Admin'}</Typography>
                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 10 }}>{formatTime(msg.createdAt)}</Typography>
                                            </Box>
                                            <Box sx={{
                                                p: 1.5, fontSize: 13, lineHeight: 1.4, borderRadius: 3,
                                                bgcolor: isMe ? '#f97316' : 'white',
                                                color: isMe ? 'white' : '#0f172a',
                                                border: isMe ? 'none' : '1px solid #e2e8f0',
                                                borderBottomRightRadius: isMe ? 4 : 12,
                                                borderBottomLeftRadius: isMe ? 12 : 4,
                                                position: 'relative'
                                            }}>
                                                {msg.text}
                                                {isMe && msg.isRead && (
                                                    <Typography variant="caption" sx={{ 
                                                        position: 'absolute', bottom: -18, right: 0, 
                                                        fontSize: 9, fontWeight: 700, color: '#10b981',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        ✓ Read
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                </React.Fragment>
                            );
                        });
                    })()}
                </Box>

                <Box sx={{ p: 1.5, bgcolor: 'white', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <input
                        type="text"
                        placeholder="Type a reply..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        disabled={sending}
                        style={{ flex: 1, border: 'none', outline: 'none', background: '#f1f5f9', padding: '10px 14px', borderRadius: 20, fontSize: 13 }}
                    />
                    <IconButton onClick={handleSend} disabled={!input.trim() || sending} sx={{ bgcolor: '#f97316', color: 'white', width: 36, height: 36, '&:hover': { bgcolor: '#ea580c' }, '&.Mui-disabled': { bgcolor: '#fdba74', color: 'white' } }}>
                        <SendIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
            </Paper>
        </Box>
    );
}
