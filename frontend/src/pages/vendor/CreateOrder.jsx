import React, { useState } from 'react';
import { vendorAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Button, CircularProgress, Alert
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function CreateOrder() {
    const [file, setFile] = useState(null);
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

        setUploading(true);
        try {
            const res = await vendorAPI.uploadOrder(formData);
            toast.success(`Order ${res.data.orderId} created!`);
            setFile(null);
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
        <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>Create New Order</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
                Upload your Excel order template to begin the design workflow.
            </Typography>

            <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0' }}>
                <form onSubmit={handleUpload}>
                    {/* Drop Zone */}
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
                        <Alert severity="info" icon={<InsertDriveFileIcon />} sx={{ mt: 2, borderRadius: 2 }}>
                            Selected: <strong>{file.name}</strong>
                        </Alert>
                    )}

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
                </form>
            </Paper>
        </Box>
    );
}
