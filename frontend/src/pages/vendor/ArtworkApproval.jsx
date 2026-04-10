import React, { useEffect, useState } from 'react';
import { vendorAPI, BASE_URL } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Button, TextField, Card, CardContent,
    CardActions, Divider, CircularProgress, Chip, Stack, Alert
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import TaskAltIcon from '@mui/icons-material/TaskAlt';

export default function ArtworkApproval() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reviewOrder, setReviewOrder] = useState(null);
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await vendorAPI.getOrders();
            setOrders(res.data.filter(o => o.status === 'Layout Uploaded'));
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleReviewSubmit = async (status) => {
        if (!reviewOrder) return;
        setSubmitting(true);
        try {
            await vendorAPI.updateStatus(reviewOrder._id, { status, remarks: reviewRemarks });
            toast.success(`Layout ${status === 'Artwork Approved' ? 'approved' : 'rejected'}`);
            setReviewOrder(null);
            setReviewRemarks('');
            fetchData();
        } catch (err) {
            toast.error('Failed to update review status');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>Artwork Approval</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
                Review and approve layout designs from the Admin.
            </Typography>

            {orders.length === 0 ? (
                <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <TaskAltIcon sx={{ fontSize: 56, color: '#22c55e', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>All Caught Up!</Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        There are currently no artworks awaiting your approval.
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={3}>
                    {orders.map(order => (
                        <Card key={order._id} elevation={0} sx={{ border: '1px solid #e2e8f0', overflow: 'visible' }}>
                            <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, p: 3 }}>
                                {/* Left — Order Info */}
                                <Box sx={{ flex: '0 0 280px', bgcolor: '#f8fafc', borderRadius: 2, p: 2.5 }}>
                                    <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>Order ID</Typography>
                                    <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#7c3aed', mb: 2 }}>
                                        {order.orderId}
                                    </Typography>

                                    <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>File Name</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                                        <InsertDriveFileIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{order.fileName}</Typography>
                                    </Box>

                                    <Button
                                        variant="outlined"
                                        fullWidth
                                        startIcon={<VisibilityIcon />}
                                        onClick={() => window.open(`${BASE_URL}/${order.layoutFileUrl}`, '_blank')}
                                        sx={{
                                            borderColor: '#7c3aed', color: '#7c3aed', fontWeight: 600,
                                            '&:hover': { bgcolor: '#f5f3ff', borderColor: '#6d28d9' },
                                        }}
                                    >
                                        View Admin Layout
                                    </Button>
                                </Box>

                                {/* Right — Review Form */}
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 2 }}>
                                        Submit Your Review
                                    </Typography>
                                    <TextField
                                        multiline
                                        rows={3}
                                        fullWidth
                                        placeholder="Add your remarks or reasons for rejection..."
                                        value={(reviewOrder?._id === order._id ? reviewRemarks : '') || ''}
                                        onChange={e => { setReviewOrder(order); setReviewRemarks(e.target.value); }}
                                        onFocus={() => setReviewOrder(order)}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        size="small"
                                    />
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            disabled={submitting}
                                            startIcon={submitting ? <CircularProgress size={18} /> : <CancelOutlinedIcon />}
                                            onClick={() => { setReviewOrder(order); handleReviewSubmit('Artwork Rejected'); }}
                                            sx={{
                                                bgcolor: '#ef4444', fontWeight: 700, py: 1.2,
                                                '&:hover': { bgcolor: '#dc2626' },
                                                boxShadow: '0 2px 8px rgba(239,68,68,0.25)',
                                            }}
                                        >
                                            Reject
                                        </Button>
                                        <Button
                                            variant="contained"
                                            fullWidth
                                            disabled={submitting}
                                            startIcon={submitting ? <CircularProgress size={18} /> : <CheckCircleOutlineIcon />}
                                            onClick={() => { setReviewOrder(order); handleReviewSubmit('Artwork Approved'); }}
                                            sx={{
                                                bgcolor: '#22c55e', fontWeight: 700, py: 1.2,
                                                '&:hover': { bgcolor: '#16a34a' },
                                                boxShadow: '0 2px 8px rgba(34,197,94,0.25)',
                                            }}
                                        >
                                            Approve
                                        </Button>
                                    </Box>
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
