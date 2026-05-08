import React, { useEffect, useState, useRef } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Grid, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, IconButton, Skeleton, Tooltip, Badge,
    Pagination, CircularProgress, Divider, Button
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import MessageIcon from '@mui/icons-material/Message';
import HistoryIcon from '@mui/icons-material/History';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import FileHistory from '../../components/FileHistory';
import OrderTrackingModal from '../../components/OrderTrackingModal';

// --- CONFIG ---
const STATS_MAP = [
    { key: 'Queued', label: 'Queued', color: '#f59e0b' },
    { key: 'Artwork Rejected', label: 'Reject', color: '#ef4444' },
    { key: 'Layout Uploaded', label: 'Verification', color: '#3b82f6' },
    { key: 'Artwork Approved', label: 'Artwork Approval', color: '#8b5cf6' },
    { key: 'Production', label: 'Production', color: '#06b6d4' },
    { key: 'Despatch', label: 'Despatch', color: '#10b981' },
    { key: 'Performa Invoice Approved', label: 'APPROVED', color: '#22c55e' },
    { key: 'TotalFile', label: 'TotalFile', color: '#64748b' }
];

export default function Dashboard() {
    const [stats, setStats] = useState({});
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeChat, setActiveChat] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [trackingOrder, setTrackingOrder] = useState(null);

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

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this order?')) return;
        try {
            await vendorAPI.deleteOrder(id);
            toast.success('Order deleted successfully');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete order');
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-GB'); // dd/mm/yyyy
    };

    // --- Doughnut Chart Logic ---
    const totalCount = stats.TotalFile || 0;
    const completedCount = stats['Performa Invoice Approved'] || 0;
    const percentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    return (
        <Box sx={{ p: 1 }}>
            {/* Horizontal Stats Bar */}
            <Paper elevation={0} sx={{ 
                p: 2, mb: 4, borderRadius: '16px', border: '1px solid #f1f5f9',
                display: 'flex', alignItems: 'center', bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}>
                {/* Circular Chart */}
                <Box sx={{ position: 'relative', width: 60, height: 60, mr: 4, ml: 2, flexShrink: 0 }}>
                    <svg width="60" height="60" viewBox="0 0 60 60">
                        <circle cx="30" cy="30" r="25" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                        <circle cx="30" cy="30" r="25" fill="none" stroke="#22c55e" strokeWidth="8" 
                            strokeDasharray={`${(percentage * 157) / 100} 157`}
                            strokeDashoffset="0"
                            transform="rotate(-90 30 30)"
                        />
                        <circle cx="30" cy="30" r="25" fill="none" stroke="#ef4444" strokeWidth="8" 
                            strokeDasharray={`${(10 * 157) / 100} 157`} 
                            strokeDashoffset={-120} // Just for visual flair like the image
                            transform="rotate(-90 30 30)"
                        />
                    </svg>
                </Box>

                {/* Stats Items */}
                <Box sx={{ display: 'flex', flex: 1, justifyContent: 'space-around', alignItems: 'center' }}>
                    {STATS_MAP.map((item, idx) => (
                        <React.Fragment key={item.key}>
                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: item.color, mb: 0.5 }}>
                                    {stats[item.key] || 0}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                    {item.label}
                                </Typography>
                            </Box>
                            {idx < STATS_MAP.length - 1 && (
                                <Divider orientation="vertical" flexItem sx={{ mx: 1, borderColor: '#f1f5f9' }} />
                            )}
                        </React.Fragment>
                    ))}
                </Box>
            </Paper>

            {/* Table */}
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f97316' }}>
                            {['SrNo', 'Vendor Code', 'FileName', 'Brand', 'Uploaded_By', 'Upload_On', 'Status', 'Remarks', 'Actions'].map(h => (
                                <TableCell key={h} sx={{ color: '#fff', fontWeight: 800, fontSize: '0.8rem', py: 2 }}>{h}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={9}><Skeleton height={40} /></TableCell></TableRow>
                            ))
                        ) : orders.length === 0 ? (
                            <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}>No orders found</TableCell></TableRow>
                        ) : orders.map((o, i) => (
                            <React.Fragment key={o._id}>
                                <TableRow hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                    <TableCell sx={{ color: '#64748b', fontSize: '0.85rem' }}>{i + 1}</TableCell>
                                    <TableCell 
                                        onClick={() => setTrackingOrder(o)}
                                        sx={{ 
                                            fontFamily: 'monospace', color: '#475569', fontSize: '0.85rem', cursor: 'pointer', 
                                            '&:hover': { color: '#f97316', textDecoration: 'underline' } 
                                        }}
                                    >
                                        {o.vendorCode || o.barcodeFileId || o.orderId}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{o.fileName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>{o.brand || 'General'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{o.uploadedBy?.name || 'Vipin'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', color: '#64748b' }}>{formatDate(o.createdAt)}</TableCell>
                                    <TableCell>
                                        <Box sx={{ 
                                            display: 'inline-block', px: 2, py: 0.5, borderRadius: '20px', 
                                            bgcolor: o.status === 'Despatch' ? '#22c55e' : '#f1f5f9',
                                            color: o.status === 'Despatch' ? '#fff' : '#64748b',
                                            fontSize: '0.75rem', fontWeight: 800
                                        }}>
                                            {o.status}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem', color: '#94a3b8' }}>{o.remarks || '-'}</TableCell>
                                    <TableCell sx={{ display: 'flex', gap: 1 }}>
                                        <IconButton onClick={() => setActiveChat(o)} size="small" sx={{ color: '#f97316' }}>
                                            <Badge badgeContent={o.unreadCount} color="error"><MessageIcon fontSize="small" /></Badge>
                                        </IconButton>
                                        {((o.layoutHistory?.length > 0) || (o.revisedArtworkHistory?.length > 0)) && (
                                            <IconButton onClick={() => setExpandedRow(expandedRow === o._id ? null : o._id)} size="small">
                                                <HistoryIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                        <IconButton onClick={() => handleDelete(o._id)} size="small" sx={{ color: '#ef4444' }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                                {expandedRow === o._id && (
                                    <TableRow>
                                        <TableCell colSpan={9} sx={{ p: 2, bgcolor: '#fafafa' }}>
                                            <FileHistory
                                                layoutHistory={o.layoutHistory || []}
                                                revisedArtworkHistory={o.revisedArtworkHistory || []}
                                                reviewHistory={o.reviewHistory || []}
                                                readOnly
                                            />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9' }}>
                    <Pagination count={Math.ceil(orders.length / 10)} size="small" />
                </Box>
            </TableContainer>

            {/* Tracking Modal */}
            {trackingOrder && <OrderTrackingModal order={trackingOrder} onClose={() => setTrackingOrder(null)} />}
            
            {/* Chat Modal (Existing logic) */}
            {activeChat && <VendorChat order={activeChat} onClose={() => setActiveChat(null)} />}
        </Box>
    );
}

// --- Reuse VendorChat from previous implementation ---
function VendorChat({ order, onClose }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = useRef();

    const fetchMessages = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const res = await vendorAPI.getMessages(order._id);
            setMessages(res.data);
        } catch (err) { console.error(err); } finally { if (showLoading) setLoading(false); }
    };

    useEffect(() => {
        fetchMessages(true);
        vendorAPI.markAsRead(order._id);
        const interval = setInterval(() => fetchMessages(), 5000);
        return () => clearInterval(interval);
    }, [order._id]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            const res = await vendorAPI.sendMessage(order._id, input);
            setMessages(prev => [...prev, res.data]);
            setInput('');
        } catch (err) { toast.error('Failed to send'); } finally { setSending(false); }
    };

    return (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }} onClick={onClose}>
            <Paper sx={{ width: 400, height: 500, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <Box sx={{ p: 2, bgcolor: '#0f172a', color: 'white' }}>Chat #{order.orderId}</Box>
                <Box ref={scrollRef} sx={{ flex: 1, p: 2, overflowY: 'auto', bgcolor: '#f8fafc' }}>
                    {messages.map(m => (
                        <Box key={m._id} sx={{ mb: 1.5, textAlign: m.role === 'vendor' ? 'right' : 'left' }}>
                            <Box sx={{ display: 'inline-block', p: 1, px: 2, borderRadius: 2, bgcolor: m.role === 'vendor' ? '#f97316' : '#fff', color: m.role === 'vendor' ? '#fff' : '#000', border: '1px solid #e2e8f0' }}>
                                {m.text}
                            </Box>
                        </Box>
                    ))}
                </Box>
                <Box sx={{ p: 1, display: 'flex', gap: 1 }}>
                    <input style={{ flex: 1, padding: 8 }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
                    <button onClick={handleSend} disabled={sending}>Send</button>
                </Box>
            </Paper>
        </Box>
    );
}
