import React, { useState } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Button, CircularProgress, Alert, TextField, Slide, Fade, Divider
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import MessageIcon from '@mui/icons-material/Message';

export default function CreateOrder() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const navigate = useNavigate();

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) { toast.error('Please select a file first'); return; }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('brand', 'General');
        formData.append('barcodeFileId', '');
        if (message.trim()) {
            formData.append('initialMessage', message.trim());
        }

        setUploading(true);
        try {
            const res = await vendorAPI.upload(formData);
            toast.success(`Order ${res.data.orderId} created!`);
            setFile(null);
            setMessage('');
            setTimeout(() => navigate('/vendor-portal/dashboard'), 1200);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) setFile(droppedFile);
    };

    return (
        <Box sx={{ 
            maxWidth: file ? 1000 : 640, 
            mx: 'auto', 
            mt: 4,
            transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
        }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>Create New Order</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
                Upload your Excel order template to begin the design workflow.
            </Typography>

            <form onSubmit={handleUpload}>
                <Box sx={{ 
                    display: 'flex', 
                    gap: 3, 
                    flexDirection: { xs: 'column', md: file ? 'row' : 'column' },
                    alignItems: 'stretch'
                }}>
                    {/* Left Side: Upload Box */}
                    <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Box
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            sx={{
                                border: `2px dashed ${file ? '#22c55e' : dragOver ? '#7c3aed' : '#cbd5e1'}`,
                                borderRadius: 3,
                                p: 6,
                                textAlign: 'center',
                                bgcolor: file ? '#f0fdf4' : dragOver ? '#f5f3ff' : '#fafafa',
                                transition: 'all 0.25s ease',
                                cursor: 'pointer',
                                position: 'relative',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                '&:hover': { borderColor: '#7c3aed', bgcolor: '#f5f3ff' },
                            }}
                        >
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                                onChange={e => setFile(e.target.files[0])}
                            />
                            {file ? (
                                <>
                                    <CheckCircleIcon sx={{ fontSize: 48, color: '#22c55e', mb: 1 }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#166534' }}>{file.name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB — Ready to upload</Typography>
                                </>
                            ) : (
                                <>
                                    <CloudUploadIcon sx={{ fontSize: 48, color: dragOver ? '#7c3aed' : '#94a3b8', mb: 1.5, transition: 'color 0.2s' }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#334155' }}>
                                        Click or drag file to upload
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                                        Supports .xlsx and .xls formats
                                    </Typography>
                                </>
                            )}
                        </Box>

                        {file && (
                            <Alert severity="info" icon={<InsertDriveFileIcon />} sx={{ mt: 3, borderRadius: 2 }}>
                                Selected: <strong>{file.name}</strong>
                            </Alert>
                        )}
                        
                        {/* Only show button here if NO file selected (centered layout) */}
                        {!file && (
                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={!file || uploading}
                                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <InsertDriveFileIcon />}
                                sx={{
                                    mt: 3, py: 1.5, fontSize: '1rem', fontWeight: 700,
                                    bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' },
                                    boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                                }}
                            >
                                {uploading ? 'Uploading...' : 'Create Order'}
                            </Button>
                        )}
                    </Paper>

                    {/* Right Side: Chatbox (Only visible when file is selected) */}
                    {file && (
                        <Fade in={!!file} timeout={400}>
                            <Paper elevation={0} sx={{ 
                                p: 0, 
                                border: '1px solid #e2e8f0', 
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                bgcolor: '#ffffff'
                            }}>
                                <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <MessageIcon sx={{ color: '#7c3aed' }} />
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>Order Instructions</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Send a message to the Admin</Typography>
                                    </Box>
                                </Box>
                                
                                <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', bgcolor: '#fbfcfd' }}>
                                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2, textAlign: 'center', fontStyle: 'italic' }}>
                                        Any special requests or instructions for this layout? Type them below.
                                    </Typography>
                                </Box>

                                <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        placeholder="Type your message here..."
                                        variant="outlined"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        sx={{ 
                                            mb: 2,
                                            '& .MuiOutlinedInput-root': { borderRadius: 2 }
                                        }}
                                    />
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        fullWidth
                                        disabled={uploading}
                                        endIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                        sx={{
                                            py: 1.5, fontSize: '0.95rem', fontWeight: 700,
                                            bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' },
                                            boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                                        }}
                                    >
                                        {uploading ? 'Processing...' : 'Submit Order & Message'}
                                    </Button>
                                </Box>
                            </Paper>
                        </Fade>
                    )}
                </Box>
            </form>
        </Box>
    );
}
