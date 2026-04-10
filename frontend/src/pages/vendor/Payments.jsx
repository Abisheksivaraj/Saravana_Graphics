import React, { useEffect, useState } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import {
    Box, Typography, Paper, Button, TextField, Grid, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress,
    ToggleButton, ToggleButtonGroup, FormControlLabel, Checkbox, Divider,
    IconButton, Tooltip
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AttachFileIcon from '@mui/icons-material/AttachFile';

const statusColor = (status) => {
    return status === 'Despatch' ? 'success' : status === 'Payment Follow-up' ? 'warning' : 'default';
};

export default function Payments() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paymentOrder, setPaymentOrder] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [paymentData, setPaymentData] = useState({
        amountPaid: '', tdsApplicable: false, paymentMode: 'PDC',
        chequeNumber: '', chequeDate: '', dispatchedBy: '',
        trackingNumber: '', deliveryDate: '', purchaseOrders: '', remarks: ''
    });
    const [chequeFile, setChequeFile] = useState(null);
    const [trackingFile, setTrackingFile] = useState(null);
    const [poFile, setPoFile] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await vendorAPI.getOrders();
            setOrders(res.data.filter(o => o.status === 'Despatch' || o.status === 'Payment Follow-up'));
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const formData = new FormData();
        Object.keys(paymentData).forEach(key => {
            if (paymentData[key] !== '' && paymentData[key] !== null) formData.append(key, paymentData[key]);
        });
        if (chequeFile) formData.append('chequeScanImage', chequeFile);
        if (trackingFile) formData.append('trackingScanCopy', trackingFile);
        if (poFile) formData.append('purchaseOrderCopy', poFile);

        try {
            await vendorAPI.submitPayment(paymentOrder._id, formData);
            toast.success('Payment details submitted successfully');
            setPaymentOrder(null);
            setChequeFile(null); setTrackingFile(null); setPoFile(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to submit payment details');
        } finally {
            setSubmitting(false);
        }
    };

    const updateField = (field, value) => setPaymentData(prev => ({ ...prev, [field]: value }));

    const FileUploadBtn = ({ label, file, onChange, required }) => (
        <Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: required ? '#ef4444' : '#475569', display: 'block', mb: 0.5 }}>
                {required && '* '}{label}
            </Typography>
            <Button
                variant="outlined"
                component="label"
                size="small"
                startIcon={<AttachFileIcon />}
                fullWidth
                sx={{
                    justifyContent: 'flex-start', textTransform: 'none', fontWeight: 500,
                    borderColor: '#e2e8f0', color: file ? '#059669' : '#64748b',
                    bgcolor: file ? '#f0fdf4' : '#fafafa',
                    '&:hover': { borderColor: '#7c3aed', bgcolor: '#f5f3ff' },
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
            >
                {file ? file.name : 'Choose File'}
                <input type="file" hidden onChange={e => onChange(e.target.files[0])} />
            </Button>
        </Box>
    );

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>Payment Details</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
                Submit payment acknowledgements for dispatched orders.
            </Typography>

            {orders.length === 0 ? (
                <Paper elevation={0} sx={{ p: 6, textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <TaskAltIcon sx={{ fontSize: 56, color: '#22c55e', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>All Settled!</Typography>
                    <Typography variant="body2" sx={{ color: '#94a3b8' }}>No orders requiring payment details.</Typography>
                </Paper>
            ) : paymentOrder ? (
                /* ======================= PAYMENT FORM ======================= */
                <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0', maxWidth: 960, mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <IconButton onClick={() => setPaymentOrder(null)} size="small">
                                <ArrowBackIcon />
                            </IconButton>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                    Payment Acknowledgement
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                    Order: <strong>{paymentOrder.orderId}</strong>
                                </Typography>
                            </Box>
                        </Box>
                        <Chip label={paymentOrder.status} color={statusColor(paymentOrder.status)} variant="outlined" size="small" />
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    <form onSubmit={handlePaymentSubmit}>
                        {/* Amount & TDS */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Total Amount Paid *"
                                    type="number"
                                    fullWidth
                                    required
                                    size="small"
                                    value={paymentData.amountPaid || ''}
                                    onChange={e => updateField('amountPaid', e.target.value)}
                                    inputProps={{ min: 0 }}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={<Checkbox checked={paymentData.tdsApplicable} onChange={e => updateField('tdsApplicable', e.target.checked)} />}
                                    label={<Typography variant="body2" sx={{ fontWeight: 600 }}>TDS Applicable</Typography>}
                                />
                            </Grid>
                        </Grid>

                        {/* Payment Mode Toggle */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Payment Mode
                            </Typography>
                            <ToggleButtonGroup
                                exclusive
                                value={paymentData.paymentMode}
                                onChange={(_, v) => { if (v) updateField('paymentMode', v); }}
                                sx={{ width: '100%' }}
                            >
                                <ToggleButton value="PDC" sx={{ flex: 1, fontWeight: 700, py: 1.2, textTransform: 'none', gap: 1 }}>
                                    <CreditCardIcon sx={{ fontSize: 18 }} /> PDC
                                </ToggleButton>
                                <ToggleButton value="NEFT/RTGS" sx={{ flex: 1, fontWeight: 700, py: 1.2, textTransform: 'none', gap: 1 }}>
                                    <AccountBalanceIcon sx={{ fontSize: 18 }} /> NEFT/RTGS
                                </ToggleButton>
                                <ToggleButton value="UPI" sx={{ flex: 1, fontWeight: 700, py: 1.2, textTransform: 'none', gap: 1 }}>
                                    <PhoneAndroidIcon sx={{ fontSize: 18 }} /> UPI
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>

                        {/* Dense Grid */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Cheque Number *" required fullWidth size="small" value={paymentData.chequeNumber || ''} onChange={e => updateField('chequeNumber', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FileUploadBtn label="Cheque Scan Image" file={chequeFile} onChange={setChequeFile} required />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Cheque Date *" type="date" required fullWidth size="small" InputLabelProps={{ shrink: true }} value={paymentData.chequeDate || ''} onChange={e => updateField('chequeDate', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Dispatched By *" required fullWidth size="small" placeholder="Courier Name" value={paymentData.dispatchedBy || ''} onChange={e => updateField('dispatchedBy', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FileUploadBtn label="Tracking Scan Copy" file={trackingFile} onChange={setTrackingFile} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Tracking No" fullWidth size="small" placeholder="AWB/Tracking" value={paymentData.trackingNumber || ''} onChange={e => updateField('trackingNumber', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Approx Delivery Date *" type="date" required fullWidth size="small" InputLabelProps={{ shrink: true }} value={paymentData.deliveryDate || ''} onChange={e => updateField('deliveryDate', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField label="Purchase Order(s)" fullWidth size="small" placeholder="PO Numbers" value={paymentData.purchaseOrders || ''} onChange={e => updateField('purchaseOrders', e.target.value)} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <FileUploadBtn label="PO Copy" file={poFile} onChange={setPoFile} />
                            </Grid>
                        </Grid>

                        {/* Remarks */}
                        <TextField
                            label="Additional Remarks"
                            multiline
                            rows={2}
                            fullWidth
                            size="small"
                            value={paymentData.remarks || ''}
                            onChange={e => updateField('remarks', e.target.value)}
                            sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />

                        {/* Invoice Summary Table */}
                        <Paper variant="outlined" sx={{ mb: 3, overflow: 'hidden', borderRadius: 2 }}>
                            <Box sx={{ bgcolor: '#f1f5f9', px: 2, py: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: '#475569' }}>
                                    Invoice Summary
                                </Typography>
                            </Box>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        {['Invoice No', 'Total Payable', 'TDS %', 'TDS Amt', 'Post-TDS', 'Rounded', 'Diff w/ Paid'].map(h => (
                                            <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.7rem', color: '#475569' }}>{h}</TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>INV_{paymentOrder.orderId}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>₹ {paymentData.amountPaid || '0.00'}</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>0.00%</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>₹ 0.00</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>₹ {paymentData.amountPaid || '0.00'}</TableCell>
                                        <TableCell sx={{ color: '#94a3b8' }}>₹ {paymentData.amountPaid || '0.00'}</TableCell>
                                        <TableCell><Chip label="Exact" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} /></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Paper>

                        <Divider sx={{ mb: 2 }} />

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={submitting}
                                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <PaymentIcon />}
                                sx={{
                                    px: 4, py: 1.2, fontWeight: 700,
                                    bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' },
                                    boxShadow: '0 2px 8px rgba(15,23,42,0.2)',
                                }}
                            >
                                Submit PDC Details
                            </Button>
                        </Box>
                    </form>
                </Paper>
            ) : (
                /* =================== ORDER SELECTION TABLE =================== */
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#7c3aed' }}>
                                {['Order ID', 'Status', 'File Name', 'Action'].map(h => (
                                    <TableCell key={h} sx={{ color: '#fff', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5, py: 1.5 }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map(o => (
                                <TableRow key={o._id} hover>
                                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#7c3aed', fontSize: '0.85rem' }}>{o.orderId}</TableCell>
                                    <TableCell>
                                        <Chip label={o.status} color={statusColor(o.status)} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.85rem' }}>{o.fileName}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            startIcon={<PaymentIcon />}
                                            onClick={() => setPaymentOrder(o)}
                                            sx={{
                                                fontWeight: 700, textTransform: 'none',
                                                bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' },
                                            }}
                                        >
                                            Provide Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
}
