import React from 'react';
import { 
    Box, Typography, Paper, IconButton, Divider, Stepper, Step, 
    StepLabel, StepContent, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-IN', { 
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

export default function OrderTrackingModal({ order, onClose }) {
    // Define the sequence of milestones
    const milestones = [
        { 
            label: 'Order Uploaded', 
            date: order.createdAt, 
            desc: `Excel file "${order.fileName}" uploaded by ${order.uploadedBy?.name || 'Vendor'}.`,
            isDone: !!order.createdAt
        },
        { 
            label: 'Layout Ready', 
            date: order.layoutHistory?.[0]?.uploadedAt, 
            desc: 'Admin has uploaded the design layout for your review.',
            isDone: order.layoutHistory?.length > 0
        },
        { 
            label: 'Artwork Approved', 
            date: order.reviewHistory?.find(r => r.status === 'Artwork Approved')?.reviewedAt, 
            desc: 'Design has been approved by the vendor.',
            isDone: order.status !== 'Excel Uploaded' && order.status !== 'Layout Uploaded' && order.status !== 'Artwork Rejected'
        },
        { 
            label: 'Performa Invoice Uploaded', 
            date: order.performaInvoiceDate, 
            desc: 'Admin has uploaded the Performa Invoice.',
            isDone: !!order.performaInvoiceDate
        },
        { 
            label: 'Invoice Approved', 
            date: order.performaInvoiceApprovedDate, 
            desc: 'Vendor has approved the invoice and proceeded to payment.',
            isDone: !!order.performaInvoiceApprovedDate
        },
        { 
            label: 'Payment Details Submitted', 
            date: order.paymentSubmittedDate, 
            desc: 'Cheque details and scan copy have been submitted.',
            isDone: !!order.paymentSubmittedDate
        },
        { 
            label: 'In Production', 
            date: order.productionDate, 
            desc: 'Your order is currently in the manufacturing phase.',
            isDone: !!order.productionDate || order.status === 'Production' || order.status === 'Despatch' || order.status === 'Completed'
        },
       
        { 
            label: 'Delivered', 
            date: order.deliveryDate, 
            desc: 'Order has been successfully delivered.',
            isDone: order.status === 'Completed' || order.status === 'Delivered'
        }
    ];

    return (
        <Box sx={{
            position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, p: { xs: 2, md: 4 }
        }} onClick={onClose}>
            <Paper elevation={24} sx={{
                width: '100%', maxWidth: 700, borderRadius: '24px', overflow: 'hidden',
                animation: 'trackingIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                '@keyframes trackingIn': { from: { transform: 'scale(0.95) translateY(20px)', opacity: 0 }, to: { transform: 'scale(1) translateY(0)', opacity: 1 } }
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <Box sx={{ p: 3, bgcolor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900 }}>Track Order</Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>#{order.orderId}</Typography>
                    </Box>
                    <IconButton onClick={onClose} sx={{ color: '#94a3b8', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}>
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 4, maxHeight: '70vh', overflowY: 'auto' }}>
                    <Stepper orientation="vertical" sx={{ 
                        '& .MuiStepConnector-line': { minHeight: 40, borderLeftWidth: 2, borderColor: '#e2e8f0' },
                        '& .MuiStep-root': { mb: 2 }
                    }}>
                        {milestones.map((step, index) => (
                            <Step key={step.label} active={step.isDone} expanded={true}>
                                <StepLabel 
                                    StepIconComponent={() => (
                                        <Box sx={{ 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: 24, height: 24, borderRadius: '50%',
                                            bgcolor: step.isDone ? '#22c55e' : '#f1f5f9',
                                            color: step.isDone ? 'white' : '#94a3b8',
                                            boxShadow: step.isDone ? '0 0 0 4px rgba(34,197,94,0.2)' : 'none',
                                            zIndex: 2
                                        }}>
                                            {step.isDone ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />}
                                        </Box>
                                    )}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        <Typography sx={{ fontWeight: 800, color: step.isDone ? '#0f172a' : '#94a3b8', fontSize: '0.95rem' }}>
                                            {step.label}
                                        </Typography>
                                        {step.date && (
                                            <Chip 
                                                label={formatDate(step.date)} 
                                                size="small" 
                                                sx={{ 
                                                    height: 20, fontSize: '0.65rem', fontWeight: 700, 
                                                    bgcolor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' 
                                                }} 
                                            />
                                        )}
                                    </Box>
                                </StepLabel>
                                <StepContent>
                                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2, mt: 0.5, maxWidth: '80%' }}>
                                        {step.desc}
                                    </Typography>
                                </StepContent>
                            </Step>
                        ))}
                    </Stepper>
                </Box>

                <Divider />
                
                <Box sx={{ p: 3, bgcolor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AccessTimeIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                            Last update: {formatDate(order.updatedAt)}
                        </Typography>
                    </Box>
                    <Button variant="contained" onClick={onClose} sx={{ bgcolor: '#0f172a', borderRadius: '12px', fontWeight: 800, textTransform: 'none' }}>
                        Done
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
}

function Button({ children, onClick, variant, sx }) {
    return (
        <Box 
            onClick={onClick}
            sx={{ 
                px: 3, py: 1, borderRadius: '10px', bgcolor: '#0f172a', color: 'white', 
                fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                '&:hover': { bgcolor: '#1e293b', transform: 'translateY(-1px)' },
                '&:active': { transform: 'scale(0.98)' },
                ...sx
            }}
        >
            {children}
        </Box>
    );
}
