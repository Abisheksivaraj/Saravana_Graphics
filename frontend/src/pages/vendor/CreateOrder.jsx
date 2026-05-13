import React, { useState, useEffect } from 'react';
import { vendorAPI, authAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
    Box, Typography, Paper, Button, CircularProgress, Alert, TextField, 
    MenuItem, Select, FormControl, InputLabel, Fade, Divider
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SendIcon from '@mui/icons-material/Send';
import MessageIcon from '@mui/icons-material/Message';
import BusinessIcon from '@mui/icons-material/Business';

export default function CreateOrder() {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [entities, setEntities] = useState([]);
    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [selectedEntity, setSelectedEntity] = useState('');
    const [manualBrand, setManualBrand] = useState('');
    const [loadingProfile, setLoadingProfile] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await authAPI.getMe();
                // /me returns { user: {...} }
                const userData = res.data.user || res.data;
                const userEntities = userData.entities || [];

                // Normalise entity list — entities use `brandName`, legacy uses top-level fields
                const normalised = userEntities.map(e => ({
                    vendorCode: e.vendorCode,
                    vendorName: e.vendorName || userData.vendorName || userData.name,
                    vendorBrand: e.brandName || e.vendorBrand || '',
                    vendorGstin: e.vendorGstin || '',
                    groupName: e.groupName || ''
                }));

                const userGroups = userData.groupNames || [];
                setGroups(userGroups);
                setEntities(normalised);
                
                // Smart auto-selection
                if (userGroups.length > 0) {
                    const firstGroup = userGroups[0];
                    setSelectedGroup(firstGroup);
                    // Find first entity in this group
                    const firstMatch = normalised.find(e => e.groupName === firstGroup);
                    if (firstMatch) {
                        setSelectedEntity(firstMatch.vendorCode);
                        setManualBrand('');
                    }
                } else if (normalised.length > 0) {
                    setSelectedEntity(normalised[0].vendorCode);
                    setManualBrand('');
                }
            } catch (err) {
                toast.error('Failed to load profile');
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) { toast.error('Please select a file first'); return; }
        if (!selectedEntity) { toast.error('Please select a Vendor Entity'); return; }

        console.log('SUBMITTING ORDER:', {
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            vendorCode: selectedEntity,
            group: selectedGroup
        });

        const entity = entities.find(e => e.vendorCode === selectedEntity);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('vendorCode', entity?.vendorCode || selectedEntity);
        formData.append('brand', manualBrand || entity?.vendorBrand || 'General'); // Still send 'brand' for general use
        formData.append('brandName', entity?.vendorBrand || '');
        formData.append('manualBrand', manualBrand || '');
        formData.append('groupName', selectedGroup);
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

    if (loadingProfile) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress />
        </Box>
    );

    return (
        <Box sx={{ 
            maxWidth: file ? 1000 : 700, 
            mx: 'auto', 
            mt: 4,
            transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
        }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', mb: 0.5 }}>Create New Order</Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 4 }}>
                Select your group and business unit to upload your Excel template.
            </Typography>

            <form onSubmit={handleUpload}>
                <Box sx={{ 
                    display: 'flex', 
                    gap: 3, 
                    flexDirection: { xs: 'column', md: file ? 'row' : 'column' },
                    alignItems: 'stretch'
                }}>
                    {/* Left Side: Entity Selection & Upload */}
                    <Paper elevation={0} sx={{ p: 4, border: '1px solid #e2e8f0', borderRadius: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        
                        {/* Dropdowns Container - Horizontal Layout */}
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                            {/* Group Selector */}
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1 }}>
                                <FormControl fullWidth>
                                    <InputLabel sx={{ fontWeight: 700, color: '#3b82f6' }}>Select Group Name</InputLabel>
                                    <Select
                                        value={selectedGroup}
                                        onChange={(e) => {
                                            const g = e.target.value;
                                            setSelectedGroup(g);
                                            const match = entities.find(ent => ent.groupName === g);
                                            setSelectedEntity(match ? match.vendorCode : '');
                                            setManualBrand('');
                                        }}
                                        label="Select Group Name"
                                        sx={{ 
                                            borderRadius: '8px', bgcolor: 'white',
                                            '& .MuiSelect-select': { py: 1.2, fontWeight: 700 }
                                        }}
                                    >
                                        <MenuItem value=""><em>None</em></MenuItem>
                                        {groups.map(g => (
                                            <MenuItem key={g} value={g} sx={{ fontWeight: 700 }}>{g}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>

                            {/* Entity Selector */}
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1 }}>
                                <FormControl fullWidth disabled={!selectedGroup}>
                                    <InputLabel sx={{ fontWeight: 700, color: '#f97316' }}>Select Vendor Code</InputLabel>
                                    <Select
                                        value={selectedEntity}
                                        onChange={(e) => {
                                            const code = e.target.value;
                                            setSelectedEntity(code);
                                            setManualBrand('');
                                        }}
                                        label="Select Vendor Code"
                                        sx={{ 
                                            borderRadius: '8px', bgcolor: 'white',
                                            '& .MuiSelect-select': { py: 1.2, fontWeight: 700 }
                                        }}
                                    >
                                        {entities.filter(ent => ent.groupName === selectedGroup).map(ent => (
                                            <MenuItem key={ent.vendorCode} value={ent.vendorCode}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <BusinessIcon sx={{ color: '#64748b', fontSize: 20 }} />
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{ent.vendorCode}</Typography>
                                                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{ent.vendorBrand || ent.vendorName}</Typography>
                                                    </Box>
                                                </Box>
                                            </MenuItem>
                                        ))}
                                        {entities.filter(ent => ent.groupName === selectedGroup).length === 0 && (
                                            <MenuItem disabled value="">
                                                <Typography sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>No codes found for this group</Typography>
                                            </MenuItem>
                                        )}
                                    </Select>
                                </FormControl>
                            </Box>  

                            {/* Sub Brand Input */}
                            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', flex: 1 }}>
                                <TextField
                                    fullWidth
                                    label="Brand Name"
                                    value={manualBrand}
                                    onChange={(e) => setManualBrand(e.target.value)}
                                    disabled={!selectedEntity}
                                    variant="outlined"
                                    sx={{ 
                                        bgcolor: 'white',
                                        '& .MuiOutlinedInput-root': { 
                                            borderRadius: '8px',
                                            '& fieldset': { border: 'none' }
                                        },
                                        '& .MuiInputBase-input': { py: 1.2, fontWeight: 700 }
                                    }}
                                    InputLabelProps={{ sx: { fontWeight: 700, color: '#ec4899' } }}
                                />
                            </Box>
                        </Box>

                        <Box
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            sx={{
                                border: `2px dashed ${file ? '#22c55e' : dragOver ? '#f97316' : '#cbd5e1'}`,
                                borderRadius: 4,
                                p: 6,
                                textAlign: 'center',
                                bgcolor: file ? '#f0fdf4' : dragOver ? '#fff7ed' : '#fafafa',
                                transition: 'all 0.25s ease',
                                cursor: 'pointer',
                                position: 'relative',
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                '&:hover': { borderColor: '#f97316', bgcolor: '#fff7ed' },
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
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#166534' }}>{file.name}</Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB — Ready to upload</Typography>
                                </>
                            ) : (
                                <>
                                    <CloudUploadIcon sx={{ fontSize: 48, color: dragOver ? '#f97316' : '#94a3b8', mb: 1.5, transition: 'color 0.2s' }} />
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#334155' }}>
                                        Click or drag file to upload
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                                        Supports .xlsx and .xls formats
                                    </Typography>
                                </>
                            )}
                        </Box>

                        {!file && (
                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={!file || uploading}
                                startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <InsertDriveFileIcon />}
                                sx={{
                                    py: 1.5, fontSize: '1rem', fontWeight: 800, borderRadius: '12px',
                                    bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' },
                                    boxShadow: '0 4px 14px rgba(15,23,42,0.3)',
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
                                p: 0, border: '1px solid #e2e8f0', borderRadius: '16px', flex: 1,
                                display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#ffffff'
                            }}>
                                <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <MessageIcon sx={{ color: '#f97316' }} />
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>Order Instructions</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Send a message to the Admin</Typography>
                                    </Box>
                                </Box>
                                
                                <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', bgcolor: '#fbfcfd' }}>
                                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2, textAlign: 'center', fontStyle: 'italic' }}>
                                        Any special requests or instructions for this layout? Type them below.
                                    </Typography>
                                </Box>

                                <Box sx={{ p: 2.5, borderTop: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        placeholder="Type your message here..."
                                        variant="outlined"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                                    />
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        fullWidth
                                        disabled={uploading}
                                        endIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                        sx={{
                                            py: 1.5, fontSize: '0.95rem', fontWeight: 800, borderRadius: '12px',
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
