import React, { useEffect, useState } from 'react';
import { vendorAPI, BASE_URL } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Button, TextField, Grid, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
    Divider, IconButton, Tooltip, Fade, Zoom
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import VerifiedIcon from '@mui/icons-material/Verified';
import OrderTrackingModal from '../../components/OrderTrackingModal';

const statusColor = (status) => {
    const map = {
        'Despatch': { bg: '#dcfce7', text: '#15803d' },
        'Payment Follow-up': { bg: '#fef9c3', text: '#a16207' },
        'Performa Invoice Uploaded': { bg: '#fff7ed', text: '#c2410c' },
        'Performa Invoice Approved': { bg: '#ecfdf5', text: '#059669' }
    };
    return map[status] || { bg: '#f1f5f9', text: '#475569' };
};

export default function Payments() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [trackingOrder, setTrackingOrder] = useState(null);
    const [paymentData, setPaymentData] = useState({
        amountPaid: '',
        chequeNumber: '',
        chequeDate: '',
        remarks: ''
    });
    const [chequeFile, setChequeFile] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await vendorAPI.getOrders();
            setOrders(res.data.filter(o =>
                o.status === 'Performa Invoice Uploaded' ||
                o.status === 'Performa Invoice Approved' ||
                o.status === 'Despatch' ||
                o.status === 'Payment Follow-up'
            ));
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const [reviewingInvoice, setReviewingInvoice] = useState(null);

    const handleApproveInvoice = async (id) => {
        try {
            await vendorAPI.approvePerforma(id);
            toast.success('Invoice Approved Successfully');
            setReviewingInvoice(null);
            fetchData();
            const updatedOrder = orders.find(o => o._id === id);
            if (updatedOrder) setPaymentOrder({ ...updatedOrder, status: 'Performa Invoice Approved' });
        } catch (err) {
            toast.error('Approval failed');
        }
    };

    const handleRejectInvoice = async (id) => {
        const remarks = window.prompt('Reason for rejection:');
        if (!remarks) return;
        try {
            await vendorAPI.rejectPerforma(id, { remarks });
            toast.success('Invoice Rejected');
            setReviewingInvoice(null);
            fetchData();
        } catch (err) {
            toast.error('Rejection failed');
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!chequeFile) return toast.error('Upload cheque image');
        setSubmitting(true);
        const formData = new FormData();
        Object.keys(paymentData).forEach(key => {
            if (paymentData[key]) formData.append(key, paymentData[key]);
        });
        formData.append('chequeScanImage', chequeFile);
        formData.append('paymentMode', 'PDC');

        try {
            await vendorAPI.submitPayment(paymentOrder._id, formData);
            toast.success('Payment Details Submitted');
            setPaymentOrder(null);
            setChequeFile(null);
            fetchData();
        } catch (err) {
            toast.error('Submission failed');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (field, value) => setPaymentData(prev => ({ ...prev, [field]: value }));

    const CustomTextField = (props) => (
        <TextField
            {...props}
            size="small"
            fullWidth
            sx={{
                '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    '& fieldset': { borderColor: '#e2e8f0' },
                    '&:hover fieldset': { borderColor: '#f97316' },
                    '&.Mui-focused fieldset': { borderColor: '#f97316', borderWidth: '2px' },
                },
                '& .MuiInputLabel-root': { color: '#64748b' },
                '& .Mui-focused .MuiInputLabel-root': { color: '#f97316' },
                ...props.sx
            }}
        />
    );

    if (loading) return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 20, gap: 2 }}>
            <CircularProgress sx={{ color: '#f97316' }} />
            <Typography sx={{ color: '#64748b', fontWeight: 600 }}>Loading Invoices...</Typography>
        </Box>
    );

    return (
        <Box sx={{ minHeight: '80vh', px: { xs: 2, md: 4 }, py: 4 }}>
            {/* Header Section */}
            <Box sx={{ mb: 6, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ p: 1.5, bgcolor: '#fff7ed', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ReceiptLongIcon sx={{ color: '#f97316', fontSize: 32 }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            Invoices & Payments
                        </Typography>
                        <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 500 }}>
                            Manage your proforma approvals and payment submissions.
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {orders.length === 0 ? (
                <Zoom in>
                    <Paper elevation={0} sx={{ p: 8, textAlign: 'center', borderRadius: '32px', border: '2px dashed #e2e8f0', bgcolor: '#f8fafc' }}>
                        <VerifiedIcon sx={{ fontSize: 80, color: '#22c55e', mb: 2, opacity: 0.8 }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mb: 1 }}>Zero Pending Items</Typography>
                        <Typography variant="body1" sx={{ color: '#64748b' }}>Your workspace is clear. All invoices and payments are up to date.</Typography>
                    </Paper>
                </Zoom>
            ) : reviewingInvoice ? (
                /* ======================= PREMIUM INVOICE REVIEW (WIDER) ======================= */
                <Fade in>
                    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
                        <Paper elevation={20} sx={{ borderRadius: '32px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
                            <Box sx={{ p: 4, bgcolor: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton onClick={() => setReviewingInvoice(null)} sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#f1f5f9' } }}>
                                        <ArrowBackIcon />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>Review Document</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>ORDER ID: {reviewingInvoice.orderId}</Typography>
                                    </Box>
                                </Box>
                                <Chip label="Action Required" sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 800, px: 1 }} />
                            </Box>

                            <Box sx={{ p: 3, bgcolor: '#f8fafc' }}>
                                <Box sx={{ height: '70vh', bgcolor: '#fff', borderRadius: '24px', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {reviewingInvoice.performaInvoiceUrl ? (
                                        <iframe
                                            src={`${BASE_URL}/${reviewingInvoice.performaInvoiceUrl}`}
                                            title="Invoice Preview"
                                            width="100%"
                                            height="100%"
                                            style={{ border: 'none' }}
                                        />
                                    ) : (
                                        <Typography color="error">Document loading error</Typography>
                                    )}
                                </Box>
                            </Box>

                            <Box sx={{ p: 4, bgcolor: '#fff', display: 'flex', gap: 3 }}>
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    onClick={() => handleRejectInvoice(reviewingInvoice._id)}
                                    sx={{ py: 2, borderRadius: '16px', fontWeight: 800, color: '#ef4444', borderColor: '#fee2e2', '&:hover': { bgcolor: '#fef2f2', borderColor: '#ef4444' } }}
                                >
                                    Reject Invoice
                                </Button>
                                <Button
                                    variant="contained"
                                    fullWidth
                                    onClick={() => handleApproveInvoice(reviewingInvoice._id)}
                                    sx={{ py: 2, borderRadius: '16px', fontWeight: 800, bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' }, boxShadow: '0 10px 15px -3px rgba(249,115,22,0.3)' }}
                                >
                                    Approve & Proceed
                                </Button>
                            </Box>
                        </Paper>
                    </Box>
                </Fade>
            ) : paymentOrder ? (
                /* ======================= PREMIUM PAYMENT FORM (WIDE & COMPACT) ======================= */
                <Fade in>
                    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
                        <Paper elevation={20} sx={{ borderRadius: '32px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
                            <Box sx={{ p: 3, bgcolor: '#fff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <IconButton onClick={() => setPaymentOrder(null)} sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#f1f5f9' } }}>
                                        <ArrowBackIcon />
                                    </IconButton>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>Payment Submission</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>acknowledgement for <strong>{paymentOrder.orderId}</strong></Typography>
                                    </Box>
                                </Box>
                                <Chip
                                    label={paymentOrder.status}
                                    sx={{ bgcolor: statusColor(paymentOrder.status).bg, color: statusColor(paymentOrder.status).text, fontWeight: 800 }}
                                />
                            </Box>

                            <Box sx={{ p: 4 }}>
                                <form onSubmit={handlePaymentSubmit}>
                                    <Grid container spacing={3}>
                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <CustomTextField
                                                label="Total Amount Paid (₹)"
                                                type="number"
                                                required
                                                value={paymentData.amountPaid}
                                                onChange={e => updateField('amountPaid', e.target.value)}
                                                inputProps={{ min: 0 }}
                                            />
                                        </Grid>

                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <CustomTextField
                                                label="Cheque Number"
                                                required
                                                value={paymentData.chequeNumber}
                                                onChange={e => updateField('chequeNumber', e.target.value)}
                                            />
                                        </Grid>

                                        <Grid size={{ xs: 12, md: 4 }}>
                                            <CustomTextField

                                                type="date"
                                                required
                                                InputLabelProps={{ shrink: true }}
                                                value={paymentData.chequeDate}
                                                onChange={e => updateField('chequeDate', e.target.value)}
                                            />
                                        </Grid>

                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Box sx={{
                                                p: 2, border: '2px dashed #e2e8f0', borderRadius: '16px',
                                                textAlign: 'center', transition: 'all 0.2s', height: '100%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                '&:hover': { borderColor: '#f97316', bgcolor: '#fff7ed' }
                                            }}>
                                                <input
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    id="cheque-upload"
                                                    type="file"
                                                    onChange={e => setChequeFile(e.target.files[0])}
                                                />
                                                <label htmlFor="cheque-upload" style={{ width: '100%' }}>
                                                    <Box sx={{ cursor: 'pointer' }}>
                                                        <AttachFileIcon sx={{ fontSize: 24, color: chequeFile ? '#22c55e' : '#94a3b8', mb: 0.5 }} />
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.8rem' }}>
                                                            {chequeFile ? chequeFile.name : 'Click to upload Cheque Scan'}
                                                        </Typography>
                                                    </Box>
                                                </label>
                                            </Box>
                                        </Grid>

                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <CustomTextField
                                                label="Additional Remarks"
                                                multiline
                                                rows={2}
                                                placeholder="Enter special notes..."
                                                value={paymentData.remarks}
                                                onChange={e => updateField('remarks', e.target.value)}
                                            />
                                        </Grid>

                                        <Grid size={{ xs: 12 }}>
                                            <Button
                                                type="submit"
                                                variant="contained"
                                                fullWidth
                                                disabled={submitting}
                                                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
                                                sx={{
                                                    py: 1.8, borderRadius: '14px', fontWeight: 800,
                                                    bgcolor: '#f77d12ff', '&:hover': { bgcolor: '#f9a82aff' },
                                                    boxShadow: '0 10px 15px -5px rgba(214, 109, 11, 0.2)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                }}
                                            >
                                                {submitting ? 'PROCESSING...' : 'CONFIRM PAYMENT DETAILS'}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </form>
                            </Box>
                        </Paper>
                    </Box>
                </Fade>
            ) : (
                /* =================== PREMIUM ORDER TABLE =================== */
                <Fade in>
                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    {['ID', 'STATUS', 'FILE', 'ACTIONS'].map(h => (
                                        <TableCell key={h} sx={{ color: '#64748b', fontWeight: 800, fontSize: '0.75rem', py: 2.5, px: 4 }}>{h}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {orders.map(o => (
                                    <TableRow key={o._id} sx={{ '&:hover': { bgcolor: '#fafafa' }, transition: 'all 0.2s' }}>
                                        <TableCell sx={{ py: 2.5, px: 4 }}>
                                            <Typography 
                                                onClick={() => setTrackingOrder(o)}
                                                sx={{ 
                                                    fontWeight: 800, 
                                                    color: '#f97316', 
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer',
                                                    fontFamily: 'monospace',
                                                    '&:hover': { textDecoration: 'underline', color: '#ea580c' }
                                                }}
                                            >
                                                {o.orderId}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ px: 4 }}>
                                            <Chip
                                                label={o.status}
                                                sx={{
                                                    fontWeight: 800, fontSize: '0.7rem', border: 'none',
                                                    bgcolor: statusColor(o.status).bg, color: statusColor(o.status).text
                                                }}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ px: 4 }}>
                                            <Typography sx={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>{o.fileName}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ px: 4 }}>
                                            {o.status === 'Performa Invoice Uploaded' ? (
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<VisibilityIcon />}
                                                    onClick={() => setReviewingInvoice(o)}
                                                    sx={{
                                                        borderRadius: '12px', px: 2, py: 0.8, fontWeight: 800, textTransform: 'none',
                                                        bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' },
                                                        boxShadow: '0 4px 6px -1px rgba(249,115,22,0.2)'
                                                    }}
                                                >
                                                    Review
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<PaymentIcon />}
                                                    onClick={() => setPaymentOrder(o)}
                                                    sx={{
                                                        borderRadius: '12px', px: 2, py: 0.8, fontWeight: 800, textTransform: 'none',
                                                        bgcolor: '#f77d12ff', '&:hover': { bgcolor: '#f9a82aff' },
                                                        boxShadow: '0 4px 6px -1px rgba(251, 154, 20, 1)'
                                                    }}
                                                >
                                                    Pay Now
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Fade>
            )}

            {/* Order Tracking Timeline */}
            {trackingOrder && <OrderTrackingModal order={trackingOrder} onClose={() => setTrackingOrder(null)} />}
        </Box>
    );
}
